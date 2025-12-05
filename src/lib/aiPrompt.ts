import type { Plan } from '@/types';
import type { ScrapedContent, ExtractedHints } from './scraper';

/**
 * 生成給 AI CLI 的 Prompt
 */
export function generateExtractionPrompt(
  scraped: ScrapedContent,
  hints?: ExtractedHints
): string {
  const hintsSection = hints ? `
## 自動偵測到的可能資訊
- 價格: ${hints.prices.length > 0 ? hints.prices.map(p => `$${p.toLocaleString()}`).join(', ') : '未偵測到'}
- 份量: ${hints.servings.length > 0 ? hints.servings.join(', ') : '未偵測到'}
- 日期: ${hints.dates.length > 0 ? hints.dates.join(', ') : '未偵測到'}
- 電話: ${hints.phones.length > 0 ? hints.phones.join(', ') : '未偵測到'}
` : '';

  return `# 年菜方案資料擷取任務

請從以下網頁內容擷取年菜方案資訊，並以 JSON 格式回傳。

## 來源網址
${scraped.url}

## 網頁標題
${scraped.title}
${hintsSection}
## 網頁內容
\`\`\`markdown
${scraped.content}
\`\`\`

## 請擷取以下欄位並回傳 JSON

\`\`\`json
{
  "vendorName": "餐廳/品牌名稱（必填）",
  "title": "方案名稱（必填）",
  "description": "方案描述（選填，1-2句話）",
  "priceOriginal": null,
  "priceDiscount": 0,
  "shippingFee": null,
  "shippingType": "delivery",
  "storageType": "frozen",
  "servingsMin": 4,
  "servingsMax": null,
  "orderDeadline": null,
  "fulfillStart": null,
  "fulfillEnd": null,
  "region": null,
  "city": null,
  "address": null,
  "tags": [],
  "dishes": [],
  "imageUrl": null
}
\`\`\`

## 欄位說明

| 欄位 | 類型 | 說明 |
|------|------|------|
| vendorName | string | 餐廳/品牌名稱 |
| title | string | 方案名稱 |
| description | string? | 方案簡短描述 |
| priceOriginal | number? | 原價（無折扣則 null） |
| priceDiscount | number | 售價/特價（必填） |
| shippingFee | number? | 運費（0=免運，null=未知） |
| shippingType | "delivery" \\| "pickup" | 宅配或自取 |
| storageType | "frozen" \\| "room_temp" | 冷凍或常溫 |
| servingsMin | number | 最少人數 |
| servingsMax | number? | 最多人數 |
| orderDeadline | string? | 訂購截止日 YYYY-MM-DD |
| fulfillStart | string? | 到貨開始日 YYYY-MM-DD |
| fulfillEnd | string? | 到貨結束日 YYYY-MM-DD |
| region | string? | 地區：north/central/south/east/islands/nationwide |
| city | string? | 縣市名稱 |
| address | string? | 詳細地址 |
| tags | string[] | 標籤，可選：台式、粵式、日式、西式、海鮮、素食、佛跳牆、烏魚子等 |
| dishes | string[] | 菜色列表，每道菜名稱 |
| imageUrl | string? | 主圖網址 |

## 注意事項
1. 只回傳 JSON，不要其他說明文字
2. 數字欄位請填數字，不要字串
3. 日期格式為 YYYY-MM-DD
4. 無法確定的欄位填 null
5. tags 請從內容判斷適合的標籤
6. dishes 請列出所有提到的菜色名稱`;
}

/**
 * 生成精簡版 Prompt（用於 context 有限的模型）
 */
export function generateCompactPrompt(
  scraped: ScrapedContent,
  hints?: ExtractedHints
): string {
  // 截斷內容
  const shortContent = scraped.content.slice(0, 4000);

  return `擷取年菜資訊，回傳 JSON：

URL: ${scraped.url}
標題: ${scraped.title}
${hints ? `偵測: 價格 ${hints.prices.join('/')} | 份量 ${hints.servings.join('/')}` : ''}

內容:
${shortContent}

回傳格式:
{"vendorName":"","title":"","priceDiscount":0,"priceOriginal":null,"shippingType":"delivery","storageType":"frozen","servingsMin":4,"servingsMax":null,"tags":[],"dishes":[]}

只回傳 JSON。`;
}

/**
 * 解析 AI 回傳的 JSON
 */
export function parseAIResponse(response: string): Partial<Plan> | null {
  try {
    // 嘗試找出 JSON 部分
    let jsonStr = response;

    // 如果被 markdown code block 包裹
    const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1];
    }

    // 如果有多餘文字，嘗試找 { } 範圍
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    const parsed = JSON.parse(jsonStr.trim());

    // 驗證必要欄位
    if (!parsed.vendorName || !parsed.title || !parsed.priceDiscount) {
      console.warn('Missing required fields:', {
        vendorName: parsed.vendorName,
        title: parsed.title,
        priceDiscount: parsed.priceDiscount
      });
    }

    // 正規化資料
    return {
      vendorName: String(parsed.vendorName || '').trim(),
      title: String(parsed.title || '').trim(),
      description: parsed.description ? String(parsed.description).trim() : undefined,
      priceOriginal: typeof parsed.priceOriginal === 'number' ? parsed.priceOriginal : undefined,
      priceDiscount: typeof parsed.priceDiscount === 'number' ? parsed.priceDiscount : 0,
      shippingFee: typeof parsed.shippingFee === 'number' ? parsed.shippingFee : undefined,
      shippingType: ['delivery', 'pickup'].includes(parsed.shippingType) ? parsed.shippingType : 'delivery',
      storageType: ['frozen', 'room_temp'].includes(parsed.storageType) ? parsed.storageType : 'frozen',
      servingsMin: typeof parsed.servingsMin === 'number' ? parsed.servingsMin : 4,
      servingsMax: typeof parsed.servingsMax === 'number' ? parsed.servingsMax : undefined,
      orderDeadline: isValidDate(parsed.orderDeadline) ? parsed.orderDeadline : undefined,
      fulfillStart: isValidDate(parsed.fulfillStart) ? parsed.fulfillStart : undefined,
      fulfillEnd: isValidDate(parsed.fulfillEnd) ? parsed.fulfillEnd : undefined,
      region: parsed.region || undefined,
      city: parsed.city || undefined,
      address: parsed.address || undefined,
      tags: Array.isArray(parsed.tags) ? parsed.tags.filter((t: unknown) => typeof t === 'string') : [],
      dishes: Array.isArray(parsed.dishes) ? parsed.dishes.filter((d: unknown) => typeof d === 'string') : [],
      imageUrl: parsed.imageUrl || undefined,
    };
  } catch (error) {
    console.error('Failed to parse AI response:', error);
    return null;
  }
}

/**
 * 驗證日期格式
 */
function isValidDate(str: unknown): str is string {
  if (typeof str !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(str);
}

/**
 * 生成用於複製到剪貼簿的完整指令
 */
export function generateCLICommand(prompt: string, tool: 'claude' | 'gemini' | 'gpt' = 'claude'): string {
  const escapedPrompt = prompt.replace(/'/g, "'\\''");

  switch (tool) {
    case 'claude':
      return `echo '${escapedPrompt}' | claude`;
    case 'gemini':
      return `echo '${escapedPrompt}' | gemini`;
    case 'gpt':
      return `echo '${escapedPrompt}' | gpt`;
    default:
      return `# 請將以下內容貼到你的 AI CLI:\n${prompt}`;
  }
}
