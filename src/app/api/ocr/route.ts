import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

const execAsync = promisify(exec);

interface OCRResult {
  success: boolean;
  processed?: number;
  total?: number;
  results?: Array<{ url: string; text: string }>;
  combined_text?: string;
  error?: string;
}

/**
 * 呼叫 PaddleOCR Python 腳本
 */
async function callPaddleOCR(imageUrls: string[]): Promise<OCRResult> {
  const projectRoot = process.cwd();
  const pythonPath = path.join(projectRoot, '.venv', 'bin', 'python');
  const scriptPath = path.join(projectRoot, 'scripts', 'ocr.py');

  // 檢查 Python 環境是否存在
  try {
    await fs.access(pythonPath);
  } catch {
    return {
      success: false,
      error: 'Python 虛擬環境未設定，請執行: uv venv --python 3.11 .venv && uv pip install paddlepaddle paddleocr',
    };
  }

  // 將 URLs 寫入暫存檔案（避免命令列過長）
  const tempFile = path.join(os.tmpdir(), `ocr-urls-${Date.now()}.json`);
  await fs.writeFile(tempFile, JSON.stringify(imageUrls));

  try {
    const { stdout, stderr } = await execAsync(
      `"${pythonPath}" "${scriptPath}" --batch-file "${tempFile}"`,
      {
        timeout: 300000, // 5 分鐘超時
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        cwd: projectRoot,
      }
    );

    if (stderr) {
      console.log('[OCR] stderr:', stderr);
    }

    const result = JSON.parse(stdout.trim());
    return result;
  } catch (error) {
    if (error instanceof Error) {
      // 檢查是否是 PaddleOCR 未安裝
      if (error.message.includes('paddleocr') || error.message.includes('ModuleNotFoundError')) {
        return {
          success: false,
          error: 'PaddleOCR 未安裝，請執行: uv pip install paddlepaddle paddleocr',
        };
      }
      return {
        success: false,
        error: error.message,
      };
    }
    return {
      success: false,
      error: '執行 OCR 時發生未知錯誤',
    };
  } finally {
    // 清理暫存檔案
    try {
      await fs.unlink(tempFile);
    } catch {
      // 忽略刪除失敗
    }
  }
}

/**
 * POST /api/ocr
 * 對圖片進行 OCR 識別
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { images, maxImages = 10 } = body as {
      images: string[];
      maxImages?: number;
    };

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json(
        { error: '請提供圖片 URL 陣列' },
        { status: 400 }
      );
    }

    // 過濾有效的圖片 URL
    const validImages = images.filter(
      (url) => url && typeof url === 'string' && url.startsWith('http')
    );

    if (validImages.length === 0) {
      return NextResponse.json(
        { error: '沒有有效的圖片 URL' },
        { status: 400 }
      );
    }

    console.log(`[OCR] Processing ${validImages.length} images (max: ${maxImages})`);

    const result = await callPaddleOCR(validImages.slice(0, maxImages));

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        processed: result.processed,
        total: result.total,
        results: result.results,
        combinedText: result.combined_text,
      },
    });
  } catch (error) {
    console.error('[OCR] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '處理失敗' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ocr
 * 檢查 OCR 服務狀態
 */
export async function GET() {
  const projectRoot = process.cwd();
  const pythonPath = path.join(projectRoot, '.venv', 'bin', 'python');

  let pythonAvailable = false;
  let paddleOcrAvailable = false;

  // 檢查 Python
  try {
    await fs.access(pythonPath);
    pythonAvailable = true;

    // 檢查 PaddleOCR
    const { stdout } = await execAsync(
      `"${pythonPath}" -c "import paddleocr; print('ok')"`,
      { timeout: 10000 }
    );
    paddleOcrAvailable = stdout.trim() === 'ok';
  } catch {
    // 忽略錯誤
  }

  return NextResponse.json({
    available: pythonAvailable && paddleOcrAvailable,
    python: pythonAvailable,
    paddleocr: paddleOcrAvailable,
    setupCommand: 'uv venv --python 3.11 .venv && uv pip install paddlepaddle paddleocr',
  });
}
