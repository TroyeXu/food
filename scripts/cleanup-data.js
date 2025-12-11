#!/usr/bin/env node
/**
 * 清理資料庫中的無效資料
 * - 移除 vendorName/title/priceDiscount 為空的資料
 * - 補充缺少分類欄位的資料
 */

const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '../public/data/plans.json');

// 分類規則（從 add-plans.js 複製）
const VENDOR_TYPE_RULES = {
  hotel: ['飯店', '酒店', 'Hotel', 'hotel', '凱悅', 'Hyatt', '晶華', '寒舍', '喜來登', '萬豪', '希爾頓', '香格里拉', '遠東', '文華東方', '君悅', 'W飯店', '老爺', '福華', '凱達', '翰品', '日航', '福容', '美福', '維多麗亞', '凱撒', '華泰', '耐斯王子', '誠品行旅', '晶英', '萬怡', '長榮', '圓山', '國賓', 'THE上海'],
  restaurant: ['餐廳', '餐館', '料理', '菜', '樓', '園', '軒', '坊', '閣', '居', '苑', '欣葉', '青葉', '金蓬萊', '彭園', '點水樓', '鼎泰豐', '海霸王', '糖朝', '紅豆食府', '度小月', '周氏蝦捲', '林聰明', '阿基師', '山海樓', '逸湘齋'],
  brand: ['老協珍', '王品', '大成', '卜蜂', '義美', '台酒', '郭元益', '金格', '裕珍馨', '正官庄', '福記', '呷七碗', '漁季', '富霸王', '廚鮮食代', '芳葉', '阿舍'],
  convenience: ['7-ELEVEN', '7-11', '全家', '萊爾富', 'OK超商', 'Hi-Life'],
  hypermarket: ['全聯', '家樂福', 'Costco', '好市多', '大潤發', '愛買', 'PX Mart', 'pxmart'],
  vegetarian: ['素食', '蔬食', '素', '齋', '養心', '祥和', '禪廚', '遇上素', '蔡老師蔬食']
};

function detectVendorType(vendorName, tags = []) {
  for (const [type, keywords] of Object.entries(VENDOR_TYPE_RULES)) {
    for (const keyword of keywords) {
      if (vendorName.includes(keyword) || tags.some(t => t.includes(keyword))) {
        return type;
      }
    }
  }
  return 'other';
}

function detectProductType(title, dishes = [], tags = []) {
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

function detectCuisineStyle(tags = [], vendorName = '', title = '') {
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

function main() {
  console.log('🧹 開始清理資料...\n');

  const plans = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  console.log(`📁 原始資料: ${plans.length} 筆`);

  // 1. 移除無效資料
  const validPlans = plans.filter(p => {
    const isValid = p.vendorName &&
                    p.vendorName !== '未知' &&
                    p.vendorName !== '' &&
                    p.title &&
                    p.title !== '未知' &&
                    p.title !== '' &&
                    p.priceDiscount > 0;

    if (!isValid) {
      console.log(`  ❌ 移除無效: ${p.vendorName || '(空)'} - ${p.title || '(空)'} - $${p.priceDiscount || 0}`);
      console.log(`     來源: ${p.sourceUrl || '無'}`);
    }
    return isValid;
  });

  const removedCount = plans.length - validPlans.length;
  console.log(`\n🗑️ 移除 ${removedCount} 筆無效資料`);

  // 2. 補充缺少的分類欄位
  let fixedCount = 0;
  for (const plan of validPlans) {
    let fixed = false;

    if (!plan.vendorType) {
      plan.vendorType = detectVendorType(plan.vendorName, plan.tags || []);
      fixed = true;
    }

    if (!plan.productType) {
      plan.productType = detectProductType(plan.title, plan.dishes || [], plan.tags || []);
      fixed = true;
    }

    if (!plan.cuisineStyle) {
      plan.cuisineStyle = detectCuisineStyle(plan.tags || [], plan.vendorName, plan.title);
      fixed = true;
    }

    if (!plan.priceLevel) {
      plan.priceLevel = calculatePriceLevel(plan.priceDiscount);
      fixed = true;
    }

    if (!plan.familySize) {
      plan.familySize = calculateFamilySize(plan.servingsMin, plan.servingsMax);
      fixed = true;
    }

    // 確保 shippingTypes 和 storageTypes 存在
    if (!plan.shippingTypes) {
      if (plan.shippingType === 'both') {
        plan.shippingTypes = ['delivery', 'pickup'];
      } else {
        plan.shippingTypes = [plan.shippingType || 'delivery'];
      }
      fixed = true;
    }

    if (!plan.storageTypes) {
      plan.storageTypes = [plan.storageType || 'frozen'];
      fixed = true;
    }

    if (fixed) {
      fixedCount++;
      plan.updatedAt = new Date().toISOString();
    }
  }

  console.log(`🔧 補充 ${fixedCount} 筆資料的分類欄位`);

  // 3. 寫回檔案
  fs.writeFileSync(DB_FILE, JSON.stringify(validPlans, null, 2));

  console.log(`\n✅ 完成！資料庫現有 ${validPlans.length} 筆資料`);

  // 4. 統計
  console.log('\n📊 分類統計:');
  const stats = {
    vendorType: {},
    productType: {},
    cuisineStyle: {},
  };

  for (const plan of validPlans) {
    stats.vendorType[plan.vendorType] = (stats.vendorType[plan.vendorType] || 0) + 1;
    stats.productType[plan.productType] = (stats.productType[plan.productType] || 0) + 1;
    stats.cuisineStyle[plan.cuisineStyle] = (stats.cuisineStyle[plan.cuisineStyle] || 0) + 1;
  }

  console.log('  vendorType:', JSON.stringify(stats.vendorType));
  console.log('  productType:', JSON.stringify(stats.productType));
  console.log('  cuisineStyle:', JSON.stringify(stats.cuisineStyle));
}

main();
