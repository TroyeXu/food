#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const plans = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/data/plans.json'), 'utf-8'));

console.log('總筆數:', plans.length);
console.log('');

// 檢查資料完整性
const issues = {
  noVendorName: plans.filter(p => !p.vendorName || p.vendorName === '未知' || p.vendorName === '').length,
  noTitle: plans.filter(p => !p.title || p.title === '未知' || p.title === '').length,
  noPrice: plans.filter(p => !p.priceDiscount || p.priceDiscount === 0).length,
  noServings: plans.filter(p => !p.servingsMin).length,
  noDishes: plans.filter(p => !p.dishes || p.dishes.length === 0).length,
  noImageUrl: plans.filter(p => !p.imageUrl).length,
  noVendorType: plans.filter(p => !p.vendorType).length,
  noProductType: plans.filter(p => !p.productType).length,
  noCuisineStyle: plans.filter(p => !p.cuisineStyle).length,
  noSourceUrl: plans.filter(p => !p.sourceUrl).length,
};

console.log('=== 資料完整性問題 ===');
Object.entries(issues).forEach(([k, v]) => {
  if (v > 0) console.log(`  ${k}: ${v} 筆`);
});

// 列出有問題的資料
console.log('\n=== 問題資料範例 ===');
const problemPlans = plans.filter(p =>
  !p.vendorName || p.vendorName === '未知' || p.vendorName === '' ||
  !p.title || p.title === '未知' || p.title === '' ||
  !p.priceDiscount || p.priceDiscount === 0
);
console.log(`有 ${problemPlans.length} 筆資料缺少必要欄位:`);
problemPlans.slice(0, 10).forEach(p => {
  console.log(`  - ${p.vendorName || '(無廠商)'} | ${p.title || '(無標題)'} | $${p.priceDiscount || 0}`);
  console.log(`    sourceUrl: ${p.sourceUrl || '(無來源)'}`);
});

console.log('');
console.log('=== 欄位分布統計 ===');

// vendorType 分布
const vendorTypes = {};
plans.forEach(p => {
  const t = p.vendorType || 'undefined';
  vendorTypes[t] = (vendorTypes[t] || 0) + 1;
});
console.log('vendorType:', JSON.stringify(vendorTypes));

// productType 分布
const productTypes = {};
plans.forEach(p => {
  const t = p.productType || 'undefined';
  productTypes[t] = (productTypes[t] || 0) + 1;
});
console.log('productType:', JSON.stringify(productTypes));

// cuisineStyle 分布
const cuisineStyles = {};
plans.forEach(p => {
  const t = p.cuisineStyle || 'undefined';
  cuisineStyles[t] = (cuisineStyles[t] || 0) + 1;
});
console.log('cuisineStyle:', JSON.stringify(cuisineStyles));

// shippingType 分布
const shippingTypes = {};
plans.forEach(p => {
  const t = p.shippingType || 'undefined';
  shippingTypes[t] = (shippingTypes[t] || 0) + 1;
});
console.log('shippingType:', JSON.stringify(shippingTypes));

// storageType 分布
const storageTypes = {};
plans.forEach(p => {
  const t = p.storageType || 'undefined';
  storageTypes[t] = (storageTypes[t] || 0) + 1;
});
console.log('storageType:', JSON.stringify(storageTypes));

// priceLevel 分布
const priceLevels = {};
plans.forEach(p => {
  const t = p.priceLevel || 'undefined';
  priceLevels[t] = (priceLevels[t] || 0) + 1;
});
console.log('priceLevel:', JSON.stringify(priceLevels));

// familySize 分布
const familySizes = {};
plans.forEach(p => {
  const t = p.familySize || 'undefined';
  familySizes[t] = (familySizes[t] || 0) + 1;
});
console.log('familySize:', JSON.stringify(familySizes));

// 價格範圍
const prices = plans.map(p => p.priceDiscount).filter(p => p > 0);
console.log('');
console.log('=== 價格範圍 ===');
console.log('最低:', Math.min(...prices));
console.log('最高:', Math.max(...prices));
console.log('平均:', Math.round(prices.reduce((a,b)=>a+b,0)/prices.length));

// 檢查新欄位
console.log('');
console.log('=== 新欄位檢查 ===');
const hasShippingTypes = plans.filter(p => p.shippingTypes && p.shippingTypes.length > 0).length;
const hasStorageTypes = plans.filter(p => p.storageTypes && p.storageTypes.length > 0).length;
const hasShippingFee = plans.filter(p => p.shippingFee !== undefined).length;
const hasMaxDistance = plans.filter(p => p.maxDistance !== undefined).length;
console.log(`shippingTypes (陣列): ${hasShippingTypes}/${plans.length}`);
console.log(`storageTypes (陣列): ${hasStorageTypes}/${plans.length}`);
console.log(`shippingFee: ${hasShippingFee}/${plans.length}`);
console.log(`maxDistance: ${hasMaxDistance}/${plans.length}`);
