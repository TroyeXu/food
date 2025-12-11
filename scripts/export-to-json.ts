#!/usr/bin/env node

/**
 * 數據導出腳本
 *
 * 用途：在部署到生產環境前，從 PostgreSQL 導出所有數據為 JSON 文件
 *
 * 用法：
 *   npm run export-data
 *   或
 *   npx tsx scripts/export-to-json.ts
 *
 * 環境變數：
 *   DATABASE_URL: PostgreSQL 連接字符串
 *   OUTPUT_DIR: 輸出目錄（預設：public/data）
 *
 * 選項：
 *   --dry-run: 只顯示將導出的數據，不寫入文件
 *   --verbose: 顯示詳細輸出
 */

import fs from 'fs/promises';
import path from 'path';

// 類型定義
interface ExportConfig {
  outputDir: string;
  dryRun: boolean;
  verbose: boolean;
}

interface ExportStats {
  exportedAt: string;
  version: string;
  totalPlans: number;
  publishedPlans: number;
  totalVendors: number;
  totalReviews: number;
  publishedReviews: number;
  totalShoppingLists: number;
  plansByVendor: Array<{ vendor: string; count: number }>;
  plansByStatus: Record<string, number>;
  exportDuration: number;
}

// 解析命令行參數
function parseArgs(): ExportConfig {
  const args = process.argv.slice(2);
  return {
    outputDir: process.env.OUTPUT_DIR || path.join(process.cwd(), 'public/data'),
    dryRun: args.includes('--dry-run'),
    verbose: args.includes('--verbose'),
  };
}

// 日誌工具
function log(message: string, config: ExportConfig) {
  console.log(message);
}

function verboseLog(message: string, config: ExportConfig) {
  if (config.verbose) {
    console.log(`  [verbose] ${message}`);
  }
}

// 動態導入 Prisma（避免在沒有數據庫時失敗）
async function getPrismaClient() {
  try {
    const { PrismaClient } = await import('@prisma/client');
    return new PrismaClient();
  } catch (error) {
    console.error('❌ 無法載入 Prisma Client。請確保已運行 npx prisma generate');
    throw error;
  }
}

// 導出 Plans
async function exportPlans(prisma: any, config: ExportConfig) {
  log('📥 正在導出 Plans...', config);

  const plans = await prisma.plan.findMany({
    where: { status: 'PUBLISHED' }, // 只導出已發佈的
    include: {
      pickupPoints: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // 轉換為前端格式
  const formattedPlans = plans.map((plan: any) => ({
    id: plan.id,
    vendorId: plan.vendorId,
    vendorName: plan.vendorName,
    title: plan.title,
    description: plan.description,
    imageUrl: plan.imageUrl,
    images: plan.images,
    priceOriginal: plan.priceOriginal,
    priceDiscount: plan.priceDiscount,
    shippingFee: plan.shippingFee,
    shippingType: plan.shippingType.toLowerCase(),
    storageType: plan.storageType.toLowerCase(),
    servingsMin: plan.servingsMin,
    servingsMax: plan.servingsMax,
    orderDeadline: plan.orderDeadline?.toISOString(),
    fulfillStart: plan.fulfillStart?.toISOString(),
    fulfillEnd: plan.fulfillEnd?.toISOString(),
    canSelectDate: plan.canSelectDate,
    tags: plan.tags,
    dishes: plan.dishes,
    allergens: plan.allergens,
    vendorType: plan.vendorType?.toLowerCase(),
    productType: plan.productType?.toLowerCase(),
    cuisineStyle: plan.cuisineStyle?.toLowerCase(),
    priceLevel: plan.priceLevel?.toLowerCase(),
    familySize: plan.familySize?.toLowerCase(),
    region: plan.region?.toLowerCase(),
    city: plan.city,
    address: plan.address,
    sourceUrl: plan.sourceUrl,
    status: 'published',
    pickupPoints: plan.pickupPoints.map((p: any) => ({
      id: p.id,
      name: p.name,
      address: p.address,
      city: p.city,
      lat: p.lat,
      lng: p.lng,
      phone: p.phone,
      notes: p.notes,
      availableDates: p.availableDates,
    })),
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  }));

  verboseLog(`找到 ${plans.length} 個已發佈的 plans`, config);
  return formattedPlans;
}

// 導出 Vendors
async function exportVendors(prisma: any, config: ExportConfig) {
  log('📥 正在導出 Vendors...', config);

  const vendors = await prisma.vendor.findMany({
    orderBy: { name: 'asc' },
  });

  const formattedVendors = vendors.map((v: any) => ({
    id: v.id,
    name: v.name,
    website: v.website,
    phone: v.phone,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
  }));

  verboseLog(`找到 ${vendors.length} 家廠商`, config);
  return formattedVendors;
}

// 導出 Reviews
async function exportReviews(prisma: any, config: ExportConfig) {
  log('📥 正在導出 Reviews...', config);

  const reviews = await prisma.review.findMany({
    where: { status: 'PUBLISHED' }, // 只導出已發佈的
    include: {
      vendorReply: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const formattedReviews = reviews.map((r: any) => ({
    id: r.id,
    planId: r.planId,
    userId: r.userId,
    userName: r.userName,
    rating: r.rating,
    dimensionRatings: r.dimensionRatings,
    title: r.title,
    content: r.content,
    helpful: r.helpful,
    unhelpful: r.unhelpful,
    images: r.images,
    status: 'published',
    vendorReply: r.vendorReply
      ? {
          content: r.vendorReply.content,
          respondedAt: r.vendorReply.respondedAt.toISOString(),
        }
      : undefined,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  verboseLog(`找到 ${reviews.length} 個已發佈的評價`, config);
  return formattedReviews;
}

// 計算評價統計
function calculateReviewStats(reviews: any[]) {
  const statsByPlan: Record<string, any> = {};

  reviews.forEach((review) => {
    const planId = review.planId;
    if (!statsByPlan[planId]) {
      statsByPlan[planId] = {
        planId,
        totalReviews: 0,
        totalRating: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        dimensionTotals: {},
        dimensionCounts: {},
      };
    }

    const stats = statsByPlan[planId];
    stats.totalReviews++;
    stats.totalRating += review.rating;
    stats.ratingDistribution[review.rating]++;

    if (review.dimensionRatings) {
      Object.entries(review.dimensionRatings).forEach(([dim, rating]) => {
        stats.dimensionTotals[dim] = (stats.dimensionTotals[dim] || 0) + (rating as number);
        stats.dimensionCounts[dim] = (stats.dimensionCounts[dim] || 0) + 1;
      });
    }
  });

  // 計算平均值
  return Object.values(statsByPlan).map((stats: any) => {
    const dimensionAverages: Record<string, number> = {};
    Object.entries(stats.dimensionCounts).forEach(([dim, count]) => {
      dimensionAverages[dim] = stats.dimensionTotals[dim] / (count as number);
    });

    return {
      planId: stats.planId,
      totalReviews: stats.totalReviews,
      averageRating: stats.totalRating / stats.totalReviews,
      ratingDistribution: stats.ratingDistribution,
      dimensionAverages,
    };
  });
}

// 主導出函數
async function exportData() {
  const config = parseArgs();
  const startTime = Date.now();

  console.log('\n🚀 年菜比較系統 - 數據導出工具');
  console.log('═'.repeat(50));
  console.log(`📍 輸出目錄: ${config.outputDir}`);
  console.log(`📋 模式: ${config.dryRun ? '預覽 (dry-run)' : '實際導出'}`);
  console.log('═'.repeat(50));

  let prisma: any;

  try {
    // 連接數據庫
    log('\n🔌 連接數據庫...', config);
    prisma = await getPrismaClient();
    await prisma.$connect();
    log('✅ 數據庫連接成功', config);

    // 導出數據
    const plans = await exportPlans(prisma, config);
    const vendors = await exportVendors(prisma, config);
    const reviews = await exportReviews(prisma, config);
    const reviewStats = calculateReviewStats(reviews);

    // 計算統計
    const allPlans = await prisma.plan.findMany();
    const allReviews = await prisma.review.findMany();

    const stats: ExportStats = {
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
      totalPlans: allPlans.length,
      publishedPlans: plans.length,
      totalVendors: vendors.length,
      totalReviews: allReviews.length,
      publishedReviews: reviews.length,
      totalShoppingLists: 0, // 購物清單不導出到公開數據
      plansByVendor: vendors.map((v: any) => ({
        vendor: v.name,
        count: plans.filter((p: any) => p.vendorId === v.id).length,
      })),
      plansByStatus: allPlans.reduce((acc: Record<string, number>, p: any) => {
        acc[p.status] = (acc[p.status] || 0) + 1;
        return acc;
      }, {}),
      exportDuration: 0, // 將在最後更新
    };

    // 寫入文件
    if (!config.dryRun) {
      await fs.mkdir(config.outputDir, { recursive: true });

      // Plans
      const plansPath = path.join(config.outputDir, 'plans.json');
      await fs.writeFile(plansPath, JSON.stringify(plans, null, 2), 'utf-8');
      log(`✅ Plans 已寫入: ${plansPath}`, config);

      // Vendors
      const vendorsPath = path.join(config.outputDir, 'vendors.json');
      await fs.writeFile(vendorsPath, JSON.stringify(vendors, null, 2), 'utf-8');
      log(`✅ Vendors 已寫入: ${vendorsPath}`, config);

      // Reviews
      const reviewsPath = path.join(config.outputDir, 'reviews.json');
      await fs.writeFile(
        reviewsPath,
        JSON.stringify({ reviews, stats: reviewStats }, null, 2),
        'utf-8'
      );
      log(`✅ Reviews 已寫入: ${reviewsPath}`, config);

      // Review Stats
      const reviewStatsPath = path.join(config.outputDir, 'review-stats.json');
      await fs.writeFile(
        reviewStatsPath,
        JSON.stringify({ stats: Object.fromEntries(reviewStats.map((s) => [s.planId, s])) }, null, 2),
        'utf-8'
      );
      log(`✅ Review Stats 已寫入: ${reviewStatsPath}`, config);

      // Export Stats
      stats.exportDuration = Date.now() - startTime;
      const statsPath = path.join(config.outputDir, 'export-stats.json');
      await fs.writeFile(statsPath, JSON.stringify(stats, null, 2), 'utf-8');
      log(`✅ Export Stats 已寫入: ${statsPath}`, config);
    }

    // 顯示摘要
    console.log('\n' + '═'.repeat(50));
    console.log('📊 導出摘要');
    console.log('═'.repeat(50));
    console.log(`  Plans:    ${plans.length} 個 (已發佈)`);
    console.log(`  Vendors:  ${vendors.length} 家`);
    console.log(`  Reviews:  ${reviews.length} 個 (已發佈)`);
    console.log(`  耗時:     ${Date.now() - startTime}ms`);

    if (config.dryRun) {
      console.log('\n⚠️  這是預覽模式，沒有實際寫入文件');
      console.log('  使用 npm run export-data 進行實際導出');
    } else {
      console.log(`\n✨ 導出完成！文件已保存到: ${config.outputDir}`);
    }
  } catch (error) {
    console.error('\n❌ 導出失敗:', error);
    process.exit(1);
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
  }
}

// 運行導出
exportData();
