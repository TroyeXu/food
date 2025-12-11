import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { parseAIResponse } from '@/lib/aiPrompt';

const execAsync = promisify(exec);

type CLITool = 'claude' | 'gemini';

/**
 * 下載圖片到本地暫存
 */
async function downloadImage(url: string, destPath: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      console.log(`[AI-Vision] Failed to fetch image: ${url} (${response.status})`);
      return false;
    }

    const arrayBuffer = await response.arrayBuffer();
    await fs.writeFile(destPath, Buffer.from(arrayBuffer));
    return true;
  } catch (error) {
    console.log(`[AI-Vision] Error downloading image: ${url}`, error);
    return false;
  }
}

/**
 * 生成年菜解析 prompt
 */
function generateVisionPrompt(textContent?: string, imageOnly: boolean = false): string {
  const basePrompt = `你是一個專業的圖片內容識別助手。請【只根據圖片中實際看到的內容】來回答。

⚠️ 重要：只描述你在圖片中【實際看到】的文字和資訊，不要猜測或補充圖片中沒有的內容。

請仔細觀察圖片，識別出圖片中的：
- 所有可見文字（包含促銷文案、價格、標語等）
- 數字和金額
- 日期資訊
- 品牌/店家名稱
- 商品名稱
- 任何優惠資訊（滿額贈、折扣等）

請以 JSON 格式回傳，只填入圖片中【明確看到】的資訊，看不到的欄位填 null：

{
  "vendorName": "圖片中看到的品牌/店家名稱（沒看到填 null）",
  "title": "圖片中看到的商品/方案名稱（沒看到填 null）",
  "description": "圖片中看到的描述文字或促銷文案（完整抄錄）",
  "priceOriginal": 圖片中看到的原價數字（沒看到填 null）,
  "priceDiscount": 圖片中看到的優惠價/售價數字（沒看到填 null）,
  "shippingFee": 圖片中看到的運費數字（沒看到填 null）,
  "servingsMin": 圖片中看到的份量數字（沒看到填 null）,
  "servingsMax": 圖片中看到的份量上限（沒看到填 null）,
  "shippingType": null,
  "storageType": "unknown",
  "dishes": ["圖片中看到的菜色名稱"],
  "tags": ["從圖片文字推斷的標籤"],
  "promotions": ["圖片中看到的所有促銷資訊，如：滿xxx送xxx、消費滿額贈等"],
  "visibleText": "圖片中所有可見文字的完整抄錄",
  "orderDeadline": null,
  "fulfillStart": null,
  "fulfillEnd": null
}

只回傳 JSON，不要其他解釋文字。`;

  if (imageOnly || !textContent) {
    return basePrompt;
  }

  return `${basePrompt}

---
以下是網頁文字內容，【僅供參考】，但你的回答必須以圖片中實際看到的內容為主：
${textContent.substring(0, 2000)}`;
}

/**
 * 使用 Claude CLI 分析圖片
 */
async function analyzeWithClaude(imagePaths: string[], prompt: string): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vision-'));
  const promptFile = path.join(tempDir, 'prompt.txt');

  // 建立包含圖片路徑的完整 prompt
  const imageInstructions = imagePaths.map((p, i) =>
    `請使用 Read 工具讀取並分析圖片 ${i + 1}: ${p}`
  ).join('\n');

  const fullPrompt = `${imageInstructions}

讀取上述圖片後，請根據圖片內容進行以下分析：

${prompt}`;

  await fs.writeFile(promptFile, fullPrompt, 'utf-8');

  try {
    const { stdout, stderr } = await execAsync(
      `claude -p --allowed-tools "Read" < "${promptFile}"`,
      {
        timeout: 180000,
        maxBuffer: 1024 * 1024 * 10,
        env: {
          ...process.env,
          PATH: `${process.env.PATH}:/usr/local/bin:/opt/homebrew/bin:${process.env.HOME}/.local/bin`,
        },
        cwd: os.tmpdir(),
      }
    );

    if (stderr && !stdout) {
      console.error('[AI-Vision] Claude stderr:', stderr);
    }

    return stdout.trim();
  } finally {
    try {
      await fs.unlink(promptFile);
      await fs.rmdir(tempDir);
    } catch { /* ignore */ }
  }
}

/**
 * 使用 Gemini CLI 分析圖片
 */
async function analyzeWithGemini(imagePaths: string[], prompt: string): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vision-'));
  const promptFile = path.join(tempDir, 'prompt.txt');

  // Gemini 可以直接處理圖片路徑
  const imageRefs = imagePaths.map((p, i) => `[圖片 ${i + 1}]: ${p}`).join('\n');
  const fullPrompt = `請分析以下圖片：\n${imageRefs}\n\n${prompt}`;

  await fs.writeFile(promptFile, fullPrompt, 'utf-8');

  try {
    // Gemini CLI 直接讀取圖片
    const { stdout, stderr } = await execAsync(
      `cat "${promptFile}" | gemini`,
      {
        timeout: 180000,
        maxBuffer: 1024 * 1024 * 10,
        env: {
          ...process.env,
          PATH: `${process.env.PATH}:/usr/local/bin:/opt/homebrew/bin:${process.env.HOME}/.local/bin`,
        },
      }
    );

    if (stderr && !stdout) {
      console.error('[AI-Vision] Gemini stderr:', stderr);
    }

    return stdout.trim();
  } finally {
    try {
      await fs.unlink(promptFile);
      await fs.rmdir(tempDir);
    } catch { /* ignore */ }
  }
}

/**
 * POST /api/ai-vision
 * 使用 CLI 工具分析圖片
 */
export async function POST(request: NextRequest) {
  const downloadedFiles: string[] = [];

  try {
    const body = await request.json();
    const { images, textContent, url, cli = 'claude', imageOnly = false } = body as {
      images: string[];
      textContent?: string;
      url?: string;
      cli?: CLITool;
      imageOnly?: boolean;
    };

    if (!images || images.length === 0) {
      return NextResponse.json(
        { error: '請提供至少一張圖片 URL' },
        { status: 400 }
      );
    }

    console.log(`[AI-Vision] Processing ${images.length} images with ${cli}...`);

    // 建立暫存目錄
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-vision-'));

    // 下載圖片
    const maxImages = Math.min(images.length, 10);
    for (let i = 0; i < maxImages; i++) {
      const imgUrl = images[i];
      const ext = imgUrl.toLowerCase().includes('.png') ? '.png' :
                  imgUrl.toLowerCase().includes('.webp') ? '.webp' : '.jpg';
      const destPath = path.join(tempDir, `image_${i + 1}${ext}`);

      console.log(`[AI-Vision] Downloading image ${i + 1}/${maxImages}...`);
      const success = await downloadImage(imgUrl, destPath);
      if (success) {
        downloadedFiles.push(destPath);
      }
    }

    if (downloadedFiles.length === 0) {
      return NextResponse.json(
        { error: '無法下載任何圖片，請檢查圖片 URL 是否有效' },
        { status: 400 }
      );
    }

    console.log(`[AI-Vision] Downloaded ${downloadedFiles.length} images, calling ${cli}...`);

    // 生成 prompt
    const prompt = generateVisionPrompt(textContent?.substring(0, 8000), imageOnly);

    // 呼叫 CLI
    let aiResponse: string;
    if (cli === 'gemini') {
      aiResponse = await analyzeWithGemini(downloadedFiles, prompt);
    } else {
      aiResponse = await analyzeWithClaude(downloadedFiles, prompt);
    }

    console.log(`[AI-Vision] ${cli} response received (${aiResponse.length} chars)`);

    // 解析 JSON
    const parsed = parseAIResponse(aiResponse);

    if (!parsed) {
      return NextResponse.json({
        success: false,
        error: '無法解析 AI 回應',
        rawResponse: aiResponse.substring(0, 2000),
      });
    }

    // 加入來源資訊
    if (url) {
      parsed.sourceUrl = url;
    }

    console.log(`[AI-Vision] Success! Extracted: ${parsed.vendorName} - ${parsed.title}`);

    return NextResponse.json({
      success: true,
      plan: parsed,
      rawResponse: aiResponse,
      imagesProcessed: downloadedFiles.length,
      cli,
    });
  } catch (error) {
    console.error('[AI-Vision] Error:', error);

    const message = error instanceof Error ? error.message : '未知錯誤';

    if (message.includes('command not found') || message.includes('ENOENT')) {
      return NextResponse.json(
        { error: `找不到 CLI 工具，請確認已安裝 claude 或 gemini CLI` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: `處理失敗: ${message}` },
      { status: 500 }
    );
  } finally {
    // 清理下載的圖片
    for (const file of downloadedFiles) {
      try {
        await fs.unlink(file);
      } catch { /* ignore */ }
    }
  }
}

/**
 * GET /api/ai-vision
 * 檢查服務狀態
 */
export async function GET() {
  const tools: Record<string, boolean> = {
    claude: false,
    gemini: false,
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

  return NextResponse.json({
    available: tools,
    default: tools.claude ? 'claude' : tools.gemini ? 'gemini' : null,
    maxImages: 10,
  });
}
