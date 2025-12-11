#!/usr/bin/env node
/**
 * 匯入 2026 年菜資料到資料庫
 * 使用方式: node scripts/import-niantsai.js
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/2026-niantsai-data.json');
const DB_FILE = path.join(__dirname, '../public/data/plans.json');

function generateId() {
  return 'plan_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function main() {
  console.log('📥 開始匯入 2026 年菜資料...\n');

  // 讀取年菜資料
  const niantsaiData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  console.log(`📋 讀取到 ${niantsaiData.length} 筆年菜資料\n`);

  // 讀取現有資料庫
  let existingPlans = [];
  if (fs.existsSync(DB_FILE)) {
    try {
      existingPlans = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
      console.log(`📁 現有資料庫有 ${existingPlans.length} 筆資料\n`);
    } catch (e) {
      console.log('⚠️ 無法讀取現有資料庫，將建立新檔案\n');
    }
  }

  // 建立現有資料的索引 (vendorName + title)
  const existingKeys = new Set(
    existingPlans.map(p => `${p.vendorName}::${p.title}`)
  );

  // 轉換為 Plan 格式，只匯入不存在的項目
  const now = new Date().toISOString();
  let skipped = 0;
  const newPlans = niantsaiData
    .filter(item => {
      const key = `${item.vendorName}::${item.title}`;
      if (existingKeys.has(key)) {
        skipped++;
        return false;
      }
      return true;
    })
    .map((item, index) => ({
      id: generateId() + '_' + index,
      vendorId: 'vendor_' + item.vendorName.replace(/\s/g, '_').toLowerCase(),
      vendorName: item.vendorName,
      title: item.title,
      description: item.description || '',
      imageUrl: item.imageUrl || '',
      images: item.images || [],
      priceOriginal: item.priceOriginal || null,
      priceDiscount: item.priceDiscount,
      shippingFee: item.shippingFee || null,
      shippingType: item.shippingType || 'delivery',
      storageType: item.storageType || 'frozen',
      pickupPoints: item.pickupPoints || [],
      deliveryAreas: item.deliveryAreas || [],
      region: item.region || 'nationwide',
      city: item.city || null,
      address: item.address || null,
      servingsMin: item.servingsMin || 4,
      servingsMax: item.servingsMax || item.servingsMin || 4,
      orderDeadline: item.orderDeadline || null,
      fulfillStart: item.fulfillStart || null,
      fulfillEnd: item.fulfillEnd || null,
      canSelectDate: item.canSelectDate || false,
      tags: item.tags || [],
      dishes: item.dishes || [],
      allergens: item.allergens || [],
      sourceUrl: item.sourceUrl || '',
      status: 'draft', // 預設為草稿，需要審核後才上架
      createdAt: now,
      updatedAt: now,
    }));

  console.log(`⏭️ 跳過重複項目: ${skipped} 筆\n`);

  // 合併資料
  const allPlans = [...existingPlans, ...newPlans];

  // 寫入資料庫
  fs.writeFileSync(DB_FILE, JSON.stringify(allPlans, null, 2));

  console.log('✅ 匯入完成！');
  console.log(`  📊 新增: ${newPlans.length} 筆`);
  console.log(`  📁 總計: ${allPlans.length} 筆`);
  console.log(`\n💡 請前往 http://localhost:4001/admin 審核並上架資料`);
}

main();
