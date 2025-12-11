import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import {
  generateTraceId,
  createSuccessResponse,
  createErrorResponse,
  ValidationError,
  NotFoundError,
  InternalError,
  AuthorizationError,
} from '@/lib/errors';
import {
  moderateContent,
  getModerationSummary,
  calculateModerationStats,
  type ModerationResult,
} from '@/lib/contentModeration';

export const dynamic = 'force-dynamic';

const isDevelopment = process.env.NODE_ENV === 'development';

// 簡易管理員驗證（實際應用應使用 JWT 或 session）
function isAdmin(request: NextRequest): boolean {
  const adminKey = request.headers.get('X-Admin-Key');
  const expectedKey = process.env.ADMIN_API_KEY || 'dev-admin-key';
  return adminKey === expectedKey;
}

// 條件性地導入 Prisma
let prismaCache: any = null;

async function getPrisma() {
  if (!isDevelopment) {
    throw new Error('Prisma is not available in production mode');
  }
  if (!prismaCache) {
    const { prisma: prismaClient } = await import('@/lib/prisma');
    prismaCache = prismaClient;
  }
  return prismaCache;
}

const REVIEWS_DB = path.join(process.cwd(), 'data', 'reviews.json');
const REVIEW_STATS_DB = path.join(process.cwd(), 'data', 'review-stats.json');

// 初始化評價數據庫
async function initReviewsDb() {
  try {
    await fs.access(REVIEWS_DB);
    const data = await fs.readFile(REVIEWS_DB, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { reviews: [] };
  }
}

// 初始化評價統計
async function initReviewStatsDb() {
  try {
    await fs.access(REVIEW_STATS_DB);
    const data = await fs.readFile(REVIEW_STATS_DB, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { stats: {} };
  }
}

// 保存評價
async function saveReviewsDb(data: any) {
  await fs.mkdir(path.dirname(REVIEWS_DB), { recursive: true });
  await fs.writeFile(REVIEWS_DB, JSON.stringify(data, null, 2));
}

// 保存統計
async function saveReviewStatsDb(data: any) {
  await fs.mkdir(path.dirname(REVIEW_STATS_DB), { recursive: true });
  await fs.writeFile(REVIEW_STATS_DB, JSON.stringify(data, null, 2));
}

// 計算評價統計
function calculateStats(planId: string, reviews: any[]) {
  const planReviews = reviews.filter((r) => r.planId === planId && r.status === 'published');

  if (planReviews.length === 0) {
    return {
      planId,
      totalReviews: 0,
      averageRating: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      dimensionAverages: {},
      lastReviewAt: null,
    };
  }

  const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let totalRating = 0;
  const dimensionTotals: Record<string, number> = {};
  const dimensionCounts: Record<string, number> = {};

  planReviews.forEach((review) => {
    ratingDistribution[review.rating]++;
    totalRating += review.rating;

    if (review.dimensionRatings) {
      Object.entries(review.dimensionRatings).forEach(([dim, rating]) => {
        dimensionTotals[dim] = (dimensionTotals[dim] || 0) + (rating as number);
        dimensionCounts[dim] = (dimensionCounts[dim] || 0) + 1;
      });
    }
  });

  const dimensionAverages: Record<string, number> = {};
  Object.entries(dimensionCounts).forEach(([dim, count]) => {
    dimensionAverages[dim] = dimensionTotals[dim] / count;
  });

  return {
    planId,
    totalReviews: planReviews.length,
    averageRating: totalRating / planReviews.length,
    ratingDistribution,
    dimensionAverages,
    lastReviewAt: planReviews[0]?.createdAt,
  };
}

/**
 * GET /api/admin/reviews
 * 取得待審核的評價列表
 *
 * 查詢參數：
 * - status: pending | published | rejected | flagged (預設 pending)
 * - limit: 數量限制 (預設 50)
 * - offset: 分頁偏移 (預設 0)
 * - autoModerate: 是否包含自動審核結果 (預設 true)
 */
export async function GET(request: NextRequest) {
  const traceId = generateTraceId();

  try {
    // 驗證管理員權限
    if (!isAdmin(request)) {
      return createErrorResponse(
        new AuthorizationError('需要管理員權限'),
        traceId
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const autoModerate = searchParams.get('autoModerate') !== 'false';

    const db = await initReviewsDb();

    // 篩選特定狀態的評價
    let reviews = db.reviews.filter((r: any) => r.status === status);

    // 按建立時間倒序
    reviews.sort((a: any, b: any) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // 自動審核每條評價
    if (autoModerate) {
      reviews = reviews.map((review: any) => {
        const moderationResult = moderateContent(review.title, review.content);
        return {
          ...review,
          moderation: {
            score: moderationResult.score,
            suggestion: moderationResult.suggestion,
            summary: getModerationSummary(moderationResult),
            flags: moderationResult.flags,
          },
        };
      });
    }

    // 分頁
    const paginatedReviews = reviews.slice(offset, offset + limit);

    // 計算審核統計
    const allModerationResults = db.reviews
      .filter((r: any) => r.status === 'pending' || r.status === 'flagged')
      .map((r: any) => moderateContent(r.title, r.content));
    const stats = calculateModerationStats(allModerationResults);

    const response = createSuccessResponse({
      reviews: paginatedReviews,
      pagination: {
        total: reviews.length,
        limit,
        offset,
        hasMore: offset + limit < reviews.length,
      },
      moderationStats: stats,
    });
    response.headers.set('X-Trace-Id', traceId);
    return response;
  } catch (error) {
    console.error('[Admin Reviews] Error fetching reviews:', error);
    return createErrorResponse(
      error instanceof Error ? new InternalError(error.message) : new InternalError(),
      traceId
    );
  }
}

/**
 * PATCH /api/admin/reviews
 * 批准或拒絕評價
 *
 * 請求體：
 * - reviewId: 評價 ID
 * - action: approve | reject | flag
 * - adminNotes: 管理員備註
 * - bulk: 批量操作的評價 ID 陣列（可選）
 */
export async function PATCH(request: NextRequest) {
  const traceId = generateTraceId();

  try {
    // 驗證管理員權限
    if (!isAdmin(request)) {
      return createErrorResponse(
        new AuthorizationError('需要管理員權限'),
        traceId
      );
    }

    const body = await request.json();
    const { reviewId, action, adminNotes, bulk } = body;

    // 批量操作
    if (bulk && Array.isArray(bulk)) {
      const db = await initReviewsDb();
      const statsDb = await initReviewStatsDb();
      const results: Array<{ id: string; success: boolean; message: string }> = [];
      const affectedPlanIds = new Set<string>();

      for (const id of bulk) {
        const review = db.reviews.find((r: any) => r.id === id);
        if (!review) {
          results.push({ id, success: false, message: '評價不存在' });
          continue;
        }

        if (action === 'approve') {
          review.status = 'published';
          review.publishedAt = new Date().toISOString();
          affectedPlanIds.add(review.planId);
        } else if (action === 'reject') {
          review.status = 'rejected';
          review.rejectionReason = adminNotes || '批量拒絕';
        } else if (action === 'flag') {
          review.status = 'flagged';
        }

        review.adminNotes = adminNotes;
        review.updatedAt = new Date().toISOString();
        results.push({ id, success: true, message: `已${action === 'approve' ? '發佈' : action === 'reject' ? '拒絕' : '標記'}` });
      }

      await saveReviewsDb(db);

      // 更新受影響的計劃統計
      for (const planId of affectedPlanIds) {
        const stats = calculateStats(planId, db.reviews);
        statsDb.stats[planId] = stats;
      }
      await saveReviewStatsDb(statsDb);

      const response = createSuccessResponse({
        success: true,
        results,
        message: `已處理 ${results.filter(r => r.success).length}/${bulk.length} 條評價`,
      });
      response.headers.set('X-Trace-Id', traceId);
      return response;
    }

    // 單個操作
    if (!reviewId || !action) {
      return createErrorResponse(
        new ValidationError('缺少必要欄位: reviewId, action'),
        traceId
      );
    }

    if (!['approve', 'reject', 'flag'].includes(action)) {
      return createErrorResponse(
        new ValidationError('action 必須是 approve、reject 或 flag'),
        traceId
      );
    }

    const db = await initReviewsDb();
    const statsDb = await initReviewStatsDb();
    const review = db.reviews.find((r: any) => r.id === reviewId);

    if (!review) {
      return createErrorResponse(new NotFoundError('評價'), traceId);
    }

    if (action === 'approve') {
      review.status = 'published';
      review.publishedAt = new Date().toISOString();
    } else if (action === 'reject') {
      review.status = 'rejected';
      review.rejectionReason = adminNotes || '審核未通過';
    } else if (action === 'flag') {
      review.status = 'flagged';
    }

    review.adminNotes = adminNotes;
    review.updatedAt = new Date().toISOString();

    await saveReviewsDb(db);

    // 更新統計（只有發佈的評價計入）
    if (action === 'approve') {
      const stats = calculateStats(review.planId, db.reviews);
      statsDb.stats[review.planId] = stats;
      await saveReviewStatsDb(statsDb);
    }

    const actionMessages: Record<string, string> = {
      approve: '評價已發佈',
      reject: '評價已拒絕',
      flag: '評價已標記待審',
    };

    const response = createSuccessResponse({
      success: true,
      review,
      message: actionMessages[action],
    });
    response.headers.set('X-Trace-Id', traceId);
    return response;
  } catch (error) {
    console.error('[Admin Reviews] Error modifying review:', error);
    return createErrorResponse(
      error instanceof Error ? new InternalError(error.message) : new InternalError(),
      traceId
    );
  }
}

/**
 * DELETE /api/admin/reviews
 * 刪除評價
 */
export async function DELETE(request: NextRequest) {
  const traceId = generateTraceId();

  try {
    // 驗證管理員權限
    if (!isAdmin(request)) {
      return createErrorResponse(
        new AuthorizationError('需要管理員權限'),
        traceId
      );
    }

    const { searchParams } = new URL(request.url);
    const reviewId = searchParams.get('id');

    if (!reviewId) {
      return createErrorResponse(
        new ValidationError('評價 ID 必填'),
        traceId
      );
    }

    const db = await initReviewsDb();
    const reviewIndex = db.reviews.findIndex((r: any) => r.id === reviewId);

    if (reviewIndex === -1) {
      return createErrorResponse(new NotFoundError('評價'), traceId);
    }

    const deletedReview = db.reviews.splice(reviewIndex, 1)[0];
    await saveReviewsDb(db);

    // 更新統計
    const statsDb = await initReviewStatsDb();
    if (deletedReview.planId) {
      const stats = calculateStats(deletedReview.planId, db.reviews);
      statsDb.stats[deletedReview.planId] = stats;
      await saveReviewStatsDb(statsDb);
    }

    const response = createSuccessResponse({
      success: true,
      message: '評價已刪除',
      deletedReview,
    });
    response.headers.set('X-Trace-Id', traceId);
    return response;
  } catch (error) {
    console.error('[Admin Reviews] Error deleting review:', error);
    return createErrorResponse(
      error instanceof Error ? new InternalError(error.message) : new InternalError(),
      traceId
    );
  }
}

/**
 * POST /api/admin/reviews/auto-moderate
 * 自動審核所有待審評價
 */
export async function POST(request: NextRequest) {
  const traceId = generateTraceId();

  try {
    // 驗證管理員權限
    if (!isAdmin(request)) {
      return createErrorResponse(
        new AuthorizationError('需要管理員權限'),
        traceId
      );
    }

    const body = await request.json();
    const { dryRun = true, autoApproveThreshold = 10, autoRejectThreshold = 50 } = body;

    const db = await initReviewsDb();
    const statsDb = await initReviewStatsDb();

    // 取得所有待審評價
    const pendingReviews = db.reviews.filter(
      (r: any) => r.status === 'pending' || r.status === 'flagged'
    );

    const results = {
      total: pendingReviews.length,
      autoApproved: 0,
      autoRejected: 0,
      needsManualReview: 0,
      details: [] as Array<{
        id: string;
        title: string;
        score: number;
        action: string;
        reason: string;
      }>,
    };

    const affectedPlanIds = new Set<string>();

    for (const review of pendingReviews) {
      const moderationResult = moderateContent(review.title, review.content);
      const score = moderationResult.score;
      let action = 'manual_review';
      let reason = getModerationSummary(moderationResult);

      if (score <= autoApproveThreshold) {
        action = 'auto_approve';
        results.autoApproved++;
        if (!dryRun) {
          review.status = 'published';
          review.publishedAt = new Date().toISOString();
          review.adminNotes = '自動審核通過';
          affectedPlanIds.add(review.planId);
        }
      } else if (score >= autoRejectThreshold) {
        action = 'auto_reject';
        results.autoRejected++;
        if (!dryRun) {
          review.status = 'rejected';
          review.rejectionReason = `自動拒絕: ${reason}`;
          review.adminNotes = `自動審核拒絕 (分數: ${score})`;
        }
      } else {
        results.needsManualReview++;
        if (!dryRun) {
          review.status = 'flagged';
          review.adminNotes = `需要人工審核 (分數: ${score})`;
        }
      }

      review.updatedAt = new Date().toISOString();

      results.details.push({
        id: review.id,
        title: review.title,
        score,
        action,
        reason,
      });
    }

    if (!dryRun) {
      await saveReviewsDb(db);

      // 更新受影響的計劃統計
      for (const planId of affectedPlanIds) {
        const stats = calculateStats(planId, db.reviews);
        statsDb.stats[planId] = stats;
      }
      await saveReviewStatsDb(statsDb);
    }

    const response = createSuccessResponse({
      success: true,
      dryRun,
      results,
      message: dryRun
        ? `預覽：將自動批准 ${results.autoApproved} 條，拒絕 ${results.autoRejected} 條，${results.needsManualReview} 條需人工審核`
        : `已處理 ${results.total} 條評價`,
    });
    response.headers.set('X-Trace-Id', traceId);
    return response;
  } catch (error) {
    console.error('[Admin Reviews] Error auto-moderating:', error);
    return createErrorResponse(
      error instanceof Error ? new InternalError(error.message) : new InternalError(),
      traceId
    );
  }
}
