const fs = require('fs');

const plans = JSON.parse(fs.readFileSync('./public/data/plans.json', 'utf-8'));

// 為主要廠商分配代表性圖片 URL
// 使用 Unsplash、Pexels 等免費圖片服務的年菜相關圖片
const vendorImages = {
  '老協珍': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80', // 年菜
  '呷七碗': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80',
  '蔡老師蔬食': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80',
  '彭園': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80',
  '海霸王': 'https://images.unsplash.com/photo-1564489551778-abb396281f4f?w=400&q=80', // 海鮮
  '鼎泰豐': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80',
  '台北福華大飯店': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80',
  '台北寒舍艾美酒店': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80',
  '板橋凱撒大飯店': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80',
  '福容大飯店': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80',
  '台北圓山大飯店': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80',
  '山海樓': 'https://images.unsplash.com/photo-1564489551778-abb396281f4f?w=400&q=80',
  '台北萬豪酒店': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80',
  '炒湘湘': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80',
  '新竹福華大飯店': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80',
  '台北新板希爾頓酒店': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80',
  '祥和蔬食': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80',
  '典華': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80',
  'Costco大成': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80',
  '台酒': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80',
};

console.log('\n🖼️  為廠商添加代表性圖片');
console.log('═══════════════════════════════════════════════════\n');

let updated = 0;
const updates = [];

plans.forEach(plan => {
  // 只更新無圖片的方案
  if (!plan.imageUrl || !plan.imageUrl.trim()) {
    const vendorImage = vendorImages[plan.vendorName];
    if (vendorImage) {
      plan.imageUrl = vendorImage;
      updated++;
      updates.push({
        planId: plan.id,
        vendor: plan.vendorName,
        title: plan.title,
        imageUrl: vendorImage,
      });
    }
  }
});

// 保存更新
fs.writeFileSync('./public/data/plans.json', JSON.stringify(plans, null, 2));

// 保存日誌
fs.writeFileSync('./data/vendor-images-log.json', JSON.stringify({
  timestamp: new Date().toISOString(),
  updated,
  totalPlans: plans.length,
  updates,
  summary: {
    message: `成功為 ${updated} 筆方案添加代表性圖片`,
    imageSource: 'Unsplash',
  }
}, null, 2));

console.log(`✅ 成功為 ${updated} 筆方案添加代表性圖片\n`);

// 驗證
const withImages = plans.filter(p => p.imageUrl && p.imageUrl.trim());
console.log(`📊 更新後統計:`);
console.log(`  • 有圖片: ${withImages.length}/${plans.length} (${(withImages.length/plans.length*100).toFixed(1)}%)`);
console.log(`  • 無圖片: ${plans.length - withImages.length}/${plans.length}\n`);

console.log('✨ 圖片 URL 補充完成！\n');
console.log('📝 詳細日誌已保存到 data/vendor-images-log.json\n');

// 打印樣本
console.log('📋 更新樣本:');
updates.slice(0, 5).forEach((u, i) => {
  console.log(`  ${i+1}. ${u.vendor} - ${u.title}`);
  console.log(`     URL: ${u.imageUrl.substring(0, 60)}...`);
});
if (updates.length > 5) {
  console.log(`  ... 及其他 ${updates.length - 5} 筆`);
}
console.log();
