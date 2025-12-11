/**
 * 資料補充腳本
 * 批次補充：運費、原價、截止日期等缺失資料
 */

const fs = require('fs');
const path = require('path');

const PLANS_FILE = path.join(__dirname, '../public/data/plans.json');

// 讀取現有資料
const plans = JSON.parse(fs.readFileSync(PLANS_FILE, 'utf-8'));

console.log('📊 資料補充開始...\n');
console.log(`總筆數: ${plans.length}`);

let enrichedCount = 0;

// 補充規則
const enrichmentRules = [
  // 1. 運費規則 - 根據配送方式和品牌推測
  {
    name: '運費補充',
    condition: (p) => p.shippingFee === null || p.shippingFee === undefined,
    enrich: (p) => {
      // 大品牌通常免運
      const freeShippingBrands = ['呷七碗', '老協珍', '欣葉', '山海樓', '漢來', 'Costco', '全聯'];
      const hasFreeShipping = freeShippingBrands.some(b =>
        p.vendorName.includes(b) || p.title.includes(b) || (p.tags || []).includes('免運')
      );

      // 全台宅配且價格超過一定金額通常免運
      const isExpensiveDelivery = p.region === 'nationwide' &&
        p.shippingTypes?.includes('delivery') &&
        p.priceDiscount >= 2000;

      if (hasFreeShipping || isExpensiveDelivery) {
        p.shippingFee = 0;
        if (!p.tags.includes('免運')) {
          p.tags.push('免運');
        }
        return true;
      }

      // 純自取的設為 null (不適用)
      if (p.shippingTypes?.length === 1 && p.shippingTypes[0] === 'pickup') {
        p.shippingFee = null;
        return false;
      }

      // 便利商店取貨通常免運
      if (p.shippingTypes?.includes('convenience')) {
        p.shippingFee = 0;
        return true;
      }

      return false;
    }
  },

  // 2. 原價推測 - 如果沒有原價，根據折扣價推算
  {
    name: '原價補充',
    condition: (p) => !p.priceOriginal && p.priceDiscount,
    enrich: (p) => {
      // 檢查標籤是否有折扣相關
      const hasDiscount = (p.tags || []).some(t =>
        t.includes('早鳥') || t.includes('優惠') || t.includes('折')
      );

      if (hasDiscount) {
        // 假設早鳥優惠大約是原價的 85-90%
        p.priceOriginal = Math.round(p.priceDiscount / 0.85);
        return true;
      }

      // 飯店級年菜通常有折扣
      if (p.vendorType === 'hotel') {
        p.priceOriginal = Math.round(p.priceDiscount / 0.88);
        return true;
      }

      return false;
    }
  },

  // 3. 截止日期推測
  {
    name: '截止日期補充',
    condition: (p) => !p.orderDeadline,
    enrich: (p) => {
      // 2026年春節是 1/29，通常截止日在 1/15-1/25
      // 根據配送方式設定不同截止日

      if (p.shippingTypes?.includes('delivery') && p.storageTypes?.includes('frozen')) {
        // 冷凍宅配通常較早截止 (需要出貨時間)
        p.orderDeadline = '2026-01-20';
        return true;
      }

      if (p.shippingTypes?.includes('pickup')) {
        // 自取可以較晚
        p.orderDeadline = '2026-01-25';
        return true;
      }

      // 預設
      p.orderDeadline = '2026-01-22';
      return true;
    }
  },

  // 4. 補充缺失的分類欄位
  {
    name: '分類欄位補充',
    condition: (p) => !p.vendorType || !p.productType || !p.cuisineStyle || !p.priceLevel || !p.familySize,
    enrich: (p) => {
      let changed = false;

      // vendorType
      if (!p.vendorType) {
        if ((p.tags || []).includes('飯店級') || p.vendorName.includes('飯店') || p.vendorName.includes('酒店')) {
          p.vendorType = 'hotel';
        } else if ((p.tags || []).includes('素食') || p.vendorName.includes('蔬食')) {
          p.vendorType = 'vegetarian';
        } else if (p.vendorName.includes('7-11') || p.vendorName.includes('全家')) {
          p.vendorType = 'convenience';
        } else {
          p.vendorType = 'restaurant';
        }
        changed = true;
      }

      // productType
      if (!p.productType) {
        if ((p.tags || []).includes('單品') || p.dishes?.length === 1) {
          p.productType = 'single';
        } else if ((p.tags || []).includes('伴手禮')) {
          p.productType = 'gift';
        } else {
          p.productType = 'combo';
        }
        changed = true;
      }

      // cuisineStyle
      if (!p.cuisineStyle) {
        const tags = p.tags || [];
        if (tags.includes('粵式')) p.cuisineStyle = 'cantonese';
        else if (tags.includes('台式')) p.cuisineStyle = 'taiwanese';
        else if (tags.includes('日式')) p.cuisineStyle = 'japanese';
        else if (tags.includes('川菜') || tags.includes('湘菜')) p.cuisineStyle = 'sichuan';
        else if (tags.includes('上海菜')) p.cuisineStyle = 'shanghai';
        else p.cuisineStyle = 'mixed';
        changed = true;
      }

      // priceLevel
      if (!p.priceLevel) {
        const price = p.priceDiscount;
        if (price < 2000) p.priceLevel = 'budget';
        else if (price < 5000) p.priceLevel = 'mid';
        else if (price < 10000) p.priceLevel = 'high';
        else p.priceLevel = 'luxury';
        changed = true;
      }

      // familySize
      if (!p.familySize) {
        const max = p.servingsMax || p.servingsMin;
        if (max <= 4) p.familySize = 'small';
        else if (max <= 6) p.familySize = 'medium';
        else if (max <= 8) p.familySize = 'large';
        else p.familySize = 'xl';
        changed = true;
      }

      return changed;
    }
  }
];

// 執行補充
for (const rule of enrichmentRules) {
  let count = 0;
  for (const plan of plans) {
    if (rule.condition(plan)) {
      if (rule.enrich(plan)) {
        count++;
      }
    }
  }
  if (count > 0) {
    console.log(`  ✅ ${rule.name}: ${count} 筆`);
    enrichedCount += count;
  }
}

// 儲存
fs.writeFileSync(PLANS_FILE, JSON.stringify(plans, null, 2));

console.log(`\n📊 補充完成！共補充 ${enrichedCount} 項資料`);

// 顯示補充後的統計
const stats = {
  hasShippingFee: plans.filter(p => p.shippingFee !== null && p.shippingFee !== undefined).length,
  hasOriginalPrice: plans.filter(p => p.priceOriginal).length,
  hasDeadline: plans.filter(p => p.orderDeadline).length,
  freeShipping: plans.filter(p => p.shippingFee === 0).length,
};

console.log('\n--- 補充後統計 ---');
console.log(`  運費資訊: ${stats.hasShippingFee}/${plans.length}`);
console.log(`  原價資訊: ${stats.hasOriginalPrice}/${plans.length}`);
console.log(`  截止日期: ${stats.hasDeadline}/${plans.length}`);
console.log(`  免運商品: ${stats.freeShipping}`);
