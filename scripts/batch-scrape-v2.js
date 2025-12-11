#!/usr/bin/env node
/**
 * 批次爬取 v2 - 優化版本
 * 特性：
 * - 自動重試機制（最多 3 次）
 * - 備用服務切換（jina → local → firecrawl）
 * - 斷點續爬（從上次失敗位置繼續）
 * - 更長的請求間隔避免 rate limit
 * - 進度保存
 *
 * 使用方式:
 *   node scripts/batch-scrape-v2.js              # 從頭開始
 *   node scripts/batch-scrape-v2.js --resume     # 繼續上次進度
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:4001';
const URLS_FILE = path.join(__dirname, '../data/2026-niantsai-urls-clean.txt');
const OUTPUT_FILE = path.join(__dirname, '../data/scrape-results-v2.json');
const PROGRESS_FILE = path.join(__dirname, '../data/scrape-progress.json');

// 設定
const CONFIG = {
  maxRetries: 3,           // 每個 URL 最多重試次數
  retryDelay: 5000,        // 重試間隔 (ms)
  requestDelay: 8000,      // 請求間隔 (ms) - 避免 rate limit
  services: ['jina', 'local'],  // 服務優先順序
  timeout: 60000,          // 請求超時 (ms)
};

// 讀取 URL 清單
function loadUrls() {
  const content = fs.readFileSync(URLS_FILE, 'utf-8');
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));
}

// 載入進度
function loadProgress() {
  if (fs.existsSync(PROGRESS_FILE)) {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
  }
  return { lastIndex: -1, results: [] };
}

// 保存進度
function saveProgress(index, results) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify({ lastIndex: index, results }, null, 2));
}

// 延遲函數
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// 爬取單一 URL（帶重試）
async function scrapeWithRetry(url, services = CONFIG.services) {
  for (const service of services) {
    for (let attempt = 1; attempt <= CONFIG.maxRetries; attempt++) {
      try {
        console.log(`    [${service}] 嘗試 ${attempt}/${CONFIG.maxRetries}...`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout);

        const response = await fetch(`${BASE_URL}/api/scrape`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, service }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        if (result.success) {
          return { success: true, service, data: result.data };
        }
        throw new Error(result.error || '未知錯誤');

      } catch (error) {
        const isLastAttempt = attempt === CONFIG.maxRetries;
        const isLastService = service === services[services.length - 1];

        console.log(`    ⚠️ 失敗: ${error.message}`);

        if (!isLastAttempt) {
          console.log(`    ⏳ 等待 ${CONFIG.retryDelay/1000} 秒後重試...`);
          await delay(CONFIG.retryDelay);
        } else if (!isLastService) {
          console.log(`    🔄 切換到下一個服務...`);
        }
      }
    }
  }

  return { success: false, error: '所有服務都失敗' };
}

// AI 解析（帶重試）
async function aiExtractWithRetry(scraped, url) {
  for (let attempt = 1; attempt <= CONFIG.maxRetries; attempt++) {
    try {
      console.log(`    🤖 AI 解析 (嘗試 ${attempt}/${CONFIG.maxRetries})...`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout * 2);

      const response = await fetch(`${BASE_URL}/api/ai-extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: scraped.content,
          images: scraped.images,
          hints: scraped.hints,
          url: url,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`AI HTTP ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        return result;
      }
      throw new Error(result.error || 'AI 解析失敗');

    } catch (error) {
      console.log(`    ⚠️ AI 錯誤: ${error.message}`);
      if (attempt < CONFIG.maxRetries) {
        console.log(`    ⏳ 等待 ${CONFIG.retryDelay/1000} 秒後重試...`);
        await delay(CONFIG.retryDelay);
      }
    }
  }

  return { success: false, error: 'AI 解析失敗（已重試）' };
}

// 過濾有效的產品頁 URL（排除搜索頁、首頁等）
function isValidProductUrl(url) {
  const invalidPatterns = [
    /\/search/i,
    /keyword=/i,
    /\?q=/i,
    /\/category\/?$/i,
    /\/collections\/?$/i,
    /^\w+:\/\/[^\/]+\/?$/,  // 純首頁
  ];

  return !invalidPatterns.some(pattern => pattern.test(url));
}

// 主程式
async function main() {
  const isResume = process.argv.includes('--resume');

  console.log('🚀 批次爬取 v2 - 優化版本');
  console.log('='.repeat(50));
  console.log(`  重試次數: ${CONFIG.maxRetries}`);
  console.log(`  請求間隔: ${CONFIG.requestDelay/1000} 秒`);
  console.log(`  服務順序: ${CONFIG.services.join(' → ')}`);
  console.log('='.repeat(50) + '\n');

  const urls = loadUrls();
  let progress = isResume ? loadProgress() : { lastIndex: -1, results: [] };

  if (isResume && progress.lastIndex >= 0) {
    console.log(`📂 繼續上次進度，從第 ${progress.lastIndex + 2} 筆開始\n`);
  }

  const startIndex = progress.lastIndex + 1;
  let successCount = progress.results.filter(r => r.success).length;
  let failCount = progress.results.filter(r => !r.success).length;

  console.log(`📋 共 ${urls.length} 個網址，從第 ${startIndex + 1} 筆開始\n`);

  for (let i = startIndex; i < urls.length; i++) {
    const url = urls[i];
    const progressStr = `[${i + 1}/${urls.length}]`;

    // 檢查 URL 是否有效
    if (!isValidProductUrl(url)) {
      console.log(`${progressStr} ⏭️ 跳過（非產品頁）: ${url.substring(0, 50)}...`);
      progress.results.push({ url, success: false, error: '非產品頁，已跳過', skipped: true });
      saveProgress(i, progress.results);
      continue;
    }

    console.log(`${progressStr} 爬取: ${url.substring(0, 60)}...`);

    // 爬取網頁
    const scrapeResult = await scrapeWithRetry(url);

    if (!scrapeResult.success) {
      console.log(`  ❌ 爬取失敗: ${scrapeResult.error}`);
      failCount++;
      progress.results.push({ url, success: false, error: scrapeResult.error });
      saveProgress(i, progress.results);
      await delay(CONFIG.requestDelay);
      continue;
    }

    console.log(`  ✓ 爬取成功 [${scrapeResult.service}]，內容: ${scrapeResult.data.contentLength} 字`);

    // AI 解析
    const aiResult = await aiExtractWithRetry(scrapeResult.data, url);

    if (aiResult.success && aiResult.data) {
      const vendorName = aiResult.data.vendorName || '未知廠商';
      const title = aiResult.data.title || '未知標題';
      console.log(`  ✅ 解析成功: ${vendorName} - ${title}`);
      successCount++;
      progress.results.push({
        url,
        success: true,
        service: scrapeResult.service,
        scraped: {
          title: scrapeResult.data.title,
          contentLength: scrapeResult.data.contentLength,
        },
        plan: aiResult.data,
      });
    } else {
      console.log(`  ⚠️ AI 解析失敗: ${aiResult.error}`);
      failCount++;
      progress.results.push({
        url,
        success: false,
        error: aiResult.error,
        scraped: scrapeResult.data,
      });
    }

    // 保存進度
    saveProgress(i, progress.results);

    // 顯示統計
    console.log(`  📊 目前統計: ✅${successCount} ❌${failCount}\n`);

    // 延遲避免 rate limit
    if (i < urls.length - 1) {
      console.log(`  ⏳ 等待 ${CONFIG.requestDelay/1000} 秒...\n`);
      await delay(CONFIG.requestDelay);
    }
  }

  // 寫入最終結果
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(progress.results, null, 2));

  // 清理進度檔案
  if (fs.existsSync(PROGRESS_FILE)) {
    fs.unlinkSync(PROGRESS_FILE);
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 爬取完成！');
  console.log(`  ✅ 成功: ${successCount}`);
  console.log(`  ❌ 失敗: ${failCount}`);
  console.log(`  ⏭️ 跳過: ${progress.results.filter(r => r.skipped).length}`);
  console.log(`  📁 結果: ${OUTPUT_FILE}`);
}

main().catch(console.error);
