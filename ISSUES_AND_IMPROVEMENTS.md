# 系統問題和改進清單

**生成日期**: 2025-12-11
**分析版本**: 完整系統檢查
**優先級分布**: P0: 4 | P1: 6 | P2: 11 | P3: 4

---

## 🚨 P0 級 (阻擋性問題 - 立即修復)

### P0-1: 文件系統並發訪問導致數據損壞
**位置**: `/src/app/api/reviews/route.ts`, `/src/app/api/shopping-lists/route.ts`, `/src/app/api/price-monitor/route.ts`

**問題描述**:
- 多個並發請求讀寫同一個 JSON 文件
- 沒有文件鎖定機制
- 在高負載下可能導致數據損壞或丟失

**當前代碼**:
```typescript
const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
// ... 修改 data ...
fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
```

**風險等級**: 🔴 極高 (可能導致數據丟失)

**修復方案**:
1. 立即遷移到正式數據庫 (PostgreSQL/MongoDB)
2. 臨時方案: 使用文件鎖定庫 (proper-lockfile)

**預期耗時**: 3-5 天

---

### P0-2: 沒有數據庫層 - 生產環境部署無法持久化
**位置**: `/src/lib/db.ts`, 所有 API 路由

**問題描述**:
- GitHub Pages 靜態託管，無後端存儲
- 評價、購物清單、價格監控無法保存
- 頁面刷新後所有用戶數據丟失

**當前架構**:
```
GitHub Pages (靜態) ← 無法讀寫文件
├─ 評價系統 ❌
├─ 購物清單 ❌
└─ 價格監控 ❌
```

**修復方案**:
1. 部署後端服務 (Node.js + Express)
2. 設置 PostgreSQL 數據庫
3. 實現 API 服務層

**優先級**: 🔴 立即 (影響生產可用性)

**預期耗時**: 5-7 天

---

### P0-3: API 無認證和授權
**位置**: 所有 `/src/app/api/` 端點

**問題描述**:
- 所有 API 都是公開的，無用戶驗證
- 任何人可以讀寫任何數據
- 沒有用戶隔離

**安全漏洞**:
```
GET /api/shopping-lists → 返回所有用戶的購物清單
POST /api/reviews → 任何人都可以發佈評價
DELETE /api/shopping-lists?id=xxx → 刪除他人清單
```

**修復方案**:
1. 實現 JWT 認證
2. 添加用戶 session 管理
3. 實現基於角色的訪問控制 (RBAC)

**預期耗時**: 3-4 天

---

### P0-4: 生產環境部署無法工作
**位置**: `/src/stores/planStore.ts` line 142-160

**問題描述**:
```typescript
// 檢查是否在 GitHub Pages
if (window.location.hostname.includes('github.io')) {
  // 禁用本地存儲
}
```

**實際問題**:
- GitHub Pages 無法訪問 `data/` 文件夾
- 後台爬蟲無法運行
- OCR/AI 提取無法工作

**症狀**:
- 所有新功能（評價、清單、監控）在生產環境無法使用
- 用戶數據無法持久化
- 用戶體驗降級

**修復方案**: 見 P0-2

**預期耗時**: 5-7 天

---

## ⚠️ P1 級 (關鍵問題 - 發布前必須修復)

### P1-1: 類型安全問題 - 大量不安全的類型強制轉換

**位置**: 
- `/src/stores/planStore.ts` line 691, 708
- `/src/app/admin/scraper/page.tsx` (多處 `!` 非空斷言)

**問題代碼**:
```typescript
// ❌ 不安全：假設 shippingTypes 存在
const planShippingTypes = (p as { shippingTypes?: string[] }).shippingTypes ||
  (p.shippingType === 'both' ? ['delivery', 'pickup'] : [p.shippingType]);

// ❌ 非常危險：雙重非空斷言
const price = job.extractedData!.priceDiscount!;
if (!price) { // 永遠不會執行 - 類型系統被繞過
  // ...
}
```

**運行時風險**: 應用崩潰、undefined 訪問

**修復方案**:
```typescript
// ✅ 安全：使用類型守衛
function getShippingTypes(plan: Plan): ShippingType[] {
  if (plan.shippingTypes) return plan.shippingTypes;
  if (plan.shippingType === 'both') return ['delivery', 'pickup'];
  return [plan.shippingType];
}

// ✅ 安全：可選鏈和默認值
const price = job.extractedData?.priceDiscount ?? 0;
```

**預期耗時**: 2 天

---

### P1-2: 評價 API - 無審核和反垃圾機制
**位置**: `/src/app/api/reviews/route.ts` line 103-163

**問題**:
1. **無輸入驗證**:
   - XSS 風險: 無 HTML 清理
   - 尺寸限制: 可以提交 10MB 的評價文本
   - 無數據類型檢查

2. **無反垃圾保護**:
   - 同一用戶可以連續提交 1000 條評價
   - 無速率限制
   - 無內容審核

3. **直接發佈**:
   - 所有評價立即發佈，無審核隊列
   - 無標記違規評價的機制

4. **用戶 ID 生成不安全**:
   ```typescript
   // ❌ 熵不足
   const userId = crypto.randomUUID().substring(0, 16);
   // 比 UUID 短，易猜測，不適合識別用戶
   ```

**修復方案**:
```typescript
// 添加輸入驗證
import { z } from 'zod';

const ReviewSchema = z.object({
  rating: z.number().min(1).max(5),
  title: z.string().min(1).max(100),
  content: z.string().min(10).max(5000),
  dimensionRatings: z.record(z.number().min(1).max(5)).optional(),
});

// 添加速率限制
const rateLimiter = new Map<string, number[]>();
function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const recentRequests = rateLimiter.get(userId) || [];
  const lastMinute = recentRequests.filter(t => now - t < 60000);
  
  if (lastMinute.length > 5) return false; // 限制每分鐘 5 條
  lastMinute.push(now);
  rateLimiter.set(userId, lastMinute);
  return true;
}
```

**預期耗時**: 2-3 天

---

### P1-3: 購物清單 - 狀態同步無回滾機制
**位置**: `/src/stores/shoppingListStore.ts` line 140-179

**問題**:
```typescript
// ❌ 樂觀更新無回滾
addItem: (listId, planId, quantity) => {
  // 立即更新本地狀態
  set(state => ({
    currentList: {
      ...state.currentList,
      items: [...state.currentList.items, { planId, quantity, ... }]
    }
  }));
  
  // 異步 API 調用
  fetch('/api/shopping-lists/add', { ... })
    .catch(err => {
      // 錯誤時無法回滾本地狀態！
      console.error(err);
    });
}
```

**用戶體驗**:
- 添加項目成功顯示
- 網絡錯誤，服務器沒有保存
- 刷新頁面後項目消失
- 用戶困惑

**修復方案**:
```typescript
addItem: async (listId, planId, quantity) => {
  // 保存舊狀態用於回滾
  const previousList = get().currentList;
  
  // 樂觀更新
  set(state => ({
    currentList: { ...state.currentList, items: [...] },
    loading: true,
  }));
  
  try {
    const response = await fetch('/api/shopping-lists/add', { ... });
    if (!response.ok) throw new Error();
    const updated = await response.json();
    set(state => ({ currentList: updated, loading: false }));
  } catch (error) {
    // 錯誤時回滾
    set(state => ({ 
      currentList: previousList,
      error: '添加失敗，請重試',
      loading: false 
    }));
  }
}
```

**預期耗時**: 1-2 天

---

### P1-4: 網絡錯誤處理缺失
**位置**: 所有 `/src/app/api/` 路由

**問題**:
- 沒有重試機制
- 沒有超時設置
- 沒有降級策略
- 沒有詳細的錯誤日誌

**修復方案**:
```typescript
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      
      if (response.ok) return response;
      if (response.status >= 500) throw new Error('Server error');
      return response;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      // 指數退避
      await new Promise(resolve => 
        setTimeout(resolve, Math.pow(2, i) * 1000)
      );
    }
  }
}
```

**預期耗時**: 1-2 天

---

### P1-5: OCR 依賴驗證缺失
**位置**: `/src/app/api/ai-extract/route.ts` line 18-86

**問題**:
```typescript
// ❌ 無驗證 - 如果 Python 不安裝，靜默失敗
const pythonCode = `...`;
const result = execSync(`python3 -c "${pythonCode}"`, { 
  encoding: 'utf-8' 
});
```

**修復方案**:
```typescript
// ✅ 驗證 Python 環境
function validatePythonEnvironment() {
  try {
    const version = execSync('python3 --version', { encoding: 'utf-8' });
    console.log('Python version:', version);
    
    // 驗證 PaddleOCR
    execSync('python3 -c "import paddleocr"', { encoding: 'utf-8' });
    return true;
  } catch (error) {
    console.error('Python 環境驗證失敗:', error.message);
    return false;
  }
}

// 在 API 處理前檢查
if (!validatePythonEnvironment()) {
  return Response.json(
    { error: 'OCR service not available' },
    { status: 503 }
  );
}
```

**預期耗時**: 1 天

---

### P1-6: AI CLI 工具依賴
**位置**: `/src/app/api/ai-extract/route.ts` line 93-142

**問題**:
- 需要本地安裝 claude, gemini, gpt CLI 工具
- 生產環境中不可用
- 無法切換到雲端 API

**修復方案**: 遷移到雲端 API
```typescript
// ✅ 使用 Anthropic SDK
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const response = await client.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 1024,
  messages: [{
    role: 'user',
    content: prompt,
  }],
});
```

**預期耗時**: 2 天

---

## ⚠️ P2 級 (高優先級 - 應該盡快修復)

### P2-1: 沒有分頁 - 性能問題
**位置**: `/src/stores/planStore.ts`

**問題**:
```typescript
// ❌ 返回所有匹配的計劃（可能 300+）
const filteredPlans = plans.filter(/* 條件 */);
// 即使只顯示 20 個，也渲染了 300+ 個組件
```

**修復方案**:
```typescript
// ✅ 實現分頁
getFilteredPlans: (limit = 20, offset = 0) => {
  const filtered = plans.filter(/* 條件 */);
  return {
    items: filtered.slice(offset, offset + limit),
    total: filtered.length,
    hasMore: offset + limit < filtered.length,
  };
}

// 無限滾動
const [offset, setOffset] = useState(0);
const { items, hasMore } = getFilteredPlans(20, offset);

const handleLoadMore = () => setOffset(o => o + 20);
```

**預期耗時**: 2 天

---

### P2-2: 價格提取正則表達式不穩定
**位置**: `/src/app/api/price-monitor/route.ts` line 52-82

**問題**:
```typescript
const pattern = /(?:￥|¥|\$|NT\$|NTD)\s*(\d+(?:[,，]\d{3})*(?:\.\d{2})?)/;
// 只適用於某些格式
// 不處理: "199元", "US$100", "¥1,234.50 起", 等等
```

**修復方案**:
```typescript
function extractPrice(text: string): number | null {
  const patterns = [
    /(?:NT\$|NTD|TWD)\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
    /￥\s*(\d+(?:[,，]\d{3})*(?:\.\d{2})?)/,
    /¥\s*(\d+(?:[,，]\d{3})*(?:\.\d{2})?)/,
    /\$\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/,
    /(\d+(?:[,，]\d{3})*(?:\.\d{2})?)\s*(?:元|RMB|人民幣)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return parseFloat(match[1].replace(/[,，]/g, ''));
    }
  }
  
  return null;
}
```

**預期耗時**: 1 天

---

### P2-3: 圖片 URL 驗證缺失
**位置**: `/src/app/api/ai-extract/route.ts` line 36-42

**問題**:
- 不驗證 URL 有效性
- 不檢查文件大小
- 沒有域名白名單
- 可能加載惡意或損壞的圖片

**修復方案**:
```typescript
async function validateImageUrl(url: string): Promise<boolean> {
  try {
    // 驗證 URL 格式
    const urlObj = new URL(url);
    
    // 白名單域名
    const whitelist = ['img.shopee.tw', 'myfeel.tw', 'mypkg.tw'];
    if (!whitelist.some(domain => url.includes(domain))) {
      return false;
    }
    
    // 檢查文件大小
    const response = await fetch(url, { method: 'HEAD' });
    const size = parseInt(response.headers.get('content-length') || '0');
    
    if (size > 5 * 1024 * 1024) { // 5MB 限制
      return false;
    }
    
    return response.ok;
  } catch (error) {
    return false;
  }
}
```

**預期耗時**: 1 天

---

### P2-4: 移動端響應式設計問題

**位置**: 
- `/src/components/FilterSidebar.tsx` - 側邊欄覆蓋內容
- `/src/components/CompareModal.tsx` - 表格不適配手機
- `/src/components/SortDropdown.tsx` - 排序選項不清楚

**問題**:
```tsx
// ❌ 桌面寬度用於移動設備
<aside className="w-72"> {/* 固定 288px 寬度 */}
```

**修復方案**:
```tsx
// ✅ 響應式設計
<aside className="w-full md:w-72 fixed md:relative bottom-0 md:bottom-auto left-0 md:left-auto">
  {/* 移動設備：全寬底部抽屜 */}
  {/* 桌面設備：側邊欄 */}
</aside>
```

**預期耗時**: 2 天

---

### P2-5: 無測試覆蓋
**位置**: 整個項目

**當前狀態**: 0% 測試覆蓋

**需要添加**:
1. **單元測試** (Jest)
   - `planStore.ts` 過濾、排序邏輯
   - 價格計算函數
   - 距離計算函數

2. **集成測試** (Playwright)
   - 搜索和篩選工作流
   - 購物清單創建/修改
   - 評價提交和投票

3. **API 測試**
   - 所有端點的請求/響應
   - 錯誤場景

**預期耗時**: 5-7 天

---

### P2-6: 無快取策略
**位置**: 所有 API 路由

**問題**:
- 每個請求都讀文件
- 沒有查詢結果快取
- 沒有 HTTP 快取頭

**修復方案**:
```typescript
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 300 }); // 5 分鐘

export async function GET(request: Request) {
  const cacheKey = `plans_${JSON.stringify(filters)}`;
  
  let data = cache.get(cacheKey);
  if (!data) {
    data = await loadPlans(filters);
    cache.set(cacheKey, data);
  }
  
  return Response.json(data, {
    headers: {
      'Cache-Control': 'public, max-age=300',
    },
  });
}
```

**預期耗時**: 1 天

---

### P2-7: 無請求驗證
**位置**: 所有 API 路由

**問題**:
```typescript
// ❌ 接受任何數據
const body = await request.json();
const { planId } = body; // 可能是 undefined, null, 等任何值
```

**修復方案**:
```typescript
import { z } from 'zod';

const AddItemSchema = z.object({
  listId: z.string().uuid(),
  planId: z.string().uuid(),
  quantity: z.number().int().positive(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = AddItemSchema.parse(body);
    // 安全使用 validated
  } catch (error) {
    return Response.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}
```

**預期耗時**: 2 天

---

### P2-8: 無速率限制
**位置**: 所有 API 路由

**修復方案**:
```typescript
import { Ratelimit } from '@upstash/ratelimit';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 m'), // 每分鐘 10 次
});

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for');
  const { success } = await ratelimit.limit(ip);
  
  if (!success) {
    return Response.json(
      { error: 'Too many requests' },
      { status: 429 }
    );
  }
  // ...
}
```

**預期耗時**: 1 天

---

### P2-9: 無可訪問性支持
**位置**: 多個組件

**問題**:
- 沒有 ARIA 標籤
- 顏色作為唯一的狀態指示器
- 無鍵盤導航

**修復方案**:
```tsx
// ✅ 添加無障礙支持
<button
  aria-label="Add to shopping list"
  aria-pressed={isAdded}
  onClick={handleAdd}
>
  🛒 {isAdded ? 'Added' : 'Add to list'}
</button>
```

**預期耗時**: 2-3 天

---

### P2-10: ShippingType 和 StorageType 定義重複
**位置**: `/src/types/index.ts`

**問題**:
```typescript
type ShippingType = 'delivery' | 'pickup' | 'both';

// 在 FilterState 中
shippingType?: ShippingType | 'all';
shippingTypes?: ShippingType[]; // 重複定義！

// 代碼中必須同時處理兩種格式
```

**修復方案**:
```typescript
// 統一使用數組格式
interface FilterState {
  shippingTypes: ShippingType[]; // 移除 shippingType
  storageTypes: StorageType[];   // 移除 storageType
}

// 遷移現有代碼
const filters = {
  shippingTypes: 'delivery' in oldFilters 
    ? [oldFilters.shippingType]
    : oldFilters.shippingTypes,
};
```

**預期耗時**: 1-2 天

---

### P2-11: 圖片錯誤處理不足
**位置**: `/src/components/PlanCard.tsx` line 172-179

**問題**:
```tsx
// ❌ 圖片加載失敗時無回退
<img
  src={plan.imageUrl}
  onError={(e) => {
    e.currentTarget.style.display = 'none'; // 只是隱藏
  }}
/>
```

**修復方案**:
```tsx
const [imgError, setImgError] = useState(false);

{imgError ? (
  <div className="w-full h-48 bg-gray-100 flex items-center justify-center">
    <span className="text-4xl">{getDefaultImage(plan).emoji}</span>
  </div>
) : (
  <img
    src={plan.imageUrl}
    onError={() => setImgError(true)}
    alt={plan.title}
  />
)}
```

**預期耗時**: 1 天

---

## 📊 按優先級統計

| 級別 | 數量 | 預期耗時 |
|------|------|---------|
| P0   | 4    | 20-25 天 |
| P1   | 6    | 12-16 天 |
| P2   | 11   | 18-25 天 |
| P3   | 4    | 5-8 天  |
| **總計** | **25** | **55-74 天** |

---

## 🎯 建議實施順序

### 第 1 週 (P0 - 關鍵)
```
Day 1-2:  設置 PostgreSQL 數據庫
Day 3-4:  實現 API 認證層
Day 5-6:  修復類型安全問題
Day 7:    添加輸入驗證
```

**目標**: 為生產部署做準備

---

### 第 2 週 (P1 - 發布前必須)
```
Day 1-2:  修復評價審核
Day 3:    添加狀態同步回滾
Day 4-5:  改進錯誤處理
Day 6-7:  驗證依賴和環境
```

**目標**: 所有功能可用且穩定

---

### 第 3 週 (P2 - 高優先級)
```
Day 1-2:  實現分頁和性能優化
Day 3:    改進移動端響應式
Day 4-5:  添加測試覆蓋
Day 6-7:  實現快取和速率限制
```

**目標**: 性能和穩定性達到生產標準

---

### 第 4 週 (P3 - 後續)
```
各項改進和優化
```

---

## 🚀 快速修復清單 (可立即開始)

這些可以立即實施，不需要等待其他修改:

- [ ] 添加 Zod 驗證到所有 API
- [ ] 實現評價內容審核
- [ ] 添加狀態同步回滾
- [ ] 改進移動端側邊欄
- [ ] 添加圖片錯誤回退

**預期耗時**: 3-5 天

---

## 📝 後續行動

1. **立即** (今天)
   - 閱讀並理解此文檔
   - 優先評估 P0 問題
   - 規劃數據庫遷移

2. **本週** (3-5 天)
   - 開始 P0 和 P1 修復
   - 設置 PostgreSQL
   - 實現 API 認證

3. **下週** (5-7 天)
   - 完成 P1 修復
   - 開始 P2 改進
   - 初始測試覆蓋

4. **第三週+**
   - P2 和 P3 持續改進
   - 性能優化
   - 生產就緒準備

---

**生成日期**: 2025-12-11
**下次審查建議**: 2025-12-25
**預計完成日期**: 2026-01-31

