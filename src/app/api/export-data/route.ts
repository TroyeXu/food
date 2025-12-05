import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    const data = await request.json();

    // 寫入到 public/data/plans.json
    const filePath = path.join(process.cwd(), 'public', 'data', 'plans.json');

    // 確保目錄存在
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');

    return NextResponse.json({
      success: true,
      message: `已匯出 ${data.length} 筆資料到 public/data/plans.json`,
      path: filePath
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
