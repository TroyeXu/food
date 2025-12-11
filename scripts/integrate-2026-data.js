const fs = require('fs');
const path = require('path');

// 讀取現有數據
const plansPath = path.join(__dirname, '../public/data/plans.json');
const existingPlans = JSON.parse(fs.readFileSync(plansPath, 'utf-8'));

// 讀取 2026 新數據
const newDataPath = path.join(__dirname, '../data/2026-niantsai-data.json');
const newPlans = JSON.parse(fs.readFileSync(newDataPath, 'utf-8'));

console.log(`\n📊 數據整合報告`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`現有方案數: ${existingPlans.length}`);
console.log(`新增方案數: ${newPlans.length}`);

// 去重函數 - 檢查是否已存在相似方案
function isDuplicate(newPlan, existingPlans) {
  return existingPlans.some(existing =>
    existing.vendorName === newPlan.vendorName &&
    existing.title === newPlan.title &&
    existing.priceDiscount === newPlan.priceDiscount
  );
}

// 輔助函數：檢測廠商類型
function detectVendorType(vendorName) {
  const vendorNameLower = vendorName.toLowerCase();
  if (vendorName.includes('飯店') || vendorName.includes('酒店') || vendorName.includes('宴會')) return 'hotel';
  if (vendorName.includes('餐廳') || vendorName.includes('美食')) return 'restaurant';
  if (vendorName.includes('便利')) return 'convenience';
  if (vendorName.includes('超市') || vendorName.includes('量販')) return 'supermarket';
  if (vendorName.includes('素')) return 'vegetarian';
  return 'brand';
}

function detectProductType(title, dishes) {
  const titleLower = title.toLowerCase();
  if (title.includes('套餐') || title.includes('組合')) return 'combo';
  if (title.includes('單品') || !dishes || dishes.length === 1) return 'single';
  if (title.includes('甜點') || title.includes('點心')) return 'dessert';
  if (title.includes('禮盒')) return 'gift_box';
  if (title.includes('湯')) return 'soup';
  return 'combo';
}

function detectCuisineStyle(tags = []) {
  const tagsStr = tags.join('').toLowerCase();
  if (tagsStr.includes('粵') || tagsStr.includes('港')) return 'cantonese';
  if (tagsStr.includes('上海')) return 'shanghai';
  if (tagsStr.includes('川') || tagsStr.includes('湘')) return 'sichuan';
  if (tagsStr.includes('日')) return 'japanese';
  if (tagsStr.includes('素')) return 'vegetarian';
  if (tagsStr.includes('創')) return 'fusion';
  if (tagsStr.includes('西')) return 'western';
  return 'taiwanese';
}

// 處理新方案
const toAdd = [];
const duplicates = [];

newPlans.forEach((plan, idx) => {
  if (isDuplicate(plan, existingPlans)) {
    duplicates.push({
      vendor: plan.vendorName,
      title: plan.title,
      price: plan.priceDiscount
    });
  } else {
    // 補充缺失欄位
    const enrichedPlan = {
      ...plan,
      id: `plan_${Date.now()}_${idx}`,
      status: 'published',
      vendorType: plan.vendorType || detectVendorType(plan.vendorName),
      productType: plan.productType || detectProductType(plan.title, plan.dishes),
      cuisineStyle: plan.cuisineStyle || detectCuisineStyle(plan.tags),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      views: 0,
      rating: 0,
      ratingCount: 0
    };
    toAdd.push(enrichedPlan);
  }
});

// 合併數據
const mergedPlans = [...existingPlans, ...toAdd];

// 保存合併後的數據
fs.writeFileSync(plansPath, JSON.stringify(mergedPlans, null, 2));

console.log(`\n✅ 整合結果:`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`新增方案: ${toAdd.length}`);
console.log(`重複方案: ${duplicates.length}`);
console.log(`最終總數: ${mergedPlans.length}`);

if (duplicates.length > 0) {
  console.log(`\n⚠️  重複的方案:`);
  duplicates.slice(0, 5).forEach((d, i) => {
    console.log(`   ${i + 1}. ${d.vendor} - ${d.title} (NT$${d.price})`);
  });
  if (duplicates.length > 5) {
    console.log(`   ... 及其他 ${duplicates.length - 5} 筆`);
  }
}

console.log(`\n📝 已新增的方案樣本:`);
toAdd.slice(0, 5).forEach((p, i) => {
  console.log(`   ${i + 1}. ${p.vendorName} - ${p.title}`);
  console.log(`      價格: NT$${p.priceDiscount} | 份量: ${p.servingsMin}-${p.servingsMax}人 | 類型: ${p.vendorType}`);
});
if (toAdd.length > 5) {
  console.log(`   ... 及其他 ${toAdd.length - 5} 筆`);
}

console.log(`\n✨ 數據整合完成！`);
console.log(`公開資料已更新: ${plansPath}`);
