#!/usr/bin/env node

/**
 * 環境檢查工具
 *
 * 驗證開發或生產環境是否正確配置
 *
 * 用法: node scripts/check-env.js
 */

const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFile(filePath, description) {
  const exists = fs.existsSync(filePath);
  const status = exists ? '✅' : '❌';
  const color = exists ? 'green' : 'red';
  log(`${status} ${description}: ${filePath}`, color);
  return exists;
}

function checkEnvVar(varName, required = false) {
  const value = process.env[varName];
  const status = value ? '✅' : required ? '❌' : '⚠️';
  const color = value ? 'green' : required ? 'red' : 'yellow';
  const displayValue = value ? `${value.substring(0, 30)}...` : '未設置';
  log(`${status} ${varName}: ${displayValue}`, color);
  return !!value;
}

function main() {
  log('\n📋 環境檢查報告', 'blue');
  log('='.repeat(50), 'blue');

  const nodeEnv = process.env.NODE_ENV || 'development';
  const isDev = nodeEnv === 'development';

  log(`\n📍 當前環境: ${isDev ? 'Development' : 'Production'}\n`);

  // 基本配置
  log('🔧 基本配置:', 'blue');
  log(`  NODE_ENV: ${nodeEnv}`, isDev ? 'green' : 'yellow');
  log(`  NEXT_PUBLIC_ENV: ${process.env.NEXT_PUBLIC_ENV || '未設置'}`);

  // 開發環境檢查
  if (isDev) {
    log('\n💾 開發模式 - PostgreSQL 配置:', 'blue');
    log('  DATABASE_URL:', checkEnvVar('DATABASE_URL', true) ? 'green' : 'red');

    // 嘗試解析連接字符串
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      try {
        const url = new URL(dbUrl);
        log(`    ✓ 主機: ${url.hostname}`, 'green');
        log(`    ✓ 端口: ${url.port || 5432}`, 'green');
        log(`    ✓ 數據庫: ${url.pathname.substring(1)}`, 'green');
        log(`    ✓ 用戶: ${url.username}`, 'green');
      } catch (e) {
        log(`    ❌ 無效的連接字符串格式`, 'red');
      }
    }
  } else {
    // 生產環境檢查
    log('\n📦 生產模式 - 靜態 JSON 配置:', 'blue');
    checkFile(path.join(process.cwd(), 'public/data/plans.json'), '  Plans 數據');
    checkFile(path.join(process.cwd(), 'public/data/vendors.json'), '  Vendors 數據');
  }

  // 文件檢查
  log('\n📁 關鍵文件:', 'blue');
  checkFile(path.join(process.cwd(), 'src/lib/config.ts'), '  配置模塊');
  checkFile(path.join(process.cwd(), 'src/lib/dataLayer.ts'), '  數據層');
  checkFile(path.join(process.cwd(), '.env.local'), '  環境變數文件');
  checkFile(path.join(process.cwd(), 'public/data'), '  數據目錄');

  // 環境變數檢查
  log('\n🔐 環境變數:', 'blue');
  checkEnvVar('NEXT_PUBLIC_API_URL', false);
  checkEnvVar('DEBUG', false);

  // npm scripts 檢查
  log('\n📜 可用的 npm scripts:', 'blue');
  const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'));
  const scripts = packageJson.scripts || {};
  const importantScripts = ['dev', 'build', 'export-data', 'deploy:prepare'];

  importantScripts.forEach((script) => {
    const exists = !!scripts[script];
    const status = exists ? '✅' : '❌';
    const color = exists ? 'green' : 'red';
    log(`  ${status} npm run ${script}`, color);
  });

  // 總結
  log('\n' + '='.repeat(50), 'blue');
  if (isDev) {
    log('✨ 開發環境配置檢查完成', 'green');
    log('\n建議:', 'yellow');
    log('  1. 確保 PostgreSQL 正在運行');
    log('  2. 驗證 DATABASE_URL 連接字符串');
    log('  3. 運行 npm run dev 啟動開發服務器');
  } else {
    log('✨ 生產環境配置檢查完成', 'green');
    log('\n建議:', 'yellow');
    log('  1. 確保 public/data/ 中有 JSON 文件');
    log('  2. 運行 npm run build 構建生產版本');
    log('  3. 運行 npm run start 預覽生產站點');
  }
  log('');
}

main();
