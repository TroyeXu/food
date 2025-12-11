#!/usr/bin/env node
/**
 * 爬蟲佇列管理工具
 *
 * 使用方式:
 *   node scripts/scrape-queue.js add <url>           # 新增 URL 到佇列
 *   node scripts/scrape-queue.js add-file <file>     # 從檔案批量新增
 *   node scripts/scrape-queue.js list                # 查看佇列
 *   node scripts/scrape-queue.js run [count]         # 執行佇列（預設 5 筆）
 *   node scripts/scrape-queue.js daemon [interval]   # 定時執行（預設 60 秒）
 *   node scripts/scrape-queue.js export              # 匯出完成的資料到 new-plans.json
 *   node scripts/scrape-queue.js clear               # 清空佇列
 *   node scripts/scrape-queue.js retry-failed        # 重試失敗的項目
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const QUEUE_FILE = path.join(__dirname, '../data/scrape-queue.json');
const NEW_PLANS_FILE = path.join(__dirname, '../data/new-plans.json');
const DB_FILE = path.join(__dirname, '../public/data/plans.json');
const BASE_URL = 'http://localhost:3000';

// 定時器狀態
let daemonRunning = false;
let daemonInterval = null;

// 初始化佇列
function initQueue() {
  if (!fs.existsSync(QUEUE_FILE)) {
    fs.writeFileSync(QUEUE_FILE, JSON.stringify({
      pending: [],
      processing: [],
      completed: [],
      failed: [],
    }, null, 2));
  }
  return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf-8'));
}

// 保存佇列
function saveQueue(queue) {
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
}

// 新增 URL
function addUrl(url, priority = 'normal') {
  const queue = initQueue();

  // 檢查是否已存在
  const allUrls = [...queue.pending, ...queue.processing, ...queue.completed, ...queue.failed];
  if (allUrls.some(item => item.url === url)) {
    console.log(`⚠️ URL 已存在: ${url}`);
    return;
  }

  queue.pending.push({
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    url,
    priority,
    addedAt: new Date().toISOString(),
    retryCount: 0,
  });

  saveQueue(queue);
  console.log(`✅ 已新增: ${url}`);
}

// 從檔案批量新增
function addFromFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const urls = content.split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));

  console.log(`📂 從 ${filePath} 載入 ${urls.length} 個 URL\n`);

  urls.forEach(url => addUrl(url));
}

// 列出佇列
function listQueue() {
  const queue = initQueue();

  console.log('📋 爬蟲佇列狀態\n');
  console.log(`  ⏳ 待處理: ${queue.pending.length}`);
  console.log(`  🔄 處理中: ${queue.processing.length}`);
  console.log(`  ✅ 已完成: ${queue.completed.length}`);
  console.log(`  ❌ 失敗:   ${queue.failed.length}`);

  if (queue.pending.length > 0) {
    console.log('\n待處理項目（前 10 筆）:');
    queue.pending.slice(0, 10).forEach((item, i) => {
      console.log(`  ${i + 1}. ${item.url.substring(0, 60)}...`);
    });
  }

  if (queue.failed.length > 0) {
    console.log('\n失敗項目:');
    queue.failed.forEach((item, i) => {
      console.log(`  ${i + 1}. ${item.url.substring(0, 50)}... (${item.error})`);
    });
  }
}

// 延遲函數
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// 執行爬取
async function scrapeUrl(url, service = 'local') {
  try {
    const response = await fetch(`${BASE_URL}/api/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, service }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// AI 解析 - 使用 firecrawl 作為爬蟲服務（fallback 到 local）
async function aiExtract(scraped, url) {
  // 嘗試的服務順序：firecrawl -> local
  const services = ['firecrawl', 'local'];

  for (const service of services) {
    try {
      console.log(`    嘗試 ${service}...`);
      const response = await fetch(`${BASE_URL}/api/ai-extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          service,
          cli: 'claude',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`    ${service} 失敗: HTTP ${response.status}`);
        continue; // 嘗試下一個服務
      }

      const result = await response.json();
      if (result.success) {
        console.log(`    ${service} 成功！`);
        // 回傳第一筆解析結果
        return {
          success: true,
          data: result.data?.parsed?.[0] || result.data
        };
      }
    } catch (error) {
      console.log(`    ${service} 錯誤: ${error.message}`);
      continue;
    }
  }

  return { success: false, error: '所有爬蟲服務都失敗' };
}

// 執行佇列
async function runQueue(count = 5) {
  const queue = initQueue();

  if (queue.pending.length === 0) {
    console.log('📭 佇列為空');
    return;
  }

  const toProcess = Math.min(count, queue.pending.length);
  console.log(`🚀 開始處理 ${toProcess} 筆...\n`);

  for (let i = 0; i < toProcess; i++) {
    const item = queue.pending.shift();
    queue.processing.push(item);
    saveQueue(queue);

    console.log(`[${i + 1}/${toProcess}] ${item.url.substring(0, 50)}...`);

    // 直接呼叫 AI 解析（會自動爬取）
    console.log('  🤖 爬取 + AI 解析中...');
    const aiResult = await aiExtract(null, item.url);

    if (aiResult.success && aiResult.data) {
      console.log(`  ✅ 完成: ${aiResult.data.vendorName || '未知'} - ${aiResult.data.title || '未知'}`);
      item.result = aiResult.data;
      item.completedAt = new Date().toISOString();
      queue.processing = queue.processing.filter(p => p.id !== item.id);
      queue.completed.push(item);
    } else {
      console.log(`  ❌ 失敗: ${aiResult.error}`);
      item.error = aiResult.error;
      item.failedAt = new Date().toISOString();
      queue.processing = queue.processing.filter(p => p.id !== item.id);
      queue.failed.push(item);
    }

    saveQueue(queue);
    console.log('');

    if (i < toProcess - 1) {
      await delay(5000);
    }
  }

  console.log('📊 處理完成！');
  listQueue();
}

// 清空佇列
function clearQueue() {
  fs.writeFileSync(QUEUE_FILE, JSON.stringify({
    pending: [],
    processing: [],
    completed: [],
    failed: [],
  }, null, 2));
  console.log('🗑️ 佇列已清空');
}

// 重試失敗項目
function retryFailed() {
  const queue = initQueue();

  if (queue.failed.length === 0) {
    console.log('✅ 沒有失敗項目');
    return;
  }

  console.log(`🔄 將 ${queue.failed.length} 個失敗項目移回待處理...\n`);

  queue.failed.forEach(item => {
    item.retryCount = (item.retryCount || 0) + 1;
    delete item.error;
    delete item.failedAt;
    queue.pending.push(item);
  });

  queue.failed = [];
  saveQueue(queue);

  listQueue();
}

// 匯出完成的資料到 new-plans.json
function exportCompleted() {
  const queue = initQueue();

  if (queue.completed.length === 0) {
    console.log('📭 沒有已完成的項目可匯出');
    return 0;
  }

  // 讀取現有 new-plans.json（如有）
  let existingPlans = [];
  if (fs.existsSync(NEW_PLANS_FILE)) {
    try {
      existingPlans = JSON.parse(fs.readFileSync(NEW_PLANS_FILE, 'utf-8'));
    } catch (e) {
      existingPlans = [];
    }
  }

  // 提取完成項目的 result
  const newPlans = queue.completed
    .filter(item => item.result)
    .map(item => ({
      ...item.result,
      sourceUrl: item.url,
    }));

  console.log(`📤 匯出 ${newPlans.length} 筆資料到 new-plans.json`);

  // 合併並寫入
  const allPlans = [...existingPlans, ...newPlans];
  fs.writeFileSync(NEW_PLANS_FILE, JSON.stringify(allPlans, null, 2));

  // 清空 completed
  queue.completed = [];
  saveQueue(queue);

  return newPlans.length;
}

// 將 new-plans.json 匯入主資料庫
function importToDatabase() {
  if (!fs.existsSync(NEW_PLANS_FILE)) {
    console.log('📭 new-plans.json 不存在');
    return 0;
  }

  const newPlans = JSON.parse(fs.readFileSync(NEW_PLANS_FILE, 'utf-8'));
  if (newPlans.length === 0) {
    console.log('📭 new-plans.json 為空');
    return 0;
  }

  const existingPlans = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  const existingKeys = new Set(existingPlans.map(p => `${p.vendorName}::${p.title}`));

  let addedCount = 0;
  const addedPlans = [];

  for (const plan of newPlans) {
    const key = `${plan.vendorName}::${plan.title}`;
    if (existingKeys.has(key)) continue;

    // 補充分類欄位
    const fullPlan = {
      id: crypto.randomBytes(16).toString('hex'),
      vendorId: crypto.randomBytes(16).toString('hex'),
      ...plan,
      status: 'published',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addedPlans.push(fullPlan);
    existingKeys.add(key);
    addedCount++;
  }

  if (addedCount > 0) {
    const allPlans = [...existingPlans, ...addedPlans];
    fs.writeFileSync(DB_FILE, JSON.stringify(allPlans, null, 2));
    console.log(`✅ 已匯入 ${addedCount} 筆到資料庫，總計 ${allPlans.length} 筆`);

    // 清空 new-plans.json
    fs.writeFileSync(NEW_PLANS_FILE, '[]');
  }

  return addedCount;
}

// 定時執行 daemon
async function startDaemon(intervalSeconds = 60, batchSize = 3) {
  console.log(`\n🤖 啟動定時爬蟲 Daemon`);
  console.log(`   間隔: ${intervalSeconds} 秒`);
  console.log(`   每批: ${batchSize} 筆`);
  console.log(`   按 Ctrl+C 停止\n`);

  daemonRunning = true;

  // 處理程式終止信號
  process.on('SIGINT', () => {
    console.log('\n\n🛑 收到停止信號，正在關閉...');
    daemonRunning = false;
    if (daemonInterval) clearInterval(daemonInterval);

    // 匯出並匯入剩餘資料
    const exported = exportCompleted();
    if (exported > 0) {
      importToDatabase();
    }

    listQueue();
    process.exit(0);
  });

  // 執行中的標記
  let isProcessing = false;

  // 執行一次
  const runOnce = async () => {
    // 如果正在處理中，跳過這次執行
    if (isProcessing) {
      console.log(`[${new Date().toLocaleTimeString()}] ⏳ 上一批還在處理中，跳過...`);
      return;
    }

    const queue = initQueue();

    // 如果有項目卡在 processing，移回 pending
    if (queue.processing.length > 0) {
      console.log(`[${new Date().toLocaleTimeString()}] 🔧 發現 ${queue.processing.length} 個卡住的項目，移回待處理...`);
      queue.pending.unshift(...queue.processing);
      queue.processing = [];
      saveQueue(queue);
    }

    if (queue.pending.length === 0) {
      console.log(`[${new Date().toLocaleTimeString()}] 📭 佇列為空，等待中...`);

      // 如果有完成的項目，匯出並匯入
      if (queue.completed.length > 0) {
        const exported = exportCompleted();
        if (exported > 0) {
          importToDatabase();
        }
      }
      return;
    }

    isProcessing = true;
    console.log(`\n[${new Date().toLocaleTimeString()}] 🚀 開始處理...`);
    await runQueue(batchSize);
    isProcessing = false;

    // 每次執行完畢後匯出並匯入
    const exported = exportCompleted();
    if (exported > 0) {
      importToDatabase();
    }
  };

  // 立即執行一次
  await runOnce();

  // 設定定時器
  daemonInterval = setInterval(async () => {
    if (!daemonRunning) return;
    await runOnce();
  }, intervalSeconds * 1000);

  // 保持程式運行
  await new Promise(() => {});
}

// 主程式
async function main() {
  const [,, command, arg] = process.argv;

  switch (command) {
    case 'add':
      if (!arg) {
        console.log('請提供 URL');
        return;
      }
      addUrl(arg);
      break;

    case 'add-file':
      if (!arg) {
        console.log('請提供檔案路徑');
        return;
      }
      addFromFile(arg);
      break;

    case 'list':
      listQueue();
      break;

    case 'run':
      await runQueue(parseInt(arg) || 5);
      break;

    case 'clear':
      clearQueue();
      break;

    case 'retry-failed':
      retryFailed();
      break;

    case 'daemon':
      const interval = parseInt(arg) || 60;
      const batch = parseInt(process.argv[4]) || 3;
      await startDaemon(interval, batch);
      break;

    case 'export':
      const exported = exportCompleted();
      if (exported > 0) {
        console.log(`\n準備匯入資料庫...`);
        importToDatabase();
      }
      break;

    case 'import':
      importToDatabase();
      break;

    default:
      console.log(`
爬蟲佇列管理工具

使用方式:
  node scripts/scrape-queue.js add <url>              # 新增 URL
  node scripts/scrape-queue.js add-file <file>        # 從檔案批量新增
  node scripts/scrape-queue.js list                   # 查看佇列
  node scripts/scrape-queue.js run [count]            # 執行（預設 5 筆）
  node scripts/scrape-queue.js daemon [秒] [每批筆數]  # 定時執行（預設 60 秒, 3 筆）
  node scripts/scrape-queue.js export                 # 匯出完成資料並匯入資料庫
  node scripts/scrape-queue.js import                 # 將 new-plans.json 匯入資料庫
  node scripts/scrape-queue.js clear                  # 清空佇列
  node scripts/scrape-queue.js retry-failed           # 重試失敗項目

範例:
  node scripts/scrape-queue.js daemon 30 5     # 每 30 秒執行 5 筆
  node scripts/scrape-queue.js daemon 120      # 每 120 秒執行 3 筆
      `);
  }
}

main().catch(console.error);
