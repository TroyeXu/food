#!/usr/bin/env node
/**
 * 資料標準化腳本
 * 自動分類並清理年菜資料
 * 使用方式: node scripts/normalize-data.js
 */

const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '../public/data/plans.json');

// ====== 分類規則 ======

// 廠商類型判斷
const VENDOR_TYPE_RULES = {
  hotel: [
    '飯店', '酒店', 'Hotel', 'hotel', '晶華', '寒舍', '喜來登', '萬豪', '希爾頓',
    '香格里拉', '遠東', '文華東方', '君悅', 'W飯店', '老爺', '福華', '凱達',
    '翰品', '日航', '福容', '美福', '維多麗亞', '凱撒', '華泰', '耐斯王子',
    '誠品行旅', '晶英', '萬怡', '長榮', '圓山', '國賓'
  ],
  restaurant: [
    '餐廳', '餐館', '料理', '菜', '樓', '園', '軒', '坊', '閣', '居', '苑',
    '欣葉', '青葉', '金蓬萊', '彭園', '點水樓', '鼎泰豐', '海霸王', '糖朝',
    '紅豆食府', '度小月', '周氏蝦捲', '林聰明', '阿基師', '山海樓', '逸湘齋'
  ],
  brand: [
    '老協珍', '王品', '大成', '卜蜂', '義美', '台酒', '郭元益', '金格', '裕珍馨',
    '正官庄', '福記', '呷七碗', '漁季', '富霸王', '廚鮮食代', '芳葉', '阿舍'
  ],
  convenience: [
    '7-ELEVEN', '7-11', '全家', '萊爾富', 'OK超商', 'Hi-Life'
  ],
  hypermarket: [
    '全聯', '家樂福', 'Costco', '好市多', '大潤發', '愛買', 'PX Mart', 'pxmart'
  ],
  vegetarian: [
    '素食', '蔬食', '素', '齋', '養心', '祥和', '禪廚', '遇上素', '蔡老師蔬食'
  ]
};

// 產品類型判斷
const PRODUCT_TYPE_RULES = {
  set_meal: ['套餐', '組合', '桌菜', '圍爐', '團圓', '年菜組', '件組', '道菜'],
  single_dish: ['單品', '佛跳牆', '雞湯', '米糕', '豬腳', '蹄膀', '烤鴨', '全雞', '全魚'],
  dessert: ['甜點', '年糕', '發糕', '蘿蔔糕', '芋頭糕', '紅豆', '芋泥', '冰', '糕'],
  gift_box: ['禮盒', '伴手禮', '年節禮盒'],
  soup: ['湯', '羹', '煲', '鍋']
};

// 料理風格判斷
const CUISINE_STYLE_RULES = {
  taiwanese: ['台式', '台菜', '辦桌', '古早味', '府城', '台南', '台灣'],
  cantonese: ['粵式', '粵菜', '港式', '廣東', '燒臘', '點心', '飲茶'],
  shanghainese: ['上海', '江浙', '滬式', '蘇杭'],
  szechuan: ['川菜', '川味', '湘菜', '湘味', '麻辣', '四川'],
  japanese: ['日式', '和風', '御節', '日本'],
  vegetarian: ['素食', '蔬食', '素', '齋', '全素', '蛋奶素'],
  fusion: ['創意', '混合', '西式中餐', '無國界'],
  western: ['西式', '法式', '義式', '歐式']
};

// 標籤標準化對照表
const TAG_NORMALIZATION = {
  '港式': '粵式',
  '廣東': '粵式',
  '台菜': '台式',
  '台灣菜': '台式',
  '川味': '川菜',
  '湘味': '湘菜',
  '蔬食': '素食',
  '冷凍': '冷凍年菜',
  '宅配到府': '宅配',
};

// ====== 分類函數 ======

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
  // 優先檢查是否為套餐
  for (const keyword of PRODUCT_TYPE_RULES.set_meal) {
    if (title.includes(keyword) || dishes.length >= 3) {
      return 'set_meal';
    }
  }

  // 檢查甜點
  for (const keyword of PRODUCT_TYPE_RULES.dessert) {
    if (title.includes(keyword) || tags.some(t => t.includes(keyword))) {
      return 'dessert';
    }
  }

  // 檢查禮盒
  for (const keyword of PRODUCT_TYPE_RULES.gift_box) {
    if (title.includes(keyword) || tags.some(t => t.includes(keyword))) {
      return 'gift_box';
    }
  }

  // 檢查湯品
  for (const keyword of PRODUCT_TYPE_RULES.soup) {
    if (title.includes(keyword) && dishes.length <= 2) {
      return 'soup';
    }
  }

  // 檢查單品
  if (dishes.length <= 2) {
    return 'single_dish';
  }

  return 'set_meal';
}

function detectCuisineStyle(tags, vendorName, title) {
  const allText = [...tags, vendorName, title].join(' ');

  for (const [style, keywords] of Object.entries(CUISINE_STYLE_RULES)) {
    for (const keyword of keywords) {
      if (allText.includes(keyword)) {
        return style;
      }
    }
  }

  return 'taiwanese'; // 預設台式
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

function normalizeTags(tags) {
  const normalized = new Set();

  for (const tag of tags) {
    // 套用標準化對照表
    const normalizedTag = TAG_NORMALIZATION[tag] || tag;
    normalized.add(normalizedTag);
  }

  return [...normalized];
}

function findDuplicates(plans) {
  const seen = new Map();
  const duplicates = [];

  for (const plan of plans) {
    const key = `${plan.vendorName}::${plan.title}`;
    if (seen.has(key)) {
      duplicates.push({
        original: seen.get(key),
        duplicate: plan
      });
    } else {
      seen.set(key, plan);
    }
  }

  return duplicates;
}

// ====== 主程式 ======

function main() {
  console.log('📊 開始資料標準化...\n');

  // 讀取資料
  const plans = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  console.log(`📁 讀取到 ${plans.length} 筆資料\n`);

  // 找出重複
  const duplicates = findDuplicates(plans);
  if (duplicates.length > 0) {
    console.log(`⚠️ 發現 ${duplicates.length} 筆重複資料：`);
    duplicates.forEach(d => {
      console.log(`  - ${d.duplicate.vendorName}: ${d.duplicate.title}`);
    });
    console.log('');
  }

  // 移除重複 (保留第一筆)
  const uniqueKeys = new Set();
  const uniquePlans = plans.filter(plan => {
    const key = `${plan.vendorName}::${plan.title}`;
    if (uniqueKeys.has(key)) {
      return false;
    }
    uniqueKeys.add(key);
    return true;
  });

  console.log(`🔄 移除重複後剩餘 ${uniquePlans.length} 筆\n`);

  // 統計
  const stats = {
    vendorType: {},
    productType: {},
    cuisineStyle: {},
    priceLevel: {},
    familySize: {}
  };

  // 處理每筆資料
  const normalizedPlans = uniquePlans.map(plan => {
    const vendorType = detectVendorType(plan.vendorName, plan.tags || []);
    const productType = detectProductType(plan.title, plan.dishes || [], plan.tags || []);
    const cuisineStyle = detectCuisineStyle(plan.tags || [], plan.vendorName, plan.title);
    const priceLevel = calculatePriceLevel(plan.priceDiscount);
    const familySize = calculateFamilySize(plan.servingsMin, plan.servingsMax);
    const normalizedTags = normalizeTags(plan.tags || []);

    // 統計
    stats.vendorType[vendorType] = (stats.vendorType[vendorType] || 0) + 1;
    stats.productType[productType] = (stats.productType[productType] || 0) + 1;
    stats.cuisineStyle[cuisineStyle] = (stats.cuisineStyle[cuisineStyle] || 0) + 1;
    stats.priceLevel[priceLevel] = (stats.priceLevel[priceLevel] || 0) + 1;
    stats.familySize[familySize] = (stats.familySize[familySize] || 0) + 1;

    return {
      ...plan,
      tags: normalizedTags,
      vendorType,
      productType,
      cuisineStyle,
      priceLevel,
      familySize,
      updatedAt: new Date().toISOString()
    };
  });

  // 寫入
  fs.writeFileSync(DB_FILE, JSON.stringify(normalizedPlans, null, 2));

  // 輸出統計
  console.log('📈 分類統計：\n');

  console.log('廠商類型:');
  Object.entries(stats.vendorType).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log(`  ${k}: ${v}`);
  });

  console.log('\n產品類型:');
  Object.entries(stats.productType).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log(`  ${k}: ${v}`);
  });

  console.log('\n料理風格:');
  Object.entries(stats.cuisineStyle).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log(`  ${k}: ${v}`);
  });

  console.log('\n價格等級:');
  Object.entries(stats.priceLevel).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log(`  ${k}: ${v}`);
  });

  console.log('\n家庭規模:');
  Object.entries(stats.familySize).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log(`  ${k}: ${v}`);
  });

  console.log('\n✅ 資料標準化完成！');
  console.log(`  📊 總計: ${normalizedPlans.length} 筆`);
  console.log(`  🗑️ 移除重複: ${plans.length - normalizedPlans.length} 筆`);
}

main();
