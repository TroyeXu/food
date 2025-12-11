import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

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
 * 建立新清單
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, items = [] } = body;

    if (!name) {
      return NextResponse.json({ error: '清單名稱必填' }, { status: 400 });
    }

    const db = await initDb();
    const listId = `list_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const newList = {
      id: listId,
      name,
      description: description || '',
      items: items.map((item: any) => ({
        ...item,
        addedAt: new Date().toISOString(),
      })),
      isShared: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.lists[listId] = newList;
    await saveDb(db);

    return NextResponse.json(newList, { status: 201 });
  } catch (error) {
    console.error('[Shopping Lists] Error creating list:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '建立清單失敗' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/shopping-lists
 * 取得清單列表或單個清單
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const listId = searchParams.get('id');
    const shareCode = searchParams.get('share');

    const db = await initDb();

    if (shareCode) {
      // 通過分享碼取得清單
      const sharedListId = db.shares[shareCode];
      if (!sharedListId) {
        return NextResponse.json({ error: '分享鏈接不存在或已過期' }, { status: 404 });
      }
      const list = db.lists[sharedListId];
      if (!list) {
        return NextResponse.json({ error: '清單不存在' }, { status: 404 });
      }
      return NextResponse.json(list);
    }

    if (listId) {
      // 取得單個清單
      const list = db.lists[listId];
      if (!list) {
        return NextResponse.json({ error: '清單不存在' }, { status: 404 });
      }
      return NextResponse.json(list);
    }

    // 取得所有清單
    return NextResponse.json({
      lists: Object.values(db.lists),
    });
  } catch (error) {
    console.error('[Shopping Lists] Error fetching lists:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '取得清單失敗' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/shopping-lists
 * 更新清單
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, description, items } = body;

    if (!id) {
      return NextResponse.json({ error: '清單 ID 必填' }, { status: 400 });
    }

    const db = await initDb();
    const list = db.lists[id];

    if (!list) {
      return NextResponse.json({ error: '清單不存在' }, { status: 404 });
    }

    // 更新欄位
    if (name !== undefined) list.name = name;
    if (description !== undefined) list.description = description;
    if (items !== undefined) {
      list.items = items.map((item: any) => ({
        ...item,
        addedAt: item.addedAt || new Date().toISOString(),
      }));
    }

    list.updatedAt = new Date().toISOString();
    await saveDb(db);

    return NextResponse.json(list);
  } catch (error) {
    console.error('[Shopping Lists] Error updating list:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新清單失敗' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/shopping-lists
 * 刪除清單
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const listId = searchParams.get('id');

    if (!listId) {
      return NextResponse.json({ error: '清單 ID 必填' }, { status: 400 });
    }

    const db = await initDb();

    if (!db.lists[listId]) {
      return NextResponse.json({ error: '清單不存在' }, { status: 404 });
    }

    delete db.lists[listId];

    // 刪除相關的分享鏈接
    Object.keys(db.shares).forEach((code) => {
      if (db.shares[code] === listId) {
        delete db.shares[code];
      }
    });

    await saveDb(db);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Shopping Lists] Error deleting list:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '刪除清單失敗' },
      { status: 500 }
    );
  }
}
