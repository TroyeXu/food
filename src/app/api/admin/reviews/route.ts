import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

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
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const db = await initReviewsDb();

    // 篩選特定狀態的評價
    let reviews = db.reviews.filter((r: any) => r.status === status);

    // 按建立時間倒序
    reviews.sort((a: any, b: any) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // 分頁
    const paginatedReviews = reviews.slice(offset, offset + limit);

    return NextResponse.json({
      reviews: paginatedReviews,
      pagination: {
        total: reviews.length,
        limit,
        offset,
        hasMore: offset + limit < reviews.length,
      },
    });
  } catch (error) {
    console.error('[Admin Reviews] Error fetching reviews:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '取得評價失敗' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/reviews
 * 批准或拒絕評價
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { reviewId, action, adminNotes } = body;

    if (!reviewId || !action) {
      return NextResponse.json(
        { error: '缺少必要欄位: reviewId, action' },
        { status: 400 }
      );
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'action 必須是 approve 或 reject' },
        { status: 400 }
      );
    }

    const db = await initReviewsDb();
    const statsDb = await initReviewStatsDb();
    const review = db.reviews.find((r: any) => r.id === reviewId);

    if (!review) {
      return NextResponse.json(
        { error: '評價不存在' },
        { status: 404 }
      );
    }

    if (action === 'approve') {
      review.status = 'published';
      review.publishedAt = new Date().toISOString();
    } else if (action === 'reject') {
      review.status = 'rejected';
      review.rejectionReason = adminNotes || '審核未通過';
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

    return NextResponse.json({
      success: true,
      review,
      message: action === 'approve' ? '評價已發佈' : '評價已拒絕',
    });
  } catch (error) {
    console.error('[Admin Reviews] Error modifying review:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新評價失敗' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/reviews
 * 刪除評價
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reviewId = searchParams.get('id');

    if (!reviewId) {
      return NextResponse.json(
        { error: '評價 ID 必填' },
        { status: 400 }
      );
    }

    const db = await initReviewsDb();
    const reviewIndex = db.reviews.findIndex((r: any) => r.id === reviewId);

    if (reviewIndex === -1) {
      return NextResponse.json(
        { error: '評價不存在' },
        { status: 404 }
      );
    }

    const deletedReview = db.reviews.splice(reviewIndex, 1)[0];
    await saveReviewsDb(db);

    return NextResponse.json({
      success: true,
      message: '評價已刪除',
      deletedReview,
    });
  } catch (error) {
    console.error('[Admin Reviews] Error deleting review:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '刪除評價失敗' },
      { status: 500 }
    );
  }
}
