import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

interface PriceMonitorRequest {
  action: 'check' | 'list' | 'add' | 'remove' | 'enable' | 'disable';
  planId?: string;
  sourceUrl?: string;
  checkInterval?: 'daily' | 'weekly' | 'manual';
}

const MONITOR_DB = path.join(process.cwd(), 'data', 'price-monitor.json');
const PRICE_HISTORY_DB = path.join(process.cwd(), 'data', 'price-history.json');

// 初始化監控數據庫
async function initMonitorDb() {
  try {
    await fs.access(MONITOR_DB);
    const data = await fs.readFile(MONITOR_DB, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { monitors: [], priceChanges: [] };
  }
}

// 初始化價格歷史數據庫
async function initPriceHistoryDb() {
  try {
    await fs.access(PRICE_HISTORY_DB);
    const data = await fs.readFile(PRICE_HISTORY_DB, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { history: [] };
  }
}

// 保存監控數據
async function saveMonitorDb(data: any) {
  await fs.mkdir(path.dirname(MONITOR_DB), { recursive: true });
  await fs.writeFile(MONITOR_DB, JSON.stringify(data, null, 2));
}

// 保存價格歷史
async function savePriceHistoryDb(data: any) {
  await fs.mkdir(path.dirname(PRICE_HISTORY_DB), { recursive: true });
  await fs.writeFile(PRICE_HISTORY_DB, JSON.stringify(data, null, 2));
}

// 從源 URL 獲取最新價格
async function fetchCurrentPrice(sourceUrl: string): Promise<number | null> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: sourceUrl,
        service: 'firecrawl',
      }),
    });

    if (!response.ok) return null;

    const result = await response.json();
    if (!result.success || !result.data) return null;

    // 從爬取的內容中提取價格
    const content = result.data.markdown || result.data.html || '';
    const priceMatch = content.match(/(?:￥|¥|\$|NT\$|NTD)\s*(\d+(?:[,，]\d{3})*(?:\.\d{2})?)/);

    if (priceMatch) {
      const priceStr = priceMatch[1].replace(/[,，]/g, '');
      return parseFloat(priceStr);
    }

    return null;
  } catch (error) {
    console.error('[Price Monitor] Error fetching price:', error);
    return null;
  }
}

// 檢查單個監控任務
async function checkMonitorTask(task: any, plans: any[]): Promise<any> {
  try {
    const plan = plans.find((p) => p.id === task.planId);
    if (!plan) {
      return {
        ...task,
        status: 'error',
        errorMessage: '方案不存在',
        lastCheckedAt: new Date().toISOString(),
      };
    }

    const currentPrice = await fetchCurrentPrice(task.sourceUrl);

    if (currentPrice === null) {
      return {
        ...task,
        status: 'error',
        errorMessage: '無法獲取價格',
        lastCheckedAt: new Date().toISOString(),
      };
    }

    const oldPrice = plan.priceDiscount || 0;

    // 記錄價格歷史
    const historyDb = await initPriceHistoryDb();
    historyDb.history.push({
      id: `price_${Date.now()}`,
      planId: task.planId,
      price: currentPrice,
      originalPrice: plan.priceOriginal,
      recordedAt: new Date().toISOString(),
      source: 'scrape',
    });
    await savePriceHistoryDb(historyDb);

    // 檢測價格變化
    const priceChanged = Math.abs(currentPrice - oldPrice) > 1; // 變化 > 1 元視為有變化
    const changePercent =
      oldPrice > 0 ? ((currentPrice - oldPrice) / oldPrice) * 100 : (currentPrice > 0 ? 100 : 0);

    return {
      ...task,
      status: priceChanged ? 'changed' : 'idle',
      lastCheckedAt: new Date().toISOString(),
      lastChangeAt: priceChanged ? new Date().toISOString() : task.lastChangeAt,
      currentPrice,
      oldPrice,
      changePercent: priceChanged ? changePercent : 0,
      changeType: currentPrice < oldPrice ? 'drop' : 'increase',
    };
  } catch (error) {
    console.error('[Price Monitor] Error checking task:', error);
    return {
      ...task,
      status: 'error',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      lastCheckedAt: new Date().toISOString(),
    };
  }
}

/**
 * POST /api/price-monitor
 * 管理價格監控任務
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PriceMonitorRequest;
    const { action, planId, sourceUrl, checkInterval = 'daily' } = body;

    const monitorDb = await initMonitorDb();

    switch (action) {
      case 'add': {
        if (!planId || !sourceUrl) {
          return NextResponse.json({ error: '需要提供 planId 和 sourceUrl' }, { status: 400 });
        }

        // 檢查是否已監控
        const exists = monitorDb.monitors.some((m: any) => m.planId === planId);
        if (exists) {
          return NextResponse.json({ error: '已經在監控此方案' }, { status: 400 });
        }

        const newMonitor = {
          id: `monitor_${Date.now()}`,
          planId,
          sourceUrl,
          enabled: true,
          checkInterval,
          lastCheckedAt: null,
          lastChangeAt: null,
          status: 'idle',
          errorMessage: null,
          createdAt: new Date().toISOString(),
        };

        monitorDb.monitors.push(newMonitor);
        await saveMonitorDb(monitorDb);

        return NextResponse.json(newMonitor);
      }

      case 'remove': {
        if (!planId) {
          return NextResponse.json({ error: '需要提供 planId' }, { status: 400 });
        }

        monitorDb.monitors = monitorDb.monitors.filter((m: any) => m.planId !== planId);
        await saveMonitorDb(monitorDb);

        return NextResponse.json({ success: true });
      }

      case 'enable':
      case 'disable': {
        if (!planId) {
          return NextResponse.json({ error: '需要提供 planId' }, { status: 400 });
        }

        const monitor = monitorDb.monitors.find((m: any) => m.planId === planId);
        if (!monitor) {
          return NextResponse.json({ error: '監控任務不存在' }, { status: 404 });
        }

        monitor.enabled = action === 'enable';
        await saveMonitorDb(monitorDb);

        return NextResponse.json(monitor);
      }

      case 'list': {
        return NextResponse.json(monitorDb.monitors);
      }

      case 'check': {
        if (!planId) {
          return NextResponse.json({ error: '需要提供 planId' }, { status: 400 });
        }

        const monitor = monitorDb.monitors.find((m: any) => m.planId === planId);
        if (!monitor) {
          return NextResponse.json({ error: '監控任務不存在' }, { status: 404 });
        }

        // 讀取計劃數據
        const plansFile = path.join(process.cwd(), 'public', 'data', 'plans.json');
        const plansData = await fs.readFile(plansFile, 'utf-8');
        const plans = JSON.parse(plansData);

        const updatedMonitor = await checkMonitorTask(monitor, plans);
        const monitorIndex = monitorDb.monitors.findIndex((m: any) => m.planId === planId);
        monitorDb.monitors[monitorIndex] = updatedMonitor;
        await saveMonitorDb(monitorDb);

        return NextResponse.json(updatedMonitor);
      }

      default: {
        return NextResponse.json({ error: '未知操作' }, { status: 400 });
      }
    }
  } catch (error) {
    console.error('[Price Monitor] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '處理失敗' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/price-monitor
 * 取得監控統計和價格變化
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const planId = searchParams.get('planId');

    const monitorDb = await initMonitorDb();
    const historyDb = await initPriceHistoryDb();

    // 統計信息
    const stats = {
      total: monitorDb.monitors.length,
      enabled: monitorDb.monitors.filter((m: any) => m.enabled).length,
      changed: monitorDb.monitors.filter((m: any) => m.status === 'changed').length,
      errors: monitorDb.monitors.filter((m: any) => m.status === 'error').length,
    };

    if (planId) {
      // 返回特定方案的監控數據和歷史記錄
      const monitor = monitorDb.monitors.find((m: any) => m.planId === planId);
      const history = historyDb.history.filter((h: any) => h.planId === planId);

      return NextResponse.json({
        monitor,
        history: history.sort((a: any, b: any) =>
          new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
        ),
      });
    }

    // 返回監控總覽
    const recentChanges = monitorDb.monitors
      .filter((m: any) => m.status === 'changed')
      .sort(
        (a: any, b: any) =>
          new Date(b.lastChangeAt).getTime() - new Date(a.lastChangeAt).getTime()
      )
      .slice(0, 10);

    return NextResponse.json({
      stats,
      monitors: monitorDb.monitors,
      recentChanges,
    });
  } catch (error) {
    console.error('[Price Monitor] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '處理失敗' },
      { status: 500 }
    );
  }
}
