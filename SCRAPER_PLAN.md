# 年菜爬蟲系統實作計劃

## 需求摘要
- 爬取任意 URL 的年菜資訊
- 透過本地 AI CLI（claude/gemini/codex）手動確認每筆資料
- 支援單一 URL 和批次匯入

## 工作流程

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  貼入 URL    │ ──▶ │  爬取網頁    │ ──▶ │  生成 AI     │ ──▶ │  本地 AI CLI │
│  (單一/批次) │     │  內容        │     │  Prompt      │     │  手動處理    │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                                                                       │
                                                                       ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  儲存到資料庫│ ◀── │  人工校正    │ ◀── │  填入表單    │ ◀── │  貼回 JSON   │
│              │     │  EditPanel   │     │              │     │  結果        │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

## 實作架構

### 1. 新增檔案

#### `src/lib/scraper.ts` - 網頁爬取模組
```typescript
// 爬取網頁 HTML
export async function fetchPageContent(url: string): Promise<{
  html: string;
  title: string;
  text: string;
  images: string[];
}>;

// 清理 HTML 取得純文字
export function extractTextContent(html: string): string;

// 嘗試找出價格、份量等關鍵資訊
export function extractHints(text: string): {
  prices: number[];
  servings: string[];
  dates: string[];
};
```

#### `src/lib/aiPrompt.ts` - AI Prompt 生成
```typescript
// 生成給 AI 的 prompt
export function generateExtractionPrompt(content: {
  url: string;
  title: string;
  text: string;
  hints: object;
}): string;

// 解析 AI 回傳的 JSON
export function parseAIResponse(response: string): Partial<Plan>;
```

#### `scripts/scrape-plan.ts` - CLI 腳本（可選）
```bash
# 使用方式
npx tsx scripts/scrape-plan.ts https://example.com/newyear-menu

# 輸出 prompt 到檔案
npx tsx scripts/scrape-plan.ts https://example.com/newyear-menu --output prompt.txt

# 批次處理多個 URL
npx tsx scripts/scrape-plan.ts --batch urls.txt
```

### 2. 修改檔案

#### `src/components/ImportModal.tsx` - 增強匯入功能
- 新增「爬取內容」預覽區
- 新增「複製 AI Prompt」按鈕
- 新增「貼上 AI 回應」輸入區
- 解析 JSON 後自動填入 EditPanel

#### `src/app/admin/page.tsx` - 新增批次匯入
- 新增「批次匯入」按鈕
- 開啟 BatchImportModal

### 3. 新增元件

#### `src/components/BatchImportModal.tsx` - 批次匯入
- 接受多行 URL 輸入
- 逐一處理每個 URL
- 顯示處理進度
- 每筆資料產生獨立的 AI prompt

## AI Prompt 範例

```markdown
請從以下網頁內容擷取年菜方案資訊，並以 JSON 格式回傳：

## 網頁資訊
- URL: https://example.com/newyear-menu
- 標題: 2025 年菜預購

## 網頁內容
[爬取的文字內容...]

## 請擷取以下欄位

{
  "vendorName": "餐廳/品牌名稱",
  "title": "方案名稱",
  "description": "方案描述",
  "priceOriginal": 原價（數字，無則 null）,
  "priceDiscount": 售價（數字，必填）,
  "shippingFee": 運費（數字，0=免運，無則 null）,
  "shippingType": "delivery" 或 "pickup",
  "storageType": "frozen" 或 "room_temp",
  "servingsMin": 最少人數（數字）,
  "servingsMax": 最多人數（數字，無則 null）,
  "orderDeadline": "截止日期 YYYY-MM-DD 格式",
  "fulfillStart": "到貨開始日 YYYY-MM-DD",
  "fulfillEnd": "到貨結束日 YYYY-MM-DD",
  "tags": ["標籤1", "標籤2"],
  "dishes": ["菜色1", "菜色2", "菜色3"],
  "imageUrl": "主圖網址"
}

只回傳 JSON，不要其他說明文字。
```

## 需要安裝的套件

```bash
npm install cheerio   # HTML 解析
npm install -D tsx    # TypeScript CLI 執行
```

## 實作步驟

### 步驟 1: 基礎爬蟲模組
- [ ] 建立 `src/lib/scraper.ts`
- [ ] 實作 `fetchPageContent()` 函數
- [ ] 實作 `extractTextContent()` 函數

### 步驟 2: AI Prompt 生成
- [ ] 建立 `src/lib/aiPrompt.ts`
- [ ] 設計 prompt 模板
- [ ] 實作 `parseAIResponse()` 解析器

### 步驟 3: 更新 ImportModal
- [ ] 顯示爬取的網頁內容
- [ ] 新增「複製 Prompt」按鈕
- [ ] 新增「貼上 AI 回應」輸入框
- [ ] 解析後帶入 EditPanel

### 步驟 4: 批次匯入
- [ ] 建立 `BatchImportModal` 元件
- [ ] 處理多 URL 輸入
- [ ] 進度顯示與錯誤處理

### 步驟 5: CLI 腳本（可選）
- [ ] 建立 `scripts/scrape-plan.ts`
- [ ] 支援單一 URL 和批次模式
- [ ] 輸出格式化的 prompt

## 注意事項

1. **CORS 限制**: 瀏覽器端無法直接爬取其他網站，需要：
   - 使用 Next.js API Route 作為代理
   - 或使用 CLI 腳本在 Node.js 環境執行

2. **反爬蟲**: 部分網站可能有反爬機制
   - 設定適當的 User-Agent
   - 加入延遲避免過度請求

3. **資料清理**: 爬取的內容可能很雜亂
   - 移除廣告、導航等無關內容
   - 保留價格、日期等關鍵資訊
