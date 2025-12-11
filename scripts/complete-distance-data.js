const fs = require('fs');

const plans = JSON.parse(fs.readFileSync('./public/data/plans.json', 'utf-8'));

console.log('\n🗺️  補充配送距離資料');
console.log('═══════════════════════════════════════════════════\n');

// 根據地區和配送方式填補缺失的 maxDistance
const regionDistance = {
  'north': 100,
  'central': 150,
  'south': 200,
  'east': 250,
  'offshore': 300,
  'nationwide': 999,
};

const shippingTypeDistance = {
  'pickup': 0,       // 自取無配送距離
  'delivery': 100,   // 宅配標準距離
  'both': 100,       // 兼有模式取宅配距離
};

let updated = 0;
const updates = [];

plans.forEach(plan => {
  if (!plan.maxDistance || plan.maxDistance === 0) {
    let distance = 999; // 預設值

    // 優先使用配送方式判斷
    if (plan.shippingType === 'pickup') {
      distance = 0;
    } else if (plan.region) {
      // 根據地區設定
      distance = regionDistance[plan.region] || 999;
    }

    // 如果是全台配送，設為最大距離
    if (plan.deliveryAreas && plan.deliveryAreas.includes('nationwide')) {
      distance = 999;
    }

    if (distance !== plan.maxDistance) {
      const oldValue = plan.maxDistance || 'undefined';
      plan.maxDistance = distance;
      updated++;
      updates.push({
        planId: plan.id,
        vendor: plan.vendorName,
        title: plan.title,
        oldValue,
        newValue: distance,
        reason: `region: ${plan.region}, shippingType: ${plan.shippingType}`,
      });
    }
  }
});

// 保存更新
fs.writeFileSync('./public/data/plans.json', JSON.stringify(plans, null, 2));

// 保存日誌
fs.writeFileSync('./data/distance-completion-log.json', JSON.stringify({
  timestamp: new Date().toISOString(),
  updated,
  totalPlans: plans.length,
  updates: updates.slice(0, 50), // 只保存前 50 筆日誌
  summary: {
    message: `成功補充 ${updated} 筆方案的配送距離`,
    regionMapping: regionDistance,
    shippingTypeMapping: shippingTypeDistance,
  }
}, null, 2));

console.log(`✅ 成功補充 ${updated} 筆方案的配送距離\n`);

// 驗證
const withDistance = plans.filter(p => p.maxDistance !== undefined && p.maxDistance !== null);
const pickupOnly = plans.filter(p => p.shippingType === 'pickup' && p.maxDistance === 0);

console.log(`📊 更新後統計:`);
console.log(`  • 有配送距離: ${withDistance.length}/${plans.length} (${(withDistance.length/plans.length*100).toFixed(1)}%)`);
console.log(`  • 自取模式 (0km): ${pickupOnly.length} 筆`);
console.log(`  • 宅配平均: ~${(plans.filter(p => p.shippingType === 'delivery').reduce((sum, p) => sum + (p.maxDistance || 0), 0) / plans.filter(p => p.shippingType === 'delivery').length).toFixed(0)}km\n`);

// 距離分布
const distanceGroups = {
  'pickup (0km)': plans.filter(p => p.maxDistance === 0).length,
  'local (100km)': plans.filter(p => p.maxDistance === 100).length,
  'regional (150km)': plans.filter(p => p.maxDistance === 150).length,
  'regional (200km)': plans.filter(p => p.maxDistance === 200).length,
  'faraway (250km+)': plans.filter(p => p.maxDistance && p.maxDistance >= 250).length,
};

console.log('📈 配送距離分布:');
Object.entries(distanceGroups).forEach(([group, count]) => {
  if (count > 0) {
    console.log(`  • ${group}: ${count} 筆`);
  }
});

console.log('\n✨ 配送距離補充完成！\n');
console.log('📝 詳細日誌已保存到 data/distance-completion-log.json\n');

// 打印樣本
console.log('📋 更新樣本:');
updates.slice(0, 8).forEach((u, i) => {
  console.log(`  ${i+1}. ${u.vendor} - ${u.title}`);
  console.log(`     ${u.oldValue} → ${u.newValue}km (${u.reason})`);
});
if (updates.length > 8) {
  console.log(`  ... 及其他 ${updates.length - 8} 筆`);
}
console.log();
