import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import {
  CreateShoppingListSchema,
  AddShoppingListItemSchema,
  checkRateLimit,
  sanitizeInput
} from '@/lib/validations';
import {
  generateTraceId,
  createSuccessResponse,
  createErrorResponse,
  ValidationError,
  NotFoundError,
  InternalError,
} from '@/lib/errors';

export const dynamic = 'force-dynamic';

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

const SHOPPING_LISTS_DB = path.join(process.cwd(), 'data', 'shopping-lists.json');

// 初始化購物清單數據庫
async function initDb() {
  try {
    await fs.access(SHOPPING_LISTS_DB);
    const data = await fs.readFile(SHOPPING_LISTS_DB, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { lists: {}, shares: {} };
  }
}

// 保存數據
async function saveDb(data: any) {
  await fs.mkdir(path.dirname(SHOPPING_LISTS_DB), { recursive: true });
  await fs.writeFile(SHOPPING_LISTS_DB, JSON.stringify(data, null, 2));
}

/**
 * POST /api/shopping-lists
 * 建立新清單 - 含驗證和速率限制
 */
export async function POST(request: NextRequest) {
  const traceId = generateTraceId();

  try {
    // 速率限制
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    if (!checkRateLimit(`shopping_list_${clientIp}`, 10, 60000)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: '操作過於頻繁，請稍候後再試',
            traceId,
          },
        },
        { status: 429, headers: { 'X-Trace-Id': traceId } }
      );
    }

    // 驗證請求
    const body = await request.json();
    const validationResult = CreateShoppingListSchema.safeParse(body);

    if (!validationResult.success) {
      const errors = validationResult.error.flatten().fieldErrors;
      const details = Object.fromEntries(
        Object.entries(errors).map(([field, msgs]) => [
          field,
          msgs?.join(', ') || '未知錯誤',
        ])
      );
      return createErrorResponse(
        new ValidationError('購物清單驗證失敗', details),
        traceId
      );
    }

    const { name, description } = validationResult.data;

    // 在開發模式使用 Prisma，否則使用 JSON 檔案
    if (isDevelopment) {
      const db = await getPrisma();
      const newList = await db.shoppingList.create({
        data: {
          name: sanitizeInput(name),
          description: description ? sanitizeInput(description) : undefined,
          isShared: false,
        },
        include: { items: true },
      });

      const response = createSuccessResponse(newList, 201);
      response.headers.set('X-Trace-Id', traceId);
      return response;
    }

    // 生產模式：使用 JSON 檔案
    const db = await initDb();
    const listId = crypto.randomUUID();

    const newList = {
      id: listId,
      name: sanitizeInput(name),
      description: description ? sanitizeInput(description) : '',
      items: [],
      isShared: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.lists[listId] = newList;
    await saveDb(db);

    const response = createSuccessResponse(newList, 201);
    response.headers.set('X-Trace-Id', traceId);
    return response;
  } catch (error) {
    console.error('[Shopping Lists] Error creating list:', error);
    return createErrorResponse(
      error instanceof Error ? new InternalError(error.message) : new InternalError(),
      traceId
    );
  }
}

/**
 * GET /api/shopping-lists
 * 取得清單列表或單個清單
 */
export async function GET(request: NextRequest) {
  const traceId = generateTraceId();

  try {
    const { searchParams } = new URL(request.url);
    const listId = searchParams.get('id');
    const shareCode = searchParams.get('share');

    if (isDevelopment) {
      const db = await getPrisma();

      if (listId) {
        const list = await db.shoppingList.findUnique({
          where: { id: listId },
          include: { items: { include: { plan: true } } },
        });

        if (!list) {
          return createErrorResponse(new NotFoundError('購物清單'), traceId);
        }

        const response = createSuccessResponse(list);
        response.headers.set('X-Trace-Id', traceId);
        return response;
      }

      const lists = await db.shoppingList.findMany({
        include: { items: true },
      });

      const response = createSuccessResponse({ lists });
      response.headers.set('X-Trace-Id', traceId);
      return response;
    }

    // 生產模式：使用 JSON 檔案
    const fileDb = await initDb();

    if (shareCode) {
      // 通過分享碼取得清單
      const sharedListId = fileDb.shares[shareCode];
      if (!sharedListId) {
        return createErrorResponse(new NotFoundError('分享鏈接'), traceId);
      }
      const list = fileDb.lists[sharedListId];
      if (!list) {
        return createErrorResponse(new NotFoundError('購物清單'), traceId);
      }
      const response = createSuccessResponse(list);
      response.headers.set('X-Trace-Id', traceId);
      return response;
    }

    if (listId) {
      // 取得單個清單
      const list = fileDb.lists[listId];
      if (!list) {
        return createErrorResponse(new NotFoundError('購物清單'), traceId);
      }
      const response = createSuccessResponse(list);
      response.headers.set('X-Trace-Id', traceId);
      return response;
    }

    // 取得所有清單
    const response = createSuccessResponse({
      lists: Object.values(fileDb.lists),
    });
    response.headers.set('X-Trace-Id', traceId);
    return response;
  } catch (error) {
    console.error('[Shopping Lists] Error fetching lists:', error);
    return createErrorResponse(
      error instanceof Error ? new InternalError(error.message) : new InternalError(),
      traceId
    );
  }
}

/**
 * PUT /api/shopping-lists
 * 更新清單
 */
export async function PUT(request: NextRequest) {
  const traceId = generateTraceId();

  try {
    const body = await request.json();
    const { id, name, description, items } = body;

    if (!id) {
      return createErrorResponse(
        new ValidationError('清單 ID 必填'),
        traceId
      );
    }

    if (isDevelopment) {
      const db = await getPrisma();
      const list = await db.shoppingList.findUnique({ where: { id } });

      if (!list) {
        return createErrorResponse(new NotFoundError('購物清單'), traceId);
      }

      const updatedList = await db.shoppingList.update({
        where: { id },
        data: {
          name: name ? sanitizeInput(name) : undefined,
          description: description ? sanitizeInput(description) : undefined,
        },
        include: { items: true },
      });

      const response = createSuccessResponse(updatedList);
      response.headers.set('X-Trace-Id', traceId);
      return response;
    }

    // 生產模式：使用 JSON 檔案
    const fileDb = await initDb();
    const list = fileDb.lists[id];

    if (!list) {
      return createErrorResponse(new NotFoundError('購物清單'), traceId);
    }

    // 更新欄位
    if (name !== undefined) list.name = sanitizeInput(name);
    if (description !== undefined) list.description = sanitizeInput(description);
    if (items !== undefined) {
      list.items = items.map((item: any) => ({
        ...item,
        addedAt: item.addedAt || new Date().toISOString(),
      }));
    }

    list.updatedAt = new Date().toISOString();
    await saveDb(fileDb);

    const response = createSuccessResponse(list);
    response.headers.set('X-Trace-Id', traceId);
    return response;
  } catch (error) {
    console.error('[Shopping Lists] Error updating list:', error);
    return createErrorResponse(
      error instanceof Error ? new InternalError(error.message) : new InternalError(),
      traceId
    );
  }
}

/**
 * DELETE /api/shopping-lists
 * 刪除清單
 */
export async function DELETE(request: NextRequest) {
  const traceId = generateTraceId();

  try {
    const { searchParams } = new URL(request.url);
    const listId = searchParams.get('id');

    if (!listId) {
      return createErrorResponse(
        new ValidationError('清單 ID 必填'),
        traceId
      );
    }

    if (isDevelopment) {
      const db = await getPrisma();
      const list = await db.shoppingList.findUnique({ where: { id: listId } });

      if (!list) {
        return createErrorResponse(new NotFoundError('購物清單'), traceId);
      }

      await db.shoppingList.delete({ where: { id: listId } });

      const response = createSuccessResponse({ success: true, id: listId });
      response.headers.set('X-Trace-Id', traceId);
      return response;
    }

    // 生產模式：使用 JSON 檔案
    const fileDb = await initDb();

    if (!fileDb.lists[listId]) {
      return createErrorResponse(new NotFoundError('購物清單'), traceId);
    }

    delete fileDb.lists[listId];

    // 刪除相關的分享鏈接
    Object.keys(fileDb.shares).forEach((code) => {
      if (fileDb.shares[code] === listId) {
        delete fileDb.shares[code];
      }
    });

    await saveDb(fileDb);

    const response = createSuccessResponse({ success: true, id: listId });
    response.headers.set('X-Trace-Id', traceId);
    return response;
  } catch (error) {
    console.error('[Shopping Lists] Error deleting list:', error);
    return createErrorResponse(
      error instanceof Error ? new InternalError(error.message) : new InternalError(),
      traceId
    );
  }
}
