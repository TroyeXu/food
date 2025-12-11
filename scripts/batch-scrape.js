#!/usr/bin/env node
/**
 * 批次爬取 2026 年菜網址
 * 使用方式: node scripts/batch-scrape.js
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:4001';
const URLS_FILE = path.join(__dirname, '../data/2026-niantsai-urls-clean.txt');
const OUTPUT_FILE = path.join(__dirname, '../data/scrape-results.json');

// 讀取 URL 清單
function loadUrls() {
  const content = fs.readFileSync(URLS_FILE, 'utf-8');
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));
}

// 延遲函數
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// 爬取單一 URL
async function scrapeUrl(url) {
  try {
    const response = await fetch(`${BASE_URL}/api/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, service: 'local' }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    return { url, success: true, data: result.data };
  } catch (error) {
    return { url, success: false, error: error.message };
  }
}

// AI 解析
async function aiExtract(scraped) {
  try {
    const response = await fetch(`${BASE_URL}/api/ai-extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: scraped.content,
        images: scraped.images,
        hints: scraped.hints,
        url: scraped.url,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 主程式
async function main() {
  console.log('🚀 開始批次爬取 2026 年菜網址...\n');

  const urls = loadUrls();
  console.log(`📋 共 ${urls.length} 個網址\n`);

  const results = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const progress = `[${i + 1}/${urls.length}]`;

    console.log(`${progress} 爬取: ${url.substring(0, 60)}...`);

    // 爬取網頁
    const scrapeResult = await scrapeUrl(url);

    if (!scrapeResult.success) {
      console.log(`  ❌ 爬取失敗: ${scrapeResult.error}`);
      failCount++;
      results.push({ url, success: false, error: scrapeResult.error });
      await delay(1000);
      continue;
    }

    console.log(`  ✓ 爬取成功，內容長度: ${scrapeResult.data.contentLength}`);

    // AI 解析
    console.log(`  🤖 AI 解析中...`);
    const aiResult = await aiExtract(scrapeResult.data);

    if (aiResult.success && aiResult.data) {
      console.log(`  ✅ 解析成功: ${aiResult.data.vendorName || '未知廠商'} - ${aiResult.data.title || '未知標題'}`);
      successCount++;
      results.push({
        url,
        success: true,
        scraped: {
          title: scrapeResult.data.title,
          images: scrapeResult.data.images?.slice(0, 5),
        },
        plan: aiResult.data,
      });
    } else {
      console.log(`  ⚠️ AI 解析失敗: ${aiResult.error || '未知錯誤'}`);
      failCount++;
      results.push({
        url,
        success: false,
        error: aiResult.error || 'AI 解析失敗',
        scraped: scrapeResult.data,
      });
    }

    // 儲存中間結果
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));

    // 延遲避免 rate limit
    await delay(2000);
  }

  console.log('\n' + '='.repeat(50));
  console.log(`📊 爬取完成！`);
  console.log(`  ✅ 成功: ${successCount}`);
  console.log(`  ❌ 失敗: ${failCount}`);
  console.log(`  📁 結果儲存至: ${OUTPUT_FILE}`);
}

main().catch(console.error);
