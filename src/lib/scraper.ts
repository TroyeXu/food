/**
 * 網頁爬取模組
 * 支援 Jina AI Reader、Firecrawl 和本地爬取三種方式
 */

import { chromium } from 'playwright';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
import { JSDOM } from 'jsdom';

export interface ScrapedContent {
  url: string;
  title: string;
  content: string; // Markdown 格式
  images: string[];
}

export interface ExtractedHints {
  prices: number[];
  servings: string[];
  dates: string[];
  phones: string[];
}

export type ScraperService = 'jina' | 'firecrawl' | 'local' | 'crawl4ai' | 'scrapegraph';

// ==================== Jina AI Reader ====================
const JINA_READER_BASE = 'https://r.jina.ai';

/**
 * 使用 Jina AI Reader 爬取網頁並轉換為 Markdown
 */
export async function fetchWithJina(url: string, apiKey?: string): Promise<ScrapedContent> {
  const jinaUrl = `${JINA_READER_BASE}/${url}`;

  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await fetch(jinaUrl, { headers });

  if (!response.ok) {
    throw new Error(`Jina Reader failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const result = data.data || data;

  return {
    url: result.url || url,
    title: result.title || '',
    content: result.content || result.text || '',
    images: result.images || [],
  };
}

// ==================== Firecrawl ====================
const FIRECRAWL_API_BASE = 'https://api.firecrawl.dev/v1';

/**
 * 使用 Firecrawl 爬取網頁並轉換為 Markdown
 * https://docs.firecrawl.dev/api-reference/endpoint/scrape
 */
export async function fetchWithFirecrawl(url: string, apiKey: string): Promise<ScrapedContent> {
  if (!apiKey) {
    throw new Error('Firecrawl 需要 API Key');
  }

  const response = await fetch(`${FIRECRAWL_API_BASE}/scrape`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      url,
      formats: ['markdown'],
      onlyMainContent: true,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Firecrawl failed: ${response.status} ${errorData.error || response.statusText}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(`Firecrawl error: ${data.error || 'Unknown error'}`);
  }

  const result = data.data || {};

  return {
    url: result.url || url,
    title: result.metadata?.title || '',
    content: result.markdown || '',
    images: extractImagesFromMarkdown(result.markdown || ''),
  };
}

/**
 * 從 Markdown 內容中提取圖片 URL
 */
function extractImagesFromMarkdown(markdown: string): string[] {
  const imagePattern = /!\[.*?\]\((https?:\/\/[^\s)]+)\)/g;
  const images: string[] = [];
  let match;

  while ((match = imagePattern.exec(markdown)) !== null) {
    images.push(match[1]);
  }

  return images;
}

// ==================== 本地爬取 (Playwright + Readability + Turndown) ====================

/**
 * 使用本地工具爬取網頁
 * Playwright 抓取頁面 → Readability 提取主內容 → Turndown 轉 Markdown
 */
export async function fetchWithLocal(url: string): Promise<ScrapedContent> {
  let browser;

  try {
    // 啟動瀏覽器
    browser = await chromium.launch({
      headless: true,
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
    });

    const page = await context.newPage();

    // 設定超時
    page.setDefaultTimeout(30000);

    // 前往頁面
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // 等待頁面載入完成
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
      // 如果 networkidle 超時，繼續處理
      console.log('[Local Scraper] Network idle timeout, continuing...');
    });

    // 取得頁面內容
    const html = await page.content();
    const pageTitle = await page.title();
    const finalUrl = page.url();

    // 關閉瀏覽器
    await browser.close();
    browser = undefined;

    // 使用 JSDOM 解析 HTML
    const dom = new JSDOM(html, { url: finalUrl });
    const document = dom.window.document;

    // 使用 Readability 提取主要內容
    const reader = new Readability(document);
    const article = reader.parse();

    if (!article) {
      throw new Error('無法提取頁面內容，Readability 解析失敗');
    }

    // 使用 Turndown 轉換為 Markdown
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
    });

    // 添加規則：保留圖片
    turndownService.addRule('images', {
      filter: 'img',
      replacement: (content, node) => {
        const img = node as HTMLImageElement;
        const alt = img.alt || '';
        const src = img.src || '';
        if (src) {
          return `![${alt}](${src})`;
        }
        return '';
      },
    });

    const markdown = turndownService.turndown(article.content || '');

    // 格式化輸出，類似 Jina 的格式
    const formattedContent = `# ${article.title || pageTitle}\n\n${markdown}`;

    // 提取圖片
    const images = extractImagesFromMarkdown(formattedContent);

    // 也從原始 HTML 提取圖片
    const imgElements = document.querySelectorAll('img');
    imgElements.forEach((img: Element) => {
      const src = img.getAttribute('src');
      if (src && src.startsWith('http') && !images.includes(src)) {
        images.push(src);
      }
    });

    return {
      url: finalUrl,
      title: article.title || pageTitle,
      content: formattedContent,
      images: images.slice(0, 20), // 最多 20 張圖
    };

  } catch (error) {
    // 確保瀏覽器被關閉
    if (browser) {
      await browser.close();
    }
    throw error;
  }
}

// ==================== Python 爬取服務 (Crawl4AI / ScrapeGraphAI) ====================

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

/**
 * 呼叫 Python 爬取腳本
 */
async function callPythonScraper(service: 'crawl4ai' | 'scrapegraph', url: string): Promise<ScrapedContent> {
  const projectRoot = process.cwd();
  const pythonPath = path.join(projectRoot, '.venv', 'bin', 'python');
  const scriptPath = path.join(projectRoot, 'scripts', 'scraper.py');

  try {
    const { stdout, stderr } = await execAsync(
      `"${pythonPath}" "${scriptPath}" ${service} "${url}"`,
      {
        timeout: 120000,
        maxBuffer: 1024 * 1024 * 10,
        cwd: projectRoot,
      }
    );

    if (stderr && !stdout) {
      console.error(`[Python Scraper] stderr:`, stderr);
    }

    const result = JSON.parse(stdout.trim());

    if (!result.success) {
      throw new Error(result.error || '爬取失敗');
    }

    return {
      url: result.url || url,
      title: result.title || '',
      content: result.content || '',
      images: result.images || [],
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('ENOENT')) {
      throw new Error(`Python 環境未設定，請執行: uv venv --python 3.11 .venv && uv pip install crawl4ai scrapegraph`);
    }
    throw error;
  }
}

/**
 * 使用 Crawl4AI 爬取網頁
 */
export async function fetchWithCrawl4AI(url: string): Promise<ScrapedContent> {
  console.log(`[Crawl4AI] Fetching: ${url}`);
  return callPythonScraper('crawl4ai', url);
}

/**
 * 使用 ScrapeGraphAI 爬取網頁
 */
export async function fetchWithScrapeGraph(url: string): Promise<ScrapedContent> {
  console.log(`[ScrapeGraphAI] Fetching: ${url}`);
  return callPythonScraper('scrapegraph', url);
}

// ==================== 統一介面 ====================

interface FetchOptions {
  service: ScraperService;
  jinaApiKey?: string;
  firecrawlApiKey?: string;
}

/**
 * 統一爬取介面 - 根據選擇的服務爬取網頁
 */
export async function fetchWebpage(url: string, options: FetchOptions): Promise<ScrapedContent> {
  switch (options.service) {
    case 'jina':
      return fetchWithJina(url, options.jinaApiKey);
    case 'firecrawl':
      if (!options.firecrawlApiKey) {
        throw new Error('Firecrawl 需要 API Key');
      }
      return fetchWithFirecrawl(url, options.firecrawlApiKey);
    case 'local':
      return fetchWithLocal(url);
    case 'crawl4ai':
      return fetchWithCrawl4AI(url);
    case 'scrapegraph':
      return fetchWithScrapeGraph(url);
    default:
      throw new Error(`不支援的爬取服務: ${options.service}`);
  }
}

/**
 * 簡單版本：直接取得 Markdown 文字
 */
export async function fetchAsMarkdown(url: string, apiKey?: string): Promise<string> {
  const jinaUrl = `${JINA_READER_BASE}/${url}`;

  const headers: Record<string, string> = {};
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await fetch(jinaUrl, { headers });

  if (!response.ok) {
    throw new Error(`Jina Reader failed: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

/**
 * 從 Markdown 內容中提取可能的關鍵資訊
 */
export function extractHints(text: string): ExtractedHints {
  // 價格：找 NT$, $, 元 等
  const pricePatterns = [
    /NT\$?\s?(\d{1,3}(?:,\d{3})*|\d+)/gi,
    /\$\s?(\d{1,3}(?:,\d{3})*|\d+)/g,
    /(\d{1,3}(?:,\d{3})*|\d+)\s*元/g,
    /售價[：:]\s*(\d{1,3}(?:,\d{3})*|\d+)/g,
    /原價[：:]\s*(\d{1,3}(?:,\d{3})*|\d+)/g,
    /特價[：:]\s*(\d{1,3}(?:,\d{3})*|\d+)/g,
  ];

  const prices: number[] = [];
  for (const pattern of pricePatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const price = parseInt(match[1].replace(/,/g, ''), 10);
      if (price >= 500 && price <= 50000 && !prices.includes(price)) {
        prices.push(price);
      }
    }
  }

  // 份量：找 X人, X~Y人 等
  const servingPatterns = [
    /(\d+)\s*[-~至]\s*(\d+)\s*人/g,
    /(\d+)\s*人份/g,
    /適合\s*(\d+)\s*人/g,
  ];

  const servings: string[] = [];
  for (const pattern of servingPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      servings.push(match[0]);
    }
  }

  // 日期：找 MM/DD, YYYY/MM/DD 等
  const datePatterns = [
    /\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}/g,
    /\d{1,2}[\/\-\.]\d{1,2}/g,
  ];

  const dates: string[] = [];
  for (const pattern of datePatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      dates.push(match[0]);
    }
  }

  // 電話
  const phonePattern = /0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{3,4}/g;
  const phones = text.match(phonePattern) || [];

  return {
    prices: prices.sort((a, b) => a - b).slice(0, 5),
    servings: [...new Set(servings)].slice(0, 3),
    dates: [...new Set(dates)].slice(0, 5),
    phones: [...new Set(phones)].slice(0, 3),
  };
}

/**
 * 截斷內容到指定長度，保持完整句子
 */
export function truncateContent(content: string, maxLength: number = 8000): string {
  if (content.length <= maxLength) return content;

  // 找到最後一個完整句子的位置
  const truncated = content.slice(0, maxLength);
  const lastSentenceEnd = Math.max(
    truncated.lastIndexOf('。'),
    truncated.lastIndexOf('！'),
    truncated.lastIndexOf('？'),
    truncated.lastIndexOf('\n\n'),
    truncated.lastIndexOf('. '),
  );

  if (lastSentenceEnd > maxLength * 0.7) {
    return truncated.slice(0, lastSentenceEnd + 1) + '\n\n[內容已截斷...]';
  }

  return truncated + '\n\n[內容已截斷...]';
}
