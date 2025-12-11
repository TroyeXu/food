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
  "shippingTypes": ["delivery"],
  "storageTypes": ["frozen"],
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
| vendorName | string | 餐廳/品牌名稱（必填）|
| title | string | 方案名稱（必填）|
| description | string? | 方案簡短描述 |
| priceOriginal | number? | 原價（無折扣則 null）- 請仔細尋找標示為「原價」「定價」「建議售價」的數字 |
| priceDiscount | number | 售價/特價（必填）- 請尋找「優惠價」「特價」「早鳥價」或主要顯示的價格 |
| shippingFee | number? | 運費（0=免運，null=未知）- 尋找「運費」「滿額免運」等資訊 |
| shippingTypes | string[] | 配送方式陣列：["delivery"]=宅配, ["pickup"]=自取, ["delivery","pickup"]=兩者皆可, ["convenience"]=超商取貨 |
| storageTypes | string[] | 保存方式陣列：["frozen"]=冷凍, ["chilled"]=冷藏, ["room_temp"]=常溫 |
| servingsMin | number | 最少人數 |
| servingsMax | number? | 最多人數 |
| orderDeadline | string? | 訂購截止日 YYYY-MM-DD |
| fulfillStart | string? | 到貨開始日 YYYY-MM-DD |
| fulfillEnd | string? | 到貨結束日 YYYY-MM-DD |
| region | string? | 地區：north/central/south/east/islands/nationwide |
| city | string? | 縣市名稱 |
| address | string? | 詳細地址 |
| tags | string[] | 標籤，可選：台式、粵式、日式、西式、海鮮、素食、佛跳牆、烏魚子、飯店級、米其林、冷凍年菜、禮盒等 |
| dishes | string[] | 菜色列表，每道菜名稱（必填，至少列出 3-5 道主要菜色）|
| imageUrl | string? | 商品主圖網址（必填）- **最重要：務必擷取產品圖片 URL** |

## ⚠️ 圖片擷取說明（最重要！）

**imageUrl 是必填欄位，請務必擷取！**

1. **在 markdown 內容中尋找圖片連結**：
   - 格式如 \`![alt](https://...)\` 或 \`![](url)\`
   - 提取括號內的完整 URL

2. **圖片 URL 特徵**：
   - 通常包含 \`.jpg\`, \`.jpeg\`, \`.png\`, \`.webp\`
   - 常見 CDN 域名：\`cdn.\`, \`images.\`, \`img.\`, \`static.\`, \`media.\`
   - 電商平台：\`shopify\`, \`cloudinary\`, \`imgix\`, \`cyberbiz\`

3. **優先選擇**：
   - 產品主圖、年菜照片、套餐圖片
   - 尺寸較大的圖片（URL 可能包含 600x600, 800x800 等）

4. **避免選擇**：
   - logo、icon（URL 包含 logo, icon, favicon）
   - 按鈕、箭頭（btn, button, arrow）
   - 小於 100x100 的縮圖

## 菜色擷取說明

dishes 陣列請列出所有年菜菜色名稱：
- 從「菜色內容」「套餐內容」「組合包含」等段落擷取
- 每道菜獨立一個字串
- 範例：["佛跳牆", "紅燒獅子頭", "清蒸鱸魚", "干貝米糕"]

## 注意事項
1. 只回傳 JSON，不要其他說明文字
2. 數字欄位請填數字，不要字串
3. 日期格式為 YYYY-MM-DD
4. 無法確定的欄位填 null
5. tags 請從內容判斷適合的標籤
6. **imageUrl 和 dishes 非常重要，務必仔細擷取**
7. 如果找不到價格，請填 0 而非 null`;
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
{"vendorName":"","title":"","priceDiscount":0,"priceOriginal":null,"shippingTypes":["delivery"],"storageTypes":["frozen"],"servingsMin":4,"servingsMax":null,"tags":[],"dishes":[],"imageUrl":null,"shippingFee":null}

欄位說明:
- shippingTypes: ["delivery"]=宅配, ["pickup"]=自取, ["convenience"]=超商取貨
- storageTypes: ["frozen"]=冷凍, ["chilled"]=冷藏, ["room_temp"]=常溫
- imageUrl: 產品主圖網址（務必填寫）
- priceOriginal: 原價（尋找「原價」「定價」）

只回傳 JSON。`;
}

/**
 * 解析 AI 回傳的 JSON
 */
export function parseAIResponse(response: string): Partial<Plan> | null {
  const results = parseAIResponseMultiple(response);
  return results.length > 0 ? results[0] : null;
}

/**
 * 解析 AI 回應（支援多筆資料）
 */
export function parseAIResponseMultiple(response: string): Partial<Plan>[] {
  try {
    // 嘗試找出 JSON 部分
    let jsonStr = response;

    // 如果被 markdown code block 包裹
    const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1];
    }

    // 嘗試找 [ ] 陣列或 { } 物件
    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    const objectMatch = jsonStr.match(/\{[\s\S]*\}/);

    if (arrayMatch) {
      jsonStr = arrayMatch[0];
    } else if (objectMatch) {
      jsonStr = objectMatch[0];
    }

    const parsed = JSON.parse(jsonStr.trim());

    // 如果是陣列，處理每個項目
    const items = Array.isArray(parsed) ? parsed : [parsed];

    return items.map(item => parseSingleItem(item)).filter((x): x is Partial<Plan> => x !== null);
  } catch (error) {
    console.error('Failed to parse AI response:', error);
    return [];
  }
}

function parseSingleItem(parsed: Record<string, unknown>): Partial<Plan> | null {
  try {

    // 驗證必要欄位
    if (!parsed.vendorName || !parsed.title || !parsed.priceDiscount) {
      console.warn('Missing required fields:', {
        vendorName: parsed.vendorName,
        title: parsed.title,
        priceDiscount: parsed.priceDiscount
      });
    }

    // 處理 shippingTypes（新陣列欄位）和 shippingType（舊單選欄位）的相容
    let shippingType: 'delivery' | 'pickup' | 'both' = 'delivery';
    let shippingTypes: string[] | undefined;

    if (Array.isArray(parsed.shippingTypes) && parsed.shippingTypes.length > 0) {
      shippingTypes = parsed.shippingTypes.filter((t: unknown) => typeof t === 'string');
      // 從陣列推導單選值
      if (shippingTypes.includes('delivery') && shippingTypes.includes('pickup')) {
        shippingType = 'both';
      } else if (shippingTypes.includes('pickup')) {
        shippingType = 'pickup';
      } else {
        shippingType = 'delivery';
      }
    } else if (['delivery', 'pickup', 'both'].includes(parsed.shippingType as string)) {
      shippingType = parsed.shippingType as 'delivery' | 'pickup' | 'both';
      // 從單選推導陣列值
      if (shippingType === 'both') {
        shippingTypes = ['delivery', 'pickup'];
      } else {
        shippingTypes = [shippingType];
      }
    }

    // 處理 storageTypes（新陣列欄位）和 storageType（舊單選欄位）的相容
    let storageType: 'frozen' | 'chilled' | 'room_temp' | 'unknown' = 'frozen';
    let storageTypes: string[] | undefined;

    if (Array.isArray(parsed.storageTypes) && parsed.storageTypes.length > 0) {
      storageTypes = parsed.storageTypes.filter((t: unknown) => typeof t === 'string');
      // 從陣列推導單選值（取第一個）
      const firstStorage = storageTypes[0];
      if (['frozen', 'chilled', 'room_temp', 'unknown'].includes(firstStorage)) {
        storageType = firstStorage as 'frozen' | 'chilled' | 'room_temp' | 'unknown';
      }
    } else if (['frozen', 'chilled', 'room_temp', 'unknown'].includes(parsed.storageType as string)) {
      storageType = parsed.storageType as 'frozen' | 'chilled' | 'room_temp' | 'unknown';
      storageTypes = [storageType];
    }

    // 正規化資料
    const result: Partial<Plan> & {
      promotions?: string[];
      visibleText?: string;
      shippingTypes?: string[];
      storageTypes?: string[];
    } = {
      vendorName: String(parsed.vendorName || '').trim(),
      title: String(parsed.title || '').trim(),
      description: parsed.description ? String(parsed.description).trim() : undefined,
      priceOriginal: typeof parsed.priceOriginal === 'number' ? parsed.priceOriginal : undefined,
      priceDiscount: typeof parsed.priceDiscount === 'number' ? parsed.priceDiscount : 0,
      shippingFee: typeof parsed.shippingFee === 'number' ? parsed.shippingFee : undefined,
      shippingType,
      storageType,
      shippingTypes,
      storageTypes,
      servingsMin: typeof parsed.servingsMin === 'number' ? parsed.servingsMin : 4,
      servingsMax: typeof parsed.servingsMax === 'number' ? parsed.servingsMax : undefined,
      orderDeadline: isValidDate(parsed.orderDeadline) ? parsed.orderDeadline : undefined,
      fulfillStart: isValidDate(parsed.fulfillStart) ? parsed.fulfillStart : undefined,
      fulfillEnd: isValidDate(parsed.fulfillEnd) ? parsed.fulfillEnd : undefined,
      region: (parsed.region as any) || undefined,
      city: (parsed.city as any) || undefined,
      address: (parsed.address as any) || undefined,
      tags: Array.isArray(parsed.tags) ? parsed.tags.filter((t: unknown) => typeof t === 'string') : [],
      dishes: Array.isArray(parsed.dishes) ? parsed.dishes.filter((d: unknown) => typeof d === 'string') : [],
      imageUrl: (parsed.imageUrl as any) || undefined,
    };

    // 保留視覺分析特有欄位
    if (Array.isArray(parsed.promotions)) {
      result.promotions = parsed.promotions.filter((p: unknown) => typeof p === 'string');
    }
    if (typeof parsed.visibleText === 'string') {
      result.visibleText = parsed.visibleText;
    }

    return result;
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
