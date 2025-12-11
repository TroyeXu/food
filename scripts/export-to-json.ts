#!/usr/bin/env node

/**
 * 數據導出腳本
 *
 * 用途：在部署到生產環境前，從 PostgreSQL 導出所有數據為 JSON 文件
 *
 * 用法：
 *   npm run export-data
 *   或
 *   node scripts/export-to-json.ts
 *
 * 環境變數：
 *   DATABASE_URL: PostgreSQL 連接字符串
 *   OUTPUT_DIR: 輸出目錄（預設：public/data）
 */

import fs from 'fs/promises';
import path from 'path';
import type { Plan, Vendor } from '../src/types';

// 模擬數據庫查詢（實際需要連接真實 PostgreSQL）
async function exportPlansFromDatabase(): Promise<Plan[]> {
  // TODO: 使用 Prisma/TypeORM 連接真實數據庫
  // 示例：
  // const db = new PrismaClient();
  // const plans = await db.plan.findMany({
  //   include: { vendor: true },
  // });
  // return plans;

  console.log('📦 Fetching plans from database...');
  // 暫時返回空陣列 - 實現真實數據庫連接後替換
  return [];
}

async function exportVendorsFromDatabase(): Promise<Vendor[]> {
  // TODO: 使用 Prisma/TypeORM 連接真實數據庫
  // 示例：
  // const db = new PrismaClient();
  // const vendors = await db.vendor.findMany();
  // return vendors;

  console.log('📦 Fetching vendors from database...');
  return [];
}

async function exportData(): Promise<void> {
  try {
    const outputDir = process.env.OUTPUT_DIR || path.join(process.cwd(), 'public/data');
    const dbUrl = process.env.DATABASE_URL;

    console.log('\n🚀 開始數據導出...');
    console.log(`📍 輸出目錄: ${outputDir}`);
    console.log(`🔌 數據庫: ${dbUrl ? '已配置' : '未配置 - 將使用模擬數據'}\n`);

    // 確保輸出目錄存在
    await fs.mkdir(outputDir, { recursive: true });

    // 導出計劃數據
    console.log('📥 正在導出 Plans...');
    const plans = await exportPlansFromDatabase();
    const plansPath = path.join(outputDir, 'plans.json');
    await fs.writeFile(plansPath, JSON.stringify(plans, null, 2), 'utf-8');
    console.log(`✅ Plans 導出成功: ${plansPath}`);
    console.log(`   共 ${plans.length} 項計劃`);

    // 導出廠商數據
    console.log('\n📥 正在導出 Vendors...');
    const vendors = await exportVendorsFromDatabase();
    const vendorsPath = path.join(outputDir, 'vendors.json');
    await fs.writeFile(vendorsPath, JSON.stringify(vendors, null, 2), 'utf-8');
    console.log(`✅ Vendors 導出成功: ${vendorsPath}`);
    console.log(`   共 ${vendors.length} 家廠商`);

    // 導出統計信息
    const stats = {
      exportedAt: new Date().toISOString(),
      totalPlans: plans.length,
      totalVendors: vendors.length,
      plansPerVendor: vendors.map((v) => ({
        vendor: v.name,
        count: plans.filter((p) => p.vendorId === v.id).length,
      })),
    };

    const statsPath = path.join(outputDir, 'export-stats.json');
    await fs.writeFile(statsPath, JSON.stringify(stats, null, 2), 'utf-8');
    console.log(`\n📊 導出統計: ${statsPath}`);

    console.log('\n✨ 數據導出完成！');
    console.log(`\n  總結:`);
    console.log(`  - Plans: ${plans.length}`);
    console.log(`  - Vendors: ${vendors.length}`);
    console.log(`  - 輸出目錄: ${outputDir}`);
  } catch (error) {
    console.error('\n❌ 導出失敗:', error);
    process.exit(1);
  }
}

exportData();
