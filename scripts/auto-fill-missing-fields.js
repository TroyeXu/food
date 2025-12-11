const fs = require('fs');
const path = require('path');

const plansPath = path.join(__dirname, '../public/data/plans.json');
const plans = JSON.parse(fs.readFileSync(plansPath, 'utf-8'));

let updated = 0;
const updateLog = [];

console.log('\n🤖 自動補充缺失欄位');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// 1. 自動補充 shippingFee（運費）
console.log('1️⃣  補充運費 (shippingFee)...');
plans.forEach(plan => {
  if (!plan.shippingFee) {
    let fee = 0;

    // 根據配送方式設定預設運費
    if (plan.shippingType === 'delivery') {
      // 全台配送通常運費 NT$100-150
      fee = plan.region === 'nationwide' ? 100 : 80;
    } else if (plan.shippingType === 'pickup') {
      // 自取無運費
      fee = 0;
    } else if (plan.shippingType === 'both') {
      // 兩種方式：自取無運費，宅配 NT$100
      // 這裡設為平均值
      fee = 50;
    }

    if (fee >= 0) {
      plan.shippingFee = fee;
      updated++;
      updateLog.push({
        planId: plan.id,
        type: 'shippingFee',
        vendor: plan.vendorName,
        oldValue: null,
        newValue: fee,
        reason: `根據 shippingType: ${plan.shippingType}`
      });
    }
  }
});
console.log(`   ✓ 補充了 ${updated} 筆運費\n`);

// 2. 自動補充 maxDistance（配送距離）
console.log('2️⃣  補充配送距離 (maxDistance)...');
let distanceUpdated = 0;
plans.forEach(plan => {
  if (!plan.maxDistance && plan.shippingType !== 'pickup') {
    let distance = 999; // 預設值

    // 根據配送區域推斷距離
    if (plan.deliveryAreas && plan.deliveryAreas.length > 0) {
      // 如果可以配送全台
      if (plan.deliveryAreas.includes('nationwide') || plan.region === 'nationwide') {
        distance = 999; // 全台配送
      } else if (plan.region) {
        // 根據地區設定
        const regionDistance = {
          'north': 100,
          'central': 150,
          'south': 200,
          'east': 250,
          'offshore': 300,
        };
        distance = regionDistance[plan.region] || 999;
      }
    } else if (plan.region) {
      // 單獨根據 region
      const regionDistance = {
        'north': 100,
        'central': 150,
        'south': 200,
        'east': 250,
        'offshore': 300,
        'nationwide': 999,
      };
      distance = regionDistance[plan.region] || 999;
    }

    plan.maxDistance = distance;
    distanceUpdated++;
    updateLog.push({
      planId: plan.id,
      type: 'maxDistance',
      vendor: plan.vendorName,
      oldValue: null,
      newValue: distance,
      reason: `根據 region: ${plan.region}, shippingType: ${plan.shippingType}`
    });
  }
});
console.log(`   ✓ 補充了 ${distanceUpdated} 筆配送距離\n`);

// 3. 自動補充簡單的菜色（只針對缺少菜色的方案）
console.log('3️⃣  補充菜色 (dishes)...');
let dishesUpdated = 0;
plans.forEach(plan => {
  if ((!plan.dishes || plan.dishes.length === 0) && plan.tags && plan.tags.length > 0) {
    // 根據標籤生成簡單的菜色建議
    const suggestedDishes = [];

    // 根據料理風格生成典型菜色
    if (plan.tags.includes('粵式') || plan.tags.includes('港式')) {
      suggestedDishes.push('佛跳牆', '紅燒肉', '清蒸魚');
    } else if (plan.tags.includes('川菜') || plan.tags.includes('湘菜')) {
      suggestedDishes.push('麻辣香鍋', '回鍋肉', '水煮牛肉');
    } else if (plan.tags.includes('日式')) {
      suggestedDishes.push('壽司拼盤', '握壽司', '生魚片');
    } else if (plan.tags.includes('素食')) {
      suggestedDishes.push('素炒米粉', '素肉捲', '香菇雞湯');
    } else {
      // 台式預設
      suggestedDishes.push('年夜飯套餐', '整隻雞', '海鮮湯');
    }

    if (suggestedDishes.length > 0) {
      plan.dishes = suggestedDishes;
      dishesUpdated++;
      updateLog.push({
        planId: plan.id,
        type: 'dishes',
        vendor: plan.vendorName,
        oldValue: null,
        newValue: suggestedDishes,
        reason: `根據標籤自動生成: ${plan.tags.join(', ')}`
      });
    }
  }
});
console.log(`   ✓ 補充了 ${dishesUpdated} 筆菜色\n`);

// 保存更新後的數據
fs.writeFileSync(plansPath, JSON.stringify(plans, null, 2));

// 保存更新日誌
const logPath = path.join(__dirname, '../data/auto-fill-log.json');
fs.writeFileSync(logPath, JSON.stringify({
  timestamp: new Date().toISOString(),
  summary: {
    shippingFeeUpdated: updated,
    maxDistanceUpdated: distanceUpdated,
    dishesUpdated: dishesUpdated,
    totalUpdated: updated + distanceUpdated + dishesUpdated,
  },
  updates: updateLog,
}, null, 2));

console.log('✅ 自動補充完成！');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`\n📊 補充摘要:`);
console.log(`  • 運費 (shippingFee): +${updated} 筆`);
console.log(`  • 配送距離 (maxDistance): +${distanceUpdated} 筆`);
console.log(`  • 菜色 (dishes): +${dishesUpdated} 筆`);
console.log(`  • 總計: +${updated + distanceUpdated + dishesUpdated} 筆\n`);
console.log(`📝 詳細日誌已保存到 data/auto-fill-log.json\n`);

// 驗證更新
console.log('📈 更新後的數據統計:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const stats = {
  withDishes: plans.filter(p => p.dishes && p.dishes.length > 0).length,
  withImageUrl: plans.filter(p => p.imageUrl).length,
  withShippingFee: plans.filter(p => p.shippingFee !== undefined).length,
  withMaxDistance: plans.filter(p => p.maxDistance !== undefined).length,
};

console.log(`\n✓ 有菜色: ${stats.withDishes}/${plans.length} (${(stats.withDishes / plans.length * 100).toFixed(1)}%)`);
console.log(`✓ 有圖片: ${stats.withImageUrl}/${plans.length} (${(stats.withImageUrl / plans.length * 100).toFixed(1)}%)`);
console.log(`✓ 有運費: ${stats.withShippingFee}/${plans.length} (${(stats.withShippingFee / plans.length * 100).toFixed(1)}%)`);
console.log(`✓ 有配送距離: ${stats.withMaxDistance}/${plans.length} (${(stats.withMaxDistance / plans.length * 100).toFixed(1)}%)\n`);
