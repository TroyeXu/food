import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';

const isDevelopment = process.env.NODE_ENV === 'development';

// 條件性地導入 Prisma（只在開發環境使用）
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

/**
 * GET /api/plans
 * 獲取計劃列表或單個計劃
 *
 * 查詢參數：
 * - id: 計劃 ID
 * - status: 計劃狀態 (DRAFT, NEEDS_REVIEW, PUBLISHED)
 * - vendorId: 廠商 ID
 * - limit: 返回數量限制 (預設 50)
 * - offset: 分頁偏移 (預設 0)
 */
export async function GET(request: NextRequest) {
  try {
    if (!isDevelopment) {
      return NextResponse.json(
        { error: 'This API is unavailable in production mode. Use static JSON data.' },
        { status: 503 }
      );
    }

    const db = await getPrisma();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const status = searchParams.get('status');
    const vendorId = searchParams.get('vendorId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (id) {
      // 獲取單個計劃
      const plan = await db.plan.findUnique({
        where: { id },
        include: {
          pickupPoints: true,
          extractions: true,
          reviews: {
            where: { status: 'PUBLISHED' },
            take: 5,
          },
        },
      });

      if (!plan) {
        return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
      }

      return NextResponse.json(plan);
    }

    // 獲取計劃列表
    const where: Prisma.PlanWhereInput = {};
    if (status) where.status = status as any;
    if (vendorId) where.vendorId = vendorId;

    const [plans, total] = await Promise.all([
      db.plan.findMany({
        where,
        include: { pickupPoints: true },
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      }),
      db.plan.count({ where }),
    ]);

    return NextResponse.json({
      plans,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('[Plans API] GET Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/plans
 * 建立新計劃
 */
export async function POST(request: NextRequest) {
  try {
    if (!isDevelopment) {
      return NextResponse.json(
        { error: 'Cannot create plans in production mode (read-only)' },
        { status: 405 }
      );
    }

    const db = await getPrisma();
    const body = await request.json();

    const plan = await db.plan.create({
      data: {
        vendorId: body.vendorId,
        vendorName: body.vendorName,
        title: body.title,
        description: body.description,
        imageUrl: body.imageUrl,
        priceDiscount: body.priceDiscount,
        shippingType: body.shippingType,
        storageType: body.storageType,
        servingsMin: body.servingsMin,
        status: body.status || 'DRAFT',
        tags: body.tags || [],
        dishes: body.dishes || [],
      },
      include: { pickupPoints: true },
    });

    return NextResponse.json(plan, { status: 201 });
  } catch (error) {
    console.error('[Plans API] POST Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/plans/:id
 * 更新計劃
 */
export async function PUT(request: NextRequest) {
  try {
    if (!isDevelopment) {
      return NextResponse.json(
        { error: 'Cannot update plans in production mode (read-only)' },
        { status: 405 }
      );
    }

    const db = await getPrisma();
    const id = request.url.split('/').pop();
    const body = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 });
    }

    const plan = await db.plan.update({
      where: { id },
      data: {
        ...body,
        updatedAt: new Date(),
      },
      include: { pickupPoints: true },
    });

    return NextResponse.json(plan);
  } catch (error) {
    console.error('[Plans API] PUT Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/plans/:id
 * 刪除計劃
 */
export async function DELETE(request: NextRequest) {
  try {
    if (!isDevelopment) {
      return NextResponse.json(
        { error: 'Cannot delete plans in production mode (read-only)' },
        { status: 405 }
      );
    }

    const db = await getPrisma();
    const id = request.url.split('/').pop();

    if (!id) {
      return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 });
    }

    await db.plan.delete({ where: { id } });

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('[Plans API] DELETE Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
