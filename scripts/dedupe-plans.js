#!/usr/bin/env node
/**
 * 自動去重腳本
 *
 * 邏輯：
 * 1. 找出相同廠商 (vendorName) + 相同價格 (priceDiscount) 的方案
 * 2. 比較菜名 (dishes) 數量
 * 3. 保留菜名較多的方案，菜名較少的標記為 'duplicate' 狀態
 * 4. 記錄被標記為重複的方案，以及它對應的保留方案
 *
 * 使用方式: node scripts/dedupe-plans.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '../public/data/plans.json');
const isDryRun = process.argv.includes('--dry-run');

/**
 * 計算兩個方案的相似度
 * @param {Object} a 方案 A
 * @param {Object} b 方案 B
 * @returns {number} 相似度分數 0-1
 */
function calculateSimilarity(a, b) {
  // 檢查標題相似度
  const titleA = a.title.toLowerCase().replace(/\s+/g, '');
  const titleB = b.title.toLowerCase().replace(/\s+/g, '');

  // 如果標題完全相同
  if (titleA === titleB) return 1;

  // 計算標題包含關係
  if (titleA.includes(titleB) || titleB.includes(titleA)) return 0.9;

  // 計算菜名重疊度
  const dishesA = new Set(a.dishes || []);
  const dishesB = new Set(b.dishes || []);

  if (dishesA.size === 0 && dishesB.size === 0) {
    // 都沒有菜名，只能靠標題判斷
    return 0.5;
  }

  const intersection = [...dishesA].filter(d => dishesB.has(d));
  const union = new Set([...dishesA, ...dishesB]);

  // Jaccard 相似度
  const jaccard = intersection.length / union.size;

  return jaccard;
}

/**
 * 判斷哪個方案應該保留
 * @param {Object} a 方案 A
 * @param {Object} b 方案 B
 * @returns {Object} { keep: 保留的方案, duplicate: 被標記為重複的方案, reason: 原因 }
 */
function decideWhichToKeep(a, b) {
  const dishesA = a.dishes?.length || 0;
  const dishesB = b.dishes?.length || 0;

  // 優先保留菜名較多的
  if (dishesA > dishesB) {
    return { keep: a, duplicate: b, reason: `菜名數量: ${dishesA} > ${dishesB}` };
  }
  if (dishesB > dishesA) {
    return { keep: b, duplicate: a, reason: `菜名數量: ${dishesB} > ${dishesA}` };
  }

  // 菜名數量相同，比較其他欄位
  const scoreA = calculateCompleteness(a);
  const scoreB = calculateCompleteness(b);

  if (scoreA > scoreB) {
    return { keep: a, duplicate: b, reason: `資料完整度: ${scoreA} > ${scoreB}` };
  }
  if (scoreB > scoreA) {
    return { keep: b, duplicate: a, reason: `資料完整度: ${scoreB} > ${scoreA}` };
  }

  // 都一樣，保留較早建立的
  const dateA = new Date(a.createdAt);
  const dateB = new Date(b.createdAt);

  if (dateA < dateB) {
    return { keep: a, duplicate: b, reason: '較早建立' };
  }
  return { keep: b, duplicate: a, reason: '較早建立' };
}

/**
 * 計算方案的資料完整度分數
 */
function calculateCompleteness(plan) {
  let score = 0;

  if (plan.imageUrl) score += 2;
  if (plan.description) score += 1;
  if (plan.dishes?.length > 0) score += plan.dishes.length;
  if (plan.tags?.length > 0) score += plan.tags.length * 0.5;
  if (plan.priceOriginal) score += 1;
  if (plan.orderDeadline) score += 1;
  if (plan.fulfillStart) score += 1;
  if (plan.region) score += 0.5;
  if (plan.city) score += 0.5;

  return score;
}

function main() {
  console.log('🔍 開始自動去重分析...\n');

  if (isDryRun) {
    console.log('📋 模擬模式 (--dry-run)，不會實際修改資料\n');
  }

  // 讀取資料
  const plans = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  console.log(`📁 總共 ${plans.length} 筆資料\n`);

  // 建立索引：vendorName + priceDiscount => plans[]
  const priceIndex = new Map();

  for (const plan of plans) {
    // 跳過已經標記為 duplicate 的
    if (plan.status === 'duplicate') continue;

    const key = `${plan.vendorName}::${plan.priceDiscount}`;

    if (!priceIndex.has(key)) {
      priceIndex.set(key, []);
    }
    priceIndex.get(key).push(plan);
  }

  // 找出可能重複的組
  const potentialDuplicates = [];

  for (const [key, group] of priceIndex.entries()) {
    if (group.length > 1) {
      potentialDuplicates.push({ key, plans: group });
    }
  }

  console.log(`🔎 找到 ${potentialDuplicates.length} 組相同廠商+價格的方案\n`);

  if (potentialDuplicates.length === 0) {
    console.log('✅ 沒有需要處理的重複資料！');
    return;
  }

  // 分析每組並決定去重
  const duplicateResults = [];

  for (const { key, plans: groupPlans } of potentialDuplicates) {
    const [vendorName, price] = key.split('::');

    console.log(`\n📦 ${vendorName} - $${Number(price).toLocaleString()}`);
    console.log(`   共 ${groupPlans.length} 筆方案：`);

    groupPlans.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.title}`);
      console.log(`      菜名: ${p.dishes?.length || 0} 道 ${p.dishes?.slice(0, 3).join(', ') || '(無)'}${p.dishes?.length > 3 ? '...' : ''}`);
      console.log(`      來源: ${p.sourceUrl || '(無)'}`);
    });

    // 兩兩比較找出重複
    const processed = new Set();

    for (let i = 0; i < groupPlans.length; i++) {
      if (processed.has(groupPlans[i].id)) continue;

      for (let j = i + 1; j < groupPlans.length; j++) {
        if (processed.has(groupPlans[j].id)) continue;

        const similarity = calculateSimilarity(groupPlans[i], groupPlans[j]);

        console.log(`\n   比較 [${i + 1}] vs [${j + 1}]: 相似度 ${(similarity * 100).toFixed(0)}%`);

        // 相似度超過 50% 視為重複
        if (similarity >= 0.5) {
          const result = decideWhichToKeep(groupPlans[i], groupPlans[j]);

          console.log(`   ⚠️  判定為重複！`);
          console.log(`   ✅ 保留: ${result.keep.title}`);
          console.log(`   ❌ 標記: ${result.duplicate.title}`);
          console.log(`   📝 原因: ${result.reason}`);

          duplicateResults.push({
            keepId: result.keep.id,
            keepTitle: result.keep.title,
            duplicateId: result.duplicate.id,
            duplicateTitle: result.duplicate.title,
            similarity,
            reason: result.reason,
          });

          processed.add(result.duplicate.id);
        } else {
          console.log(`   ✓ 相似度低，視為不同方案`);
        }
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 去重結果：`);
  console.log(`   找到 ${duplicateResults.length} 筆重複資料需要標記\n`);

  if (duplicateResults.length === 0) {
    console.log('✅ 經分析後沒有需要標記的重複資料！');
    return;
  }

  // 顯示將要標記的資料
  console.log('將標記為 duplicate 的方案：');
  duplicateResults.forEach((r, i) => {
    console.log(`${i + 1}. ${r.duplicateTitle}`);
    console.log(`   -> 對應保留: ${r.keepTitle}`);
    console.log(`   -> 原因: ${r.reason}`);
  });

  if (isDryRun) {
    console.log('\n📋 模擬模式，不會實際修改。使用以下指令執行：');
    console.log('   node scripts/dedupe-plans.js');
    return;
  }

  // 執行標記
  const duplicateIds = new Set(duplicateResults.map(r => r.duplicateId));
  let markedCount = 0;

  for (const plan of plans) {
    if (duplicateIds.has(plan.id)) {
      const result = duplicateResults.find(r => r.duplicateId === plan.id);

      plan.status = 'duplicate';
      plan.duplicateOf = result.keepId;
      plan.duplicateReason = result.reason;
      plan.updatedAt = new Date().toISOString();

      markedCount++;
    }
  }

  // 寫回檔案
  fs.writeFileSync(DB_FILE, JSON.stringify(plans, null, 2));

  console.log(`\n✅ 完成！已標記 ${markedCount} 筆資料為 duplicate`);
  console.log('   這些資料在前台會被篩選掉（因為 onlyPublished 篩選）');
}

main();
