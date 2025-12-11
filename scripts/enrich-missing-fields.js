const fs = require('fs');
const path = require('path');

const plansPath = path.join(__dirname, '../public/data/plans.json');
const plans = JSON.parse(fs.readFileSync(plansPath, 'utf-8'));

// 統計缺失數據
const stats = {
  noDishes: [],
  noImageUrl: [],
  noShippingFee: [],
  noMaxDistance: [],
};

plans.forEach(plan => {
  if (!plan.dishes || plan.dishes.length === 0) {
    stats.noDishes.push(plan.id);
  }
  if (!plan.imageUrl) {
    stats.noImageUrl.push(plan.id);
  }
  if (!plan.shippingFee) {
    stats.noShippingFee.push(plan.id);
  }
  if (!plan.maxDistance) {
    stats.noMaxDistance.push(plan.id);
  }
});

console.log('\n📊 數據缺失統計');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`總計: ${plans.length} 筆\n`);
console.log(`缺少菜色 (noDishes): ${stats.noDishes.length} 筆 (${(stats.noDishes.length / plans.length * 100).toFixed(1)}%)`);
console.log(`缺少圖片 URL (noImageUrl): ${stats.noImageUrl.length} 筆 (${(stats.noImageUrl.length / plans.length * 100).toFixed(1)}%)`);
console.log(`缺少運費 (noShippingFee): ${stats.noShippingFee.length} 筆 (${(stats.noShippingFee.length / plans.length * 100).toFixed(1)}%)`);
console.log(`缺少配送距離 (noMaxDistance): ${stats.noMaxDistance.length} 筆 (${(stats.noMaxDistance.length / plans.length * 100).toFixed(1)}%)`);

// 分析需要補充的數據
console.log('\n🔧 補充建議');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// 為缺少菜色的方案生成建議
if (stats.noDishes.length > 0) {
  console.log(`[菜色補充] 缺少菜色的 ${stats.noDishes.length} 筆方案:`);
  const samplePlans = plans
    .filter(p => stats.noDishes.includes(p.id))
    .slice(0, 3);

  samplePlans.forEach(plan => {
    console.log(`  • ${plan.vendorName} - ${plan.title}`);
    console.log(`    建議: 根據標籤 [${plan.tags.join(', ')}] 補充菜色`);
  });
  if (stats.noDishes.length > 3) {
    console.log(`  ... 及其他 ${stats.noDishes.length - 3} 筆`);
  }
  console.log();
}

// 為缺少圖片的方案生成建議
if (stats.noImageUrl.length > 0) {
  console.log(`[圖片補充] 缺少圖片的 ${stats.noImageUrl.length} 筆方案 (97% 的方案)`);
  console.log(`  建議: 需要從官方網站爬取圖片，或手動添加代表性圖片 URL\n`);
}

// 為缺少運費的方案生成建議
if (stats.noShippingFee.length > 0) {
  console.log(`[運費補充] 缺少運費的 ${stats.noShippingFee.length} 筆方案:`);
  const byShippingType = {};
  plans
    .filter(p => stats.noShippingFee.includes(p.id))
    .forEach(p => {
      const type = p.shippingType || 'unknown';
      byShippingType[type] = (byShippingType[type] || 0) + 1;
    });

  console.log(`  按配送方式分布:`);
  Object.entries(byShippingType).forEach(([type, count]) => {
    console.log(`    • ${type}: ${count} 筆`);
  });
  console.log(`  建議: delivery 類型一般運費 NT$60-200，pickup 為 0，both 需明細\n`);
}

// 為缺少配送距離的方案生成建議
if (stats.noMaxDistance.length > 0) {
  console.log(`[配送距離] 缺少 maxDistance 的 ${stats.noMaxDistance.length} 筆方案 (100%)`);
  console.log(`  建議: 根據 deliveryAreas 或 region 推斷，或設為預設值（如全台 = 999km）\n`);
}

// 導出缺失清單供後續補充
console.log('📋 導出缺失清單...');
const enrichmentGuide = {
  timestamp: new Date().toISOString(),
  totalPlans: plans.length,
  missingFieldsSummary: {
    dishes: { count: stats.noDishes.length, percentage: (stats.noDishes.length / plans.length * 100).toFixed(1) },
    imageUrl: { count: stats.noImageUrl.length, percentage: (stats.noImageUrl.length / plans.length * 100).toFixed(1) },
    shippingFee: { count: stats.noShippingFee.length, percentage: (stats.noShippingFee.length / plans.length * 100).toFixed(1) },
    maxDistance: { count: stats.noMaxDistance.length, percentage: (stats.noMaxDistance.length / plans.length * 100).toFixed(1) },
  },
  plansMissingDishes: stats.noDishes,
  plansMissingImageUrl: stats.noImageUrl,
  plansMissingShippingFee: stats.noShippingFee,
  plansMissingMaxDistance: stats.noMaxDistance,
};

fs.writeFileSync(
  path.join(__dirname, '../data/enrichment-guide.json'),
  JSON.stringify(enrichmentGuide, null, 2)
);

console.log('✅ 清單已導出到 data/enrichment-guide.json\n');

// 生成快速補充腳本建議
console.log('💡 快速補充建議:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\n方案 A - 使用 AI 自動補充:');
console.log('  1. 在管理後台使用 "AI 自動分類" 功能');
console.log('  2. 使用爬蟲管理台從原始 URL 重新提取菜色和運費\n');

console.log('方案 B - 手動補充:');
console.log('  1. 編輯每個缺少菜色的方案');
console.log('  2. 根據方案名稱和標籤填入典型菜色');
console.log('  3. 查詢官方網站確認運費\n');

console.log('方案 C - 批量導入:');
console.log('  1. 準備 CSV 文件，包含 ID、菜色、運費、距離');
console.log('  2. 使用管理後台的 "批量欄位編輯" 功能\n');
