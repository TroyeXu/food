const fs = require('fs');
const plans = JSON.parse(fs.readFileSync('./public/data/plans.json', 'utf-8'));

console.log('\n📸 圖片 URL 分析');
console.log('═══════════════════════════════════════════════════\n');

// 有圖片和無圖片的方案
const withImages = plans.filter(p => p.imageUrl && p.imageUrl.trim());
const withoutImages = plans.filter(p => !p.imageUrl || !p.imageUrl.trim());

console.log(`✓ 有圖片: ${withImages.length} 筆 (${(withImages.length/plans.length*100).toFixed(1)}%)`);
console.log(`✗ 無圖片: ${withoutImages.length} 筆 (${(withoutImages.length/plans.length*100).toFixed(1)}%)\n`);

console.log('無圖片的前 20 個方案:');
withoutImages.slice(0, 20).forEach((p, i) => {
  console.log(`  ${i+1}. ${p.vendorName} - ${p.title}`);
});

console.log('\n\n無圖片的廠商分布 (前 15):');
const vendorCount = {};
withoutImages.forEach(p => {
  vendorCount[p.vendorName] = (vendorCount[p.vendorName] || 0) + 1;
});

Object.entries(vendorCount)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 15)
  .forEach(([vendor, count], i) => {
    console.log(`  ${i+1}. ${vendor}: ${count} 筆`);
  });

// 分析有圖片方案的來源
console.log('\n\n有圖片的方案來源分析:');
const sources = {};
withImages.forEach(p => {
  try {
    const url = p.imageUrl || '';
    const domain = new URL(url).hostname;
    sources[domain] = (sources[domain] || 0) + 1;
  } catch (e) {
    sources['invalid-url'] = (sources['invalid-url'] || 0) + 1;
  }
});

Object.entries(sources)
  .sort((a, b) => b[1] - a[1])
  .forEach(([domain, count]) => {
    console.log(`  • ${domain}: ${count} 筆`);
  });

console.log('\n\n📊 建議補充方案:');
console.log('─────────────────────────────────────────────────\n');
console.log('1️⃣  按廠商重新爬蟲 (最有效)');
console.log('   - 針對缺圖片最多的廠商進行定向爬蟲');
console.log('   - 預計時間: 1-2 小時\n');

console.log('2️⃣  使用通用圖片 (快速方案)');
console.log('   - 為每個廠商提供一張代表性圖片');
console.log('   - 預計時間: 30 分鐘\n');

console.log('3️⃣  爬蟲服務自動提取 (推薦)');
console.log('   - 使用 Firecrawl 或 Jina 自動提取');
console.log('   - 預計時間: 2-3 小時\n');

// 匯出無圖片清單
const noImagesData = {
  timestamp: new Date().toISOString(),
  count: withoutImages.length,
  plans: withoutImages.map(p => ({
    id: p.id,
    vendorName: p.vendorName,
    title: p.title,
    sourceUrl: p.sourceUrl,
    region: p.region,
    city: p.city,
  }))
};

fs.writeFileSync('./data/plans-without-images.json', JSON.stringify(noImagesData, null, 2));
console.log('✅ 無圖片清單已導出到 data/plans-without-images.json\n');
