#!/usr/bin/env node
/**
 * 資料修復腳本
 * 為現有資料補齊缺失欄位（shippingTypes、storageTypes）
 * 使用方式: node scripts/fix-data.js
 */

const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '../public/data/plans.json');

// 從 tags 和標題推斷配送方式
function inferShippingTypes(plan) {
  const types = [];
  const text = [plan.title, plan.description || '', ...(plan.tags || [])].join(' ').toLowerCase();

  // 檢查宅配
  if (text.includes('宅配') || text.includes('配送') || text.includes('到府') || text.includes('冷凍')) {
    types.push('delivery');
  }

  // 檢查自取
  if (text.includes('自取') || text.includes('取貨') || text.includes('門市') || text.includes('現場')) {
    types.push('pickup');
  }

  // 檢查超商
  if (text.includes('超商') || text.includes('7-11') || text.includes('全家') || text.includes('萊爾富')) {
    types.push('convenience');
  }

  // 從舊的 shippingType 欄位推導
  if (types.length === 0 && plan.shippingType) {
    if (plan.shippingType === 'both') {
      types.push('delivery', 'pickup');
    } else {
      types.push(plan.shippingType);
    }
  }

  // 預設宅配
  return types.length > 0 ? types : ['delivery'];
}

// 從 tags 和標題推斷保存方式
function inferStorageTypes(plan) {
  const types = [];
  const text = [plan.title, plan.description || '', ...(plan.tags || [])].join(' ').toLowerCase();

  // 檢查冷凍
  if (text.includes('冷凍') || text.includes('frozen') || text.includes('急凍')) {
    types.push('frozen');
  }

  // 檢查冷藏
  if (text.includes('冷藏') || text.includes('鮮食') || text.includes('新鮮')) {
    types.push('chilled');
  }

  // 檢查常溫
  if (text.includes('常溫') || text.includes('室溫') || text.includes('乾貨')) {
    types.push('room_temp');
  }

  // 從舊的 storageType 欄位推導
  if (types.length === 0 && plan.storageType && plan.storageType !== 'unknown') {
    types.push(plan.storageType);
  }

  // 年菜大多是冷凍
  return types.length > 0 ? types : ['frozen'];
}

// 從 tags 推斷運費
function inferShippingFee(plan) {
  const text = [plan.title, plan.description || '', ...(plan.tags || [])].join(' ');

  if (text.includes('免運') || text.includes('免費配送') || text.includes('運費0')) {
    return 0;
  }

  // 滿額免運
  if (text.match(/滿\d+免運/)) {
    return 0; // 假設會達到免運門檻
  }

  return plan.shippingFee; // 保持原值
}

function main() {
  console.log('🔧 開始資料修復...\n');

  // 讀取資料
  const plans = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  console.log(`📁 讀取到 ${plans.length} 筆資料\n`);

  // 統計
  const stats = {
    addedShippingTypes: 0,
    addedStorageTypes: 0,
    addedShippingFee: 0,
    fixedOriginalPrice: 0,
  };

  // 處理每筆資料
  const fixedPlans = plans.map(plan => {
    const fixed = { ...plan };

    // 補充 shippingTypes
    if (!fixed.shippingTypes || fixed.shippingTypes.length === 0) {
      fixed.shippingTypes = inferShippingTypes(plan);
      stats.addedShippingTypes++;
    }

    // 補充 storageTypes
    if (!fixed.storageTypes || fixed.storageTypes.length === 0) {
      fixed.storageTypes = inferStorageTypes(plan);
      stats.addedStorageTypes++;
    }

    // 補充運費
    if (fixed.shippingFee === undefined || fixed.shippingFee === null) {
      const inferredFee = inferShippingFee(plan);
      if (inferredFee !== undefined && inferredFee !== null) {
        fixed.shippingFee = inferredFee;
        stats.addedShippingFee++;
      }
    }

    // 修復原價（如果折扣價存在但原價不存在，且 tags 有優惠相關）
    if (!fixed.priceOriginal && fixed.priceDiscount) {
      const text = [...(plan.tags || [])].join(' ');
      if (text.includes('早鳥') || text.includes('優惠') || text.includes('特價')) {
        // 估算原價（約 +10~15%）
        fixed.priceOriginal = Math.round(fixed.priceDiscount * 1.1);
        stats.fixedOriginalPrice++;
      }
    }

    fixed.updatedAt = new Date().toISOString();

    return fixed;
  });

  // 寫入
  fs.writeFileSync(DB_FILE, JSON.stringify(fixedPlans, null, 2));

  // 輸出統計
  console.log('📈 修復統計：\n');
  console.log(`  補充 shippingTypes: ${stats.addedShippingTypes} 筆`);
  console.log(`  補充 storageTypes: ${stats.addedStorageTypes} 筆`);
  console.log(`  補充運費: ${stats.addedShippingFee} 筆`);
  console.log(`  推估原價: ${stats.fixedOriginalPrice} 筆`);

  console.log('\n✅ 資料修復完成！');
}

main();
