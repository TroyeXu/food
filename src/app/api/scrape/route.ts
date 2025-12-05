import { NextRequest, NextResponse } from 'next/server';
import { fetchWebpage, extractHints, truncateContent, type ScraperService } from '@/lib/scraper';
import { generateExtractionPrompt, generateCompactPrompt } from '@/lib/aiPrompt';

const JINA_API_KEY = process.env.JINA_API_KEY;
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, mode = 'full', service = 'jina' } = body as {
      url: string;
      mode?: 'full' | 'compact';
      service?: ScraperService;
    };

    if (!url) {
      return NextResponse.json(
        { error: '請提供 URL' },
        { status: 400 }
      );
    }

    // 驗證 URL 格式
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: '無效的 URL 格式' },
        { status: 400 }
      );
    }

    // 檢查 API Key
    if (service === 'firecrawl' && !FIRECRAWL_API_KEY) {
      return NextResponse.json(
        { error: 'Firecrawl API Key 未設定，請在 .env.local 中設定 FIRECRAWL_API_KEY' },
        { status: 400 }
      );
    }

    console.log(`[Scrape] Fetching: ${url} using ${service}`);

    // 使用選擇的服務爬取
    const scraped = await fetchWebpage(url, {
      service,
      jinaApiKey: JINA_API_KEY,
      firecrawlApiKey: FIRECRAWL_API_KEY,
    });

    // 提取關鍵資訊提示
    const hints = extractHints(scraped.content);

    // 截斷內容以適合 AI 處理
    const truncatedContent = truncateContent(scraped.content);
    const scrapedForPrompt = { ...scraped, content: truncatedContent };

    // 生成 AI Prompt
    const prompt = mode === 'compact'
      ? generateCompactPrompt(scrapedForPrompt, hints)
      : generateExtractionPrompt(scrapedForPrompt, hints);

    return NextResponse.json({
      success: true,
      data: {
        url: scraped.url,
        title: scraped.title,
        content: truncatedContent,
        contentLength: scraped.content.length,
        images: scraped.images,
        hints,
        prompt,
        service, // 回傳使用的服務
      },
    });
  } catch (error) {
    console.error('[Scrape] Error:', error);

    const message = error instanceof Error ? error.message : '未知錯誤';

    return NextResponse.json(
      { error: `爬取失敗: ${message}` },
      { status: 500 }
    );
  }
}

/**
 * GET 方法：檢查可用的爬取服務
 */
export async function GET() {
  const services = {
    jina: {
      available: true, // Jina 可以不用 API Key（有 rate limit）
      hasApiKey: !!JINA_API_KEY,
    },
    firecrawl: {
      available: !!FIRECRAWL_API_KEY,
      hasApiKey: !!FIRECRAWL_API_KEY,
    },
    local: {
      available: true, // 本地爬取總是可用
      hasApiKey: true, // 不需要 API Key
    },
    crawl4ai: {
      available: true, // Python 環境設定好就可用
      hasApiKey: true,
    },
    scrapegraph: {
      available: true, // Python 環境設定好就可用
      hasApiKey: true,
    },
  };

  return NextResponse.json({
    services,
    default: FIRECRAWL_API_KEY ? 'firecrawl' : 'jina',
  });
}
