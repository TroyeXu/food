#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';

if (isGitHubActions) {
  console.log('🔒 GitHub Actions build: Removing admin, scraper and API routes...');

  const adminPath = path.join(__dirname, '../src/app/admin');
  const apiPath = path.join(__dirname, '../src/app/api');
  const scriptsPath = path.join(__dirname, '../scripts');
  const scraperLibPath = path.join(__dirname, '../src/lib/scraper.ts');
  const aiPromptPath = path.join(__dirname, '../src/lib/aiPrompt.ts');

  // 刪除 admin 目錄（正式環境不需要）
  if (fs.existsSync(adminPath)) {
    fs.rmSync(adminPath, { recursive: true, force: true });
    console.log('✓ Removed /admin route');
  }

  // 刪除 api 目錄（GitHub Pages 不支援 API routes）
  if (fs.existsSync(apiPath)) {
    fs.rmSync(apiPath, { recursive: true, force: true });
    console.log('✓ Removed /api routes');
  }

  // 刪除爬蟲相關檔案
  if (fs.existsSync(scraperLibPath)) {
    fs.rmSync(scraperLibPath, { force: true });
    console.log('✓ Removed scraper lib');
  }

  if (fs.existsSync(aiPromptPath)) {
    fs.rmSync(aiPromptPath, { force: true });
    console.log('✓ Removed aiPrompt lib');
  }

  console.log('✅ Production cleanup complete');
} else {
  console.log('🔧 Local build: Keeping all routes');
}
