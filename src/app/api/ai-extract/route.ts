import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fetchWebpage, extractHints, truncateContent, type ScraperService } from '@/lib/scraper';
import { generateExtractionPrompt, parseAIResponse } from '@/lib/aiPrompt';

const execAsync = promisify(exec);

const JINA_API_KEY = process.env.JINA_API_KEY;
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

type CLITool = 'claude' | 'gemini' | 'gpt';

/**
 * 呼叫本地 AI CLI 工具
 */
async function callAICLI(prompt: string, tool: CLITool): Promise<string> {
  const fs = await import('fs/promises');
  const os = await import('os');
  const path = await import('path');

  const tempFile = path.join(os.tmpdir(), `ai-prompt-${Date.now()}.txt`);
  await fs.writeFile(tempFile, prompt, 'utf-8');

  try {
    let command: string;

    switch (tool) {
      case 'claude':
        command = `cat "${tempFile}" | claude -p`;
        break;
      case 'gemini':
        command = `cat "${tempFile}" | gemini`;
        break;
      case 'gpt':
        command = `cat "${tempFile}" | gpt`;
        break;
      default:
        throw new Error(`不支援的 CLI 工具: ${tool}`);
    }

    console.log(`[AI-Extract] Calling ${tool} CLI...`);

    const { stdout, stderr } = await execAsync(command, {
      timeout: 120000,
      maxBuffer: 1024 * 1024 * 10,
      env: {
        ...process.env,
        PATH: `${process.env.PATH}:/usr/local/bin:/opt/homebrew/bin:${process.env.HOME}/.local/bin`,
      },
    });

    if (stderr && !stdout) {
      console.error(`[AI-Extract] CLI stderr:`, stderr);
    }

    return stdout.trim();
  } finally {
    try {
      const fs = await import('fs/promises');
      await fs.unlink(tempFile);
    } catch {
      // ignore cleanup errors
    }
  }
}

/**
 * POST: 完整流程 - 爬取 + AI 處理 + 解析
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, cli = 'claude', service = 'jina' } = body as {
      url: string;
      cli?: CLITool;
      service?: ScraperService;
    };

    if (!url) {
      return NextResponse.json(
        { error: '請提供 URL' },
        { status: 400 }
      );
    }

    // 驗證 CLI 工具
    if (!['claude', 'gemini', 'gpt'].includes(cli)) {
      return NextResponse.json(
        { error: '不支援的 CLI 工具，請選擇 claude, gemini 或 gpt' },
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

    // 檢查 Firecrawl API Key
    if (service === 'firecrawl' && !FIRECRAWL_API_KEY) {
      return NextResponse.json(
        { error: 'Firecrawl API Key 未設定' },
        { status: 400 }
      );
    }

    console.log(`[AI-Extract] Starting extraction for: ${url} using ${service} + ${cli}`);

    // 步驟 1: 爬取網頁
    console.log(`[AI-Extract] Step 1: Scraping with ${service}...`);
    const scraped = await fetchWebpage(url, {
      service,
      jinaApiKey: JINA_API_KEY,
      firecrawlApiKey: FIRECRAWL_API_KEY,
    });
    const hints = extractHints(scraped.content);
    const truncatedContent = truncateContent(scraped.content);
    const scrapedForPrompt = { ...scraped, content: truncatedContent };

    // 步驟 2: 生成 Prompt
    console.log(`[AI-Extract] Step 2: Generating prompt...`);
    const prompt = generateExtractionPrompt(scrapedForPrompt, hints);

    // 步驟 3: 呼叫 AI CLI
    console.log(`[AI-Extract] Step 3: Calling ${cli} CLI...`);
    const aiResponse = await callAICLI(prompt, cli);

    // 步驟 4: 解析回應
    console.log(`[AI-Extract] Step 4: Parsing response...`);
    const parsed = parseAIResponse(aiResponse);

    if (!parsed) {
      return NextResponse.json(
        {
          error: '無法解析 AI 回應',
          rawResponse: aiResponse.slice(0, 2000),
        },
        { status: 422 }
      );
    }

    // 加入來源資訊
    parsed.sourceUrl = url;

    console.log(`[AI-Extract] Success! Extracted: ${parsed.vendorName} - ${parsed.title}`);

    return NextResponse.json({
      success: true,
      data: {
        scraped: {
          url: scraped.url,
          title: scraped.title,
          contentLength: scraped.content.length,
          hints,
          service,
        },
        parsed,
        rawResponse: aiResponse,
      },
    });
  } catch (error) {
    console.error('[AI-Extract] Error:', error);

    const message = error instanceof Error ? error.message : '未知錯誤';

    if (message.includes('command not found') || message.includes('ENOENT')) {
      return NextResponse.json(
        { error: `找不到 CLI 工具，請確認已安裝並加入 PATH` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: `處理失敗: ${message}` },
      { status: 500 }
    );
  }
}

/**
 * GET: 檢查可用的 CLI 工具和爬取服務
 */
export async function GET() {
  const tools: Record<string, boolean> = {
    claude: false,
    gemini: false,
    gpt: false,
  };

  for (const tool of Object.keys(tools)) {
    try {
      await execAsync(`which ${tool}`, {
        env: {
          ...process.env,
          PATH: `${process.env.PATH}:/usr/local/bin:/opt/homebrew/bin:${process.env.HOME}/.local/bin`,
        },
      });
      tools[tool] = true;
    } catch {
      tools[tool] = false;
    }
  }

  const services = {
    jina: {
      available: true,
      hasApiKey: !!JINA_API_KEY,
    },
    firecrawl: {
      available: !!FIRECRAWL_API_KEY,
      hasApiKey: !!FIRECRAWL_API_KEY,
    },
    local: {
      available: true,
      hasApiKey: true,
    },
    crawl4ai: {
      available: true,
      hasApiKey: true,
    },
    scrapegraph: {
      available: true,
      hasApiKey: true,
    },
  };

  return NextResponse.json({
    available: tools,
    default: tools.claude ? 'claude' : tools.gemini ? 'gemini' : tools.gpt ? 'gpt' : null,
    services,
    defaultService: FIRECRAWL_API_KEY ? 'firecrawl' : 'jina',
  });
}
