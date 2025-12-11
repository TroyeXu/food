import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { CreateReviewSchema, checkRateLimit, sanitizeInput, shouldModerateReview } from '@/lib/validations';

export const dynamic = 'force-dynamic';

interface ReviewQuery {
  planId?: string;
  sort?: 'recent' | 'helpful' | 'rating_high' | 'rating_low';
  limit?: number;
  offset?: number;
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
 * POST /api/reviews
 * 新增評價 - 含驗證和速率限制
 */
export async function POST(request: NextRequest) {
  try {
    // 獲取客戶端 IP 用於速率限制
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';

    // 檢查速率限制 (每個 IP 每分鐘最多 5 條評價)
    if (!checkRateLimit(`review_${clientIp}`, 5, 60000)) {
      return NextResponse.json(
        { error: '提交過於頻繁，請稍候後再試' },
        { status: 429 }
      );
    }

    // 驗證請求體
    const body = await request.json();
    const validationResult = CreateReviewSchema.safeParse(body);

    if (!validationResult.success) {
      const errors = validationResult.error.flatten().fieldErrors;
      const errorMsg = Object.entries(errors)
        .map(([field, msgs]) => `${field}: ${msgs?.join(', ') || '未知錯誤'}`)
        .join('; ');
      return NextResponse.json(
        { error: `驗證失敗: ${errorMsg}` },
        { status: 400 }
      );
    }

    const { planId, userName, rating, dimensionRatings, title, content } = validationResult.data;

    const db = await initReviewsDb();
    const statsDb = await initReviewStatsDb();

    // 生成安全的匿名 userId
    const userHash = crypto.randomUUID();

    // 清理用戶輸入以防止 XSS
    const sanitizedTitle = sanitizeInput(title);
    const sanitizedContent = sanitizeInput(content);
    const sanitizedUserName = userName ? sanitizeInput(userName) : undefined;

    // 自動檢測是否需要審核
    const needsModeration = shouldModerateReview(sanitizedTitle, sanitizedContent);

    const newReview = {
      id: crypto.randomUUID(),
      planId,
      userId: userHash,
      userName: sanitizedUserName || `用户_${userHash.substring(0, 8)}`,
      rating,
      dimensionRatings: dimensionRatings || {},
      title: sanitizedTitle,
      content: sanitizedContent,
      helpful: 0,
      unhelpful: 0,
      status: needsModeration ? 'flagged' : 'pending', // 'flagged' 表示自動檢測可能是垃圾，'pending' 表示待人工審核
      moderationReason: needsModeration ? '自動檢測到可疑內容' : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.reviews.push(newReview);
    await saveReviewsDb(db);

    // 更新統計 (只計算已發佈的評價)
    const stats = calculateStats(planId, db.reviews);
    statsDb.stats[planId] = stats;
    await saveReviewStatsDb(statsDb);

    return NextResponse.json(
      {
        ...newReview,
        message: '評價已提交，等待審核後發佈'
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[Reviews] Error posting review:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '新增評價失敗' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/reviews
 * 取得評價列表和統計
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const planId = searchParams.get('planId');
    const sort = (searchParams.get('sort') || 'recent') as string;
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    const db = await initReviewsDb();
    const statsDb = await initReviewStatsDb();

    if (!planId) {
      // 返回所有評價統計
      return NextResponse.json(statsDb.stats || {});
    }

    // 篩選該計劃的已發佈評價
    let reviews = db.reviews.filter(
      (r: any) => r.planId === planId && r.status === 'published'
    );

    // 排序
    if (sort === 'helpful') {
      reviews.sort((a: any, b: any) => b.helpful - a.helpful);
    } else if (sort === 'rating_high') {
      reviews.sort((a: any, b: any) => b.rating - a.rating);
    } else if (sort === 'rating_low') {
      reviews.sort((a: any, b: any) => a.rating - b.rating);
    } else {
      // 'recent' - 預設
      reviews.sort((a: any, b: any) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    // 分頁
    const paginatedReviews = reviews.slice(offset, offset + limit);

    // 取得統計
    const stats = statsDb.stats[planId] || calculateStats(planId, db.reviews);

    return NextResponse.json({
      reviews: paginatedReviews,
      stats,
      pagination: {
        total: reviews.length,
        limit,
        offset,
        hasMore: offset + limit < reviews.length,
      },
    });
  } catch (error) {
    console.error('[Reviews] Error fetching reviews:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '取得評價失敗' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/reviews
 * 標記評價有用/無用或回覆
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { reviewId, action, vendorReply } = body;

    if (!reviewId || !action) {
      return NextResponse.json(
        { error: '缺少必要欄位' },
        { status: 400 }
      );
    }

    const db = await initReviewsDb();
    const review = db.reviews.find((r: any) => r.id === reviewId);

    if (!review) {
      return NextResponse.json(
        { error: '評價不存在' },
        { status: 404 }
      );
    }

    if (action === 'helpful') {
      review.helpful++;
    } else if (action === 'unhelpful') {
      review.unhelpful++;
    } else if (action === 'reply' && vendorReply) {
      review.vendorReply = {
        content: vendorReply,
        respondedAt: new Date().toISOString(),
      };
    }

    review.updatedAt = new Date().toISOString();
    await saveReviewsDb(db);

    return NextResponse.json(review);
  } catch (error) {
    console.error('[Reviews] Error updating review:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新評價失敗' },
      { status: 500 }
    );
  }
}
