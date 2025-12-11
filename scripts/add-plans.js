#!/usr/bin/env node
/**
 * 新增年菜資料到資料庫
 * 使用方式: node scripts/add-plans.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_FILE = path.join(__dirname, '../public/data/plans.json');
const NEW_PLANS_FILE = path.join(__dirname, '../data/new-plans.json');

// 分類函數（與 normalize-data.js 相同）
const VENDOR_TYPE_RULES = {
  hotel: ['飯店', '酒店', 'Hotel', 'hotel', '凱悅', 'Hyatt', '晶華', '寒舍', '喜來登', '萬豪', '希爾頓', '香格里拉', '遠東', '文華東方', '君悅', 'W飯店', '老爺', '福華', '凱達', '翰品', '日航', '福容', '美福', '維多麗亞', '凱撒', '華泰', '耐斯王子', '誠品行旅', '晶英', '萬怡', '長榮', '圓山', '國賓'],
  restaurant: ['餐廳', '餐館', '料理', '菜', '樓', '園', '軒', '坊', '閣', '居', '苑', '欣葉', '青葉', '金蓬萊', '彭園', '點水樓', '鼎泰豐', '海霸王', '糖朝', '紅豆食府', '度小月', '周氏蝦捲', '林聰明', '阿基師', '山海樓', '逸湘齋'],
  brand: ['老協珍', '王品', '大成', '卜蜂', '義美', '台酒', '郭元益', '金格', '裕珍馨', '正官庄', '福記', '呷七碗', '漁季', '富霸王', '廚鮮食代', '芳葉', '阿舍'],
  convenience: ['7-ELEVEN', '7-11', '全家', '萊爾富', 'OK超商', 'Hi-Life'],
  hypermarket: ['全聯', '家樂福', 'Costco', '好市多', '大潤發', '愛買', 'PX Mart', 'pxmart'],
  vegetarian: ['素食', '蔬食', '素', '齋', '養心', '祥和', '禪廚', '遇上素', '蔡老師蔬食']
};

function detectVendorType(vendorName, tags) {
  for (const [type, keywords] of Object.entries(VENDOR_TYPE_RULES)) {
    for (const keyword of keywords) {
      if (vendorName.includes(keyword) || tags.some(t => t.includes(keyword))) {
        return type;
      }
    }
  }
  return 'other';
}

function detectProductType(title, dishes, tags) {
  if (dishes.length >= 3 || title.includes('套餐') || title.includes('組合') || title.includes('桌菜')) {
    return 'set_meal';
  }
  if (title.includes('甜點') || title.includes('年糕') || title.includes('蘿蔔糕')) {
    return 'dessert';
  }
  if (title.includes('禮盒') || title.includes('伴手禮')) {
    return 'gift_box';
  }
  if (title.includes('湯') || title.includes('羹') || title.includes('煲')) {
    return 'soup';
  }
  return dishes.length <= 2 ? 'single_dish' : 'set_meal';
}

function detectCuisineStyle(tags, vendorName, title) {
  const allText = [...tags, vendorName, title].join(' ');
  const styles = {
    taiwanese: ['台式', '台菜', '辦桌', '古早味', '府城', '台南', '台灣'],
    cantonese: ['粵式', '粵菜', '港式', '廣東', '燒臘', '點心', '飲茶'],
    shanghainese: ['上海', '江浙', '滬式', '蘇杭'],
    szechuan: ['川菜', '川味', '湘菜', '湘味', '麻辣', '四川'],
    japanese: ['日式', '和風', '御節', '日本'],
    vegetarian: ['素食', '蔬食', '素', '齋', '全素', '蛋奶素'],
    fusion: ['創意', '混合', '西式中餐', '無國界'],
    western: ['西式', '法式', '義式', '歐式']
  };

  for (const [style, keywords] of Object.entries(styles)) {
    for (const keyword of keywords) {
      if (allText.includes(keyword)) return style;
    }
  }
  return 'taiwanese';
}

function calculatePriceLevel(price) {
  if (price < 2000) return 'budget';
  if (price < 5000) return 'mid_range';
  if (price < 10000) return 'premium';
  return 'luxury';
}

function calculateFamilySize(servingsMin, servingsMax) {
  const maxServing = servingsMax || servingsMin;
  if (maxServing <= 2) return 'couple';
  if (maxServing <= 4) return 'small';
  if (maxServing <= 6) return 'medium';
  return 'large';
}

function generateId() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * 計算兩個方案的相似度 (基於菜名)
 */
function calculateSimilarity(a, b) {
  const dishesA = new Set(a.dishes || []);
  const dishesB = new Set(b.dishes || []);

  if (dishesA.size === 0 && dishesB.size === 0) {
    // 都沒有菜名，比較標題
    const titleA = a.title.toLowerCase().replace(/\s+/g, '');
    const titleB = b.title.toLowerCase().replace(/\s+/g, '');
    if (titleA === titleB) return 1;
    if (titleA.includes(titleB) || titleB.includes(titleA)) return 0.8;
    return 0.3;
  }

  const intersection = [...dishesA].filter(d => dishesB.has(d));
  const union = new Set([...dishesA, ...dishesB]);

  return intersection.length / union.size;
}

/**
 * 計算方案的資料完整度分數
 */
function calculateCompleteness(plan) {
  let score = 0;
  if (plan.imageUrl) score += 2;
  if (plan.description) score += 1;
  if (plan.dishes?.length > 0) score += plan.dishes.length;
  if (plan.tags?.length > 0) score += plan.tags.length * 0.5;
  if (plan.priceOriginal) score += 1;
  if (plan.orderDeadline) score += 1;
  return score;
}

/**
 * 檢查新方案是否與現有方案重複，並決定保留哪個
 * @returns {{ isDuplicate: boolean, action: 'skip'|'replace'|'add', existingPlan?: object, reason?: string }}
 */
function checkDuplicateAndDecide(newPlan, existingPlans) {
  // 找出相同廠商 + 相同價格的方案
  const candidates = existingPlans.filter(p =>
    p.vendorName === newPlan.vendorName &&
    p.priceDiscount === newPlan.priceDiscount &&
    p.status !== 'duplicate'
  );

  if (candidates.length === 0) {
    return { isDuplicate: false, action: 'add' };
  }

  // 比較每個候選方案
  for (const existing of candidates) {
    const similarity = calculateSimilarity(newPlan, existing);

    // 相似度超過 50% 視為可能重複
    if (similarity >= 0.5) {
      const newDishes = newPlan.dishes?.length || 0;
      const existingDishes = existing.dishes?.length || 0;

      if (newDishes > existingDishes) {
        // 新的菜名更多，應該替換舊的
        return {
          isDuplicate: true,
          action: 'replace',
          existingPlan: existing,
          reason: `新方案菜名較多 (${newDishes} > ${existingDishes})`
        };
      } else if (newDishes < existingDishes) {
        // 舊的菜名更多，跳過新的
        return {
          isDuplicate: true,
          action: 'skip',
          existingPlan: existing,
          reason: `現有方案菜名較多 (${existingDishes} > ${newDishes})`
        };
      } else {
        // 菜名數量相同，比較完整度
        const newScore = calculateCompleteness(newPlan);
        const existingScore = calculateCompleteness(existing);

        if (newScore > existingScore) {
          return {
            isDuplicate: true,
            action: 'replace',
            existingPlan: existing,
            reason: `新方案資料較完整 (${newScore} > ${existingScore})`
          };
        } else {
          return {
            isDuplicate: true,
            action: 'skip',
            existingPlan: existing,
            reason: `現有方案資料較完整或相同`
          };
        }
      }
    }
  }

  return { isDuplicate: false, action: 'add' };
}

function main() {
  console.log('📥 開始新增年菜資料...\n');

  // 讀取現有資料
  const existingPlans = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  console.log(`📁 現有資料: ${existingPlans.length} 筆`);

  // 讀取新資料
  const newPlans = JSON.parse(fs.readFileSync(NEW_PLANS_FILE, 'utf-8'));
  console.log(`📋 新資料: ${newPlans.length} 筆\n`);

  // 建立重複檢查用的 key set
  const existingKeys = new Set(
    existingPlans.map(p => `${p.vendorName}::${p.title}`)
  );

  // 處理新資料
  const addedPlans = [];
  const skippedPlans = [];
  const invalidPlans = [];
  const replacedPlans = []; // 被替換的舊方案
  const duplicateMarked = []; // 標記為重複的方案

  for (const plan of newPlans) {
    // 驗證必要欄位
    const isValid = plan.vendorName &&
                    plan.vendorName !== '未知' &&
                    plan.vendorName.trim() !== '' &&
                    plan.title &&
                    plan.title !== '未知' &&
                    plan.title.trim() !== '' &&
                    plan.priceDiscount > 0;

    if (!isValid) {
      invalidPlans.push({
        ...plan,
        reason: `缺少必要欄位: vendorName=${plan.vendorName || '空'}, title=${plan.title || '空'}, price=${plan.priceDiscount || 0}`
      });
      continue;
    }

    const key = `${plan.vendorName}::${plan.title}`;

    // 完全相同的 title 直接跳過
    if (existingKeys.has(key)) {
      skippedPlans.push(plan);
      continue;
    }

    // 檢查相同廠商+價格的重複
    const dupeCheck = checkDuplicateAndDecide(plan, existingPlans);

    if (dupeCheck.isDuplicate) {
      if (dupeCheck.action === 'skip') {
        skippedPlans.push({
          ...plan,
          skipReason: dupeCheck.reason,
          existingTitle: dupeCheck.existingPlan.title
        });
        continue;
      }
      // action === 'replace': 標記舊方案為 duplicate，新方案正常加入
      if (dupeCheck.action === 'replace') {
        dupeCheck.existingPlan.status = 'duplicate';
        dupeCheck.existingPlan.duplicateReason = dupeCheck.reason;
        dupeCheck.existingPlan.updatedAt = new Date().toISOString();
        duplicateMarked.push(dupeCheck.existingPlan);
        replacedPlans.push({
          old: dupeCheck.existingPlan.title,
          new: plan.title,
          reason: dupeCheck.reason
        });
      }
    }

    // 補充分類欄位
    const vendorType = detectVendorType(plan.vendorName, plan.tags || []);
    const productType = detectProductType(plan.title, plan.dishes || [], plan.tags || []);
    const cuisineStyle = detectCuisineStyle(plan.tags || [], plan.vendorName, plan.title);
    const priceLevel = calculatePriceLevel(plan.priceDiscount);
    const familySize = calculateFamilySize(plan.servingsMin, plan.servingsMax);

    // 建立完整的 Plan 物件
    const fullPlan = {
      id: generateId(),
      vendorId: generateId(),
      vendorName: plan.vendorName,
      title: plan.title,
      description: plan.description || undefined,
      imageUrl: plan.imageUrl || undefined,
      priceOriginal: plan.priceOriginal || undefined,
      priceDiscount: plan.priceDiscount,
      shippingFee: plan.shippingFee || undefined,
      shippingType: plan.shippingTypes?.includes('delivery') && plan.shippingTypes?.includes('pickup')
        ? 'both'
        : plan.shippingTypes?.[0] === 'pickup' ? 'pickup' : 'delivery',
      shippingTypes: plan.shippingTypes || ['delivery'],
      storageType: plan.storageTypes?.[0] || 'frozen',
      storageTypes: plan.storageTypes || ['frozen'],
      servingsMin: plan.servingsMin,
      servingsMax: plan.servingsMax || undefined,
      orderDeadline: plan.orderDeadline || undefined,
      fulfillStart: plan.fulfillStart || undefined,
      fulfillEnd: plan.fulfillEnd || undefined,
      region: plan.region || undefined,
      city: plan.city || undefined,
      address: plan.address || undefined,
      tags: plan.tags || [],
      dishes: plan.dishes || [],
      vendorType,
      productType,
      cuisineStyle,
      priceLevel,
      familySize,
      sourceUrl: plan.sourceUrl,
      status: 'published',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addedPlans.push(fullPlan);
    existingKeys.add(key);
  }

  // 合併資料
  const allPlans = [...existingPlans, ...addedPlans];

  // 寫入
  fs.writeFileSync(DB_FILE, JSON.stringify(allPlans, null, 2));

  // 輸出統計
  console.log('📊 結果：');
  console.log(`  ✅ 新增: ${addedPlans.length} 筆`);
  console.log(`  🔄 替換(舊->新): ${replacedPlans.length} 筆`);
  console.log(`  ⏭️ 跳過(重複): ${skippedPlans.length} 筆`);
  console.log(`  ❌ 無效(跳過): ${invalidPlans.length} 筆`);
  console.log(`  📁 總計(含duplicate): ${allPlans.length} 筆`);
  console.log(`  📁 有效方案: ${allPlans.filter(p => p.status !== 'duplicate').length} 筆`);

  if (addedPlans.length > 0) {
    console.log('\n✅ 新增的年菜：');
    addedPlans.forEach(p => {
      console.log(`  - ${p.vendorName}: ${p.title} ($${p.priceDiscount.toLocaleString()}) [${p.dishes?.length || 0}道菜]`);
    });
  }

  if (replacedPlans.length > 0) {
    console.log('\n🔄 替換的年菜（新方案資料較好）：');
    replacedPlans.forEach(r => {
      console.log(`  - 舊: ${r.old}`);
      console.log(`    新: ${r.new}`);
      console.log(`    原因: ${r.reason}`);
    });
  }

  if (skippedPlans.length > 0) {
    console.log('\n⏭️ 跳過的年菜：');
    skippedPlans.slice(0, 10).forEach(p => {
      if (p.skipReason) {
        console.log(`  - ${p.vendorName}: ${p.title}`);
        console.log(`    原因: ${p.skipReason}`);
        console.log(`    現有: ${p.existingTitle}`);
      } else {
        console.log(`  - ${p.vendorName}: ${p.title} (標題完全相同)`);
      }
    });
    if (skippedPlans.length > 10) {
      console.log(`  ... 還有 ${skippedPlans.length - 10} 筆`);
    }
  }

  if (invalidPlans.length > 0) {
    console.log('\n❌ 無效資料（已跳過）：');
    invalidPlans.forEach(p => {
      console.log(`  - ${p.reason}`);
      console.log(`    來源: ${p.sourceUrl || '無'}`);
    });
  }

  console.log('\n✅ 完成！');
}

main();
