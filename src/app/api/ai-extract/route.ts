import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { fetchWebpage, extractHints, truncateContent, type ScraperService } from '@/lib/scraper';
import { generateExtractionPrompt, parseAIResponseMultiple } from '@/lib/aiPrompt';

const execAsync = promisify(exec);

const JINA_API_KEY = process.env.JINA_API_KEY;
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

/**
 * 呼叫 PaddleOCR 處理圖片
 */
async function processImagesWithOCR(imageUrls: string[], maxImages: number = 5): Promise<string> {
  if (!imageUrls || imageUrls.length === 0) {
    return '';
  }

  const projectRoot = process.cwd();
  const pythonPath = path.join(projectRoot, '.venv', 'bin', 'python');
  const scriptPath = path.join(projectRoot, 'scripts', 'ocr.py');

  // 檢查 Python 環境
  try {
    await fs.access(pythonPath);
    await fs.access(scriptPath);
  } catch {
    console.log('[AI-Extract] OCR skipped: Python environment not available');
    return '';
  }

  // 過濾有效圖片 URL（排除小圖標、logo 等）
  const skipPatterns = ['icon', 'logo', 'avatar', 'emoji', 'btn', 'button', 'arrow', 'sprite', 'pixel', '1x1'];
  const validImages = imageUrls.filter((url) => {
    if (!url || !url.startsWith('http')) return false;
    const lowerUrl = url.toLowerCase();
    return !skipPatterns.some((p) => lowerUrl.includes(p));
  }).slice(0, maxImages);

  if (validImages.length === 0) {
    return '';
  }

  // 將 URLs 寫入暫存檔案
  const tempFile = path.join(os.tmpdir(), `ocr-urls-${Date.now()}.json`);
  await fs.writeFile(tempFile, JSON.stringify(validImages));

  try {
    console.log(`[AI-Extract] Running OCR on ${validImages.length} images...`);

    const { stdout, stderr } = await execAsync(
      `"${pythonPath}" "${scriptPath}" --batch-file "${tempFile}"`,
      {
        timeout: 180000, // 3 分鐘超時
        maxBuffer: 1024 * 1024 * 10,
        cwd: projectRoot,
      }
    );

    if (stderr) {
      console.log('[AI-Extract] OCR stderr:', stderr);
    }

    const result = JSON.parse(stdout.trim());

    if (result.success && result.combined_text) {
      console.log(`[AI-Extract] OCR completed: ${result.processed} images processed`);
      return result.combined_text;
    }

    return '';
  } catch (error) {
    console.log('[AI-Extract] OCR failed:', error instanceof Error ? error.message : error);
    return '';
  } finally {
    try {
      await fs.unlink(tempFile);
    } catch {
      // ignore
    }
  }
}

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

    // 步驟 1.5: OCR 處理圖片
    let ocrText = '';
    if (scraped.images && scraped.images.length > 0) {
      console.log(`[AI-Extract] Step 1.5: Running OCR on ${scraped.images.length} images...`);
      ocrText = await processImagesWithOCR(scraped.images, 5);
    }

    // 合併網頁內容和 OCR 文字
    let combinedContent = scraped.content;
    if (ocrText) {
      combinedContent += '\n\n---\n\n## 圖片 OCR 識別結果\n\n' + ocrText;
      console.log(`[AI-Extract] OCR text added (${ocrText.length} chars)`);
    }

    const hints = extractHints(combinedContent);
    const truncatedContent = truncateContent(combinedContent);
    const scrapedForPrompt = { ...scraped, content: truncatedContent };

    // 步驟 2: 生成 Prompt
    console.log(`[AI-Extract] Step 2: Generating prompt...`);
    const prompt = generateExtractionPrompt(scrapedForPrompt, hints);

    // 步驟 3: 呼叫 AI CLI
    console.log(`[AI-Extract] Step 3: Calling ${cli} CLI...`);
    const aiResponse = await callAICLI(prompt, cli);

    // 步驟 4: 解析回應（支援多筆）
    console.log(`[AI-Extract] Step 4: Parsing response...`);
    const parsedItems = parseAIResponseMultiple(aiResponse);

    if (parsedItems.length === 0) {
      return NextResponse.json(
        {
          error: '無法解析 AI 回應',
          rawResponse: aiResponse.slice(0, 2000),
        },
        { status: 422 }
      );
    }

    // 加入來源資訊
    for (const item of parsedItems) {
      item.sourceUrl = url;
    }

    console.log(`[AI-Extract] Success! Extracted ${parsedItems.length} items`);

    return NextResponse.json({
      success: true,
      data: {
        scraped: {
          url: scraped.url,
          title: scraped.title,
          contentLength: scraped.content.length,
          imagesCount: scraped.images?.length || 0,
          ocrTextLength: ocrText.length,
          hints,
          service,
        },
        parsed: parsedItems,
        count: parsedItems.length,
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
