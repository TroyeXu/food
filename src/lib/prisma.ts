/**
 * Prisma 客戶端實例
 *
 * 用途：
 * - 在開發模式下提供 PostgreSQL 數據庫訪問
 * - 支持 Next.js API 路由和服務器組件
 * - 處理連接池和優雅關閉
 */

import { PrismaClient } from '@prisma/client';

// 避免在 Next.js 開發中重複實例化
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    // 在生產環境中禁用冗長日誌
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/**
 * 連接健康檢查
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

/**
 * 優雅關閉
 */
export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
