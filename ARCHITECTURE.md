# 架構文檔 - 開發/生產環境分離

## 系統架構概述

```
┌─────────────────────────────────────────────────────────────┐
│                      年菜比較系統 v2.0                       │
│              (Lunar New Year Meal Comparison)               │
└─────────────────────────────────────────────────────────────┘

                           ┌──────────────┐
                           │  用戶 (Browser)   │
                           └────────┬─────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │                               │
        ┌───────────▼──────────┐      ┌────────────▼───────────┐
        │   開發模式 (localhost:3000)   │  生產模式 (GitHub Pages)  │
        │     (NODE_ENV=dev)   │      │  (NODE_ENV=prod)     │
        └───────────┬──────────┘      └────────────┬───────────┘
                    │                               │
        ┌───────────▼──────────┐      ┌────────────▼───────────┐
        │  Next.js Dev Server  │      │  Static HTML + JSON   │
        │   (with API routes)  │      │   (GitHub Pages)      │
        └───────────┬──────────┘      └────────────┬───────────┘
                    │                               │
        ┌───────────▼──────────┐      ┌────────────▼───────────┐
        │   /api/plans         │      │ /data/plans.json      │
        │   /api/vendors       │      │ /data/vendors.json    │
        └───────────┬──────────┘      └────────────┬───────────┘
                    │                               │
        ┌───────────▼──────────┐                   │
        │   PostgreSQL DB      │                   │
        │   (localhost:5432)   │                   │
        └──────────────────────┘                   │
                    │                               │
                    └────────────────┬──────────────┘
                                     │
                         ┌───────────▼────────┐
                         │   dataLayer.ts     │
                         │   (抽象接口)      │
                         └────────────────────┘
```

## 數據層架構

### 核心組件

#### 1. **配置系統** (`src/lib/config.ts`)

```typescript
// 環境檢測
isDevelopment() → boolean
isProduction() → boolean

// 配置檢索
getEnvironment() → 'development' | 'production'
getDataSourceConfig() → { type: 'database' | 'json' }
getDatabaseUrl() → string
getApiBaseUrl() → string
```

**用途**: 在編譯時和運行時檢測環境

#### 2. **數據層抽象** (`src/lib/dataLayer.ts`)

```typescript
interface DataLayer {
  // Plans
  getAllPlans(): Promise<Plan[]>
  getPlanById(id: string): Promise<Plan | undefined>
  addPlan(plan): Promise<string>
  updatePlan(id, updates): Promise<void>
  deletePlan(id): Promise<void>

  // Vendors
  getAllVendors(): Promise<Vendor[]>
  addVendor(vendor): Promise<string>
  deleteVendor(id): Promise<void>
}
```

**實現方式**:
- **開發模式**: `DevelopmentDataLayer` 通過 HTTP 調用 API
- **生產模式**: `ProductionDataLayer` 直接讀取靜態 JSON

#### 3. **API 路由** (`src/app/api/plans/route.ts`)

```typescript
// GET /api/plans
// 開發: 查詢 PostgreSQL
// 生產: 返回 503 Service Unavailable

// POST /api/plans
// 開發: 插入新記錄
// 生產: 返回 405 Method Not Allowed
```

---

## 環境分離流程

### 開發流程

```
Local Dev  →  Next.js Dev Server  →  /api/plans  →  PostgreSQL
   (3000)         (Node.js)            (Node.js)      (5432)

┌──────────┐    ┌──────────────┐    ┌──────────┐    ┌──────────┐
│ Browser  │    │  Next.js API │    │   ORM    │    │   DB     │
│ 修改數據  │ → │   Handler    │ → │ (Prisma) │ → │ 儲存數據 │
└──────────┘    └──────────────┘    └──────────┘    └──────────┘
```

### 生產流程

#### 步驟 1: 開發環境導出

```bash
npm run export-data

┌──────────────┐    ┌────────────┐    ┌──────────────┐
│ PostgreSQL   │    │  Export    │    │ JSON Files   │
│  Database    │ → │  Script    │ → │ (public/data)│
└──────────────┘    └────────────┘    └──────────────┘
```

#### 步驟 2: 構建和部署

```bash
npm run build

┌──────────────┐    ┌────────────┐    ┌──────────────┐
│ public/data/ │    │ Next.js    │    │ GitHub Pages │
│  (JSON)      │ → │ build      │ → │ (Static)     │
└──────────────┘    └────────────┘    └──────────────┘
```

#### 步驟 3: 生產運行

```
Browser  →  fetch(/data/plans.json)  →  GitHub Pages CDN

┌────────┐    ┌──────────────────┐    ┌────────────┐
│Browser │    │ Static JSON      │    │   CDN      │
│ 讀取數據│ ← │ (public/data/)   │ ← │ (緩存)     │
└────────┘    └──────────────────┘    └────────────┘
```

---

## 代碼示例

### 在組件中使用數據層

```typescript
import { getDataLayer } from '@/lib/dataLayer';
import { isDevelopment } from '@/lib/config';

export default function PlansList() {
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    const loadPlans = async () => {
      const dataLayer = getDataLayer();
      const allPlans = await dataLayer.getAllPlans();
      setPlans(allPlans);
    };

    loadPlans();
  }, []);

  // 開發環境可以編輯；生產環境只讀
  const handleAdd = async (plan: NewPlan) => {
    if (!isDevelopment()) {
      alert('生產環境不支持編輯。請在開發環境進行修改。');
      return;
    }

    const dataLayer = getDataLayer();
    const newId = await dataLayer.addPlan(plan);
    setPlans([...plans, { ...plan, id: newId }]);
  };

  return (
    // ... 渲染 UI
  );
}
```

### 在 API 路由中檢測環境

```typescript
import { isDevelopment } from '@/lib/config';

export async function POST(request: NextRequest) {
  if (!isDevelopment()) {
    return NextResponse.json(
      { error: 'Cannot modify data in production mode' },
      { status: 405 }
    );
  }

  // 僅在開發模式中執行
  const body = await request.json();
  // 保存到數據庫...
}
```

---

## 環境變數

### 開發環境 (`.env.local`)

```env
NODE_ENV=development
NEXT_PUBLIC_ENV=development
DATABASE_URL=postgresql://user:pass@localhost:5432/lunar_meals
DEBUG=*
```

### 生產環境 (GitHub Pages)

```env
NODE_ENV=production
NEXT_PUBLIC_ENV=production
# 不需要 DATABASE_URL
```

---

## 數據流向圖

### 開發模式數據流

```
┌────────────┐
│ PostgreSQL │
└─────┬──────┘
      │ SELECT * FROM plans
      │
┌─────▼────────────────┐
│  Next.js API Routes  │
│  (Server-side code)  │
└─────┬────────────────┘
      │ JSON response
      │
┌─────▼──────────────┐
│  Client (Browser)  │
│  fetch('/api/plans')
└────────────────────┘
```

### 生產模式數據流

```
┌──────────────────┐
│  public/data/    │
│  plans.json      │
└─────┬────────────┘
      │ Static file
      │
┌─────▼──────────────────┐
│  GitHub Pages CDN      │
│  (Cached)              │
└─────┬──────────────────┘
      │ HTTP GET /data/plans.json
      │
┌─────▼──────────────┐
│  Client (Browser)  │
│  fetch('/data/plans.json')
└────────────────────┘
```

---

## 性能特性

| 指標 | 開發模式 | 生產模式 |
|------|--------|--------|
| **數據庫查詢** | ~500ms | N/A |
| **JSON 載入** | ~10ms | ~50ms (CDN) |
| **首屏加載** | 1-3s | 500ms-1s |
| **編輯操作** | 即時 | 不支持 |
| **數據同步** | 實時 | 靜態 (部署時) |
| **離線支持** | 否 | 是 (CDN 緩存) |
| **冷啟動** | 數秒 | 毫秒 |

---

## 擴展性

### 添加新的數據類型

1. **定義 TypeScript 類型** (`src/types/`)
2. **更新 DataLayer 接口** (`src/lib/dataLayer.ts`)
3. **實現兩個版本**:
   - `DevelopmentDataLayer`: 添加 API 調用
   - `ProductionDataLayer`: 添加 JSON 讀取
4. **創建 API 路由** (如果需要)
5. **更新導出腳本** (`scripts/export-to-json.ts`)

### 示例：添加 Reviews 數據

```typescript
// 1. DataLayer 接口
interface DataLayer {
  getAllReviews(): Promise<Review[]>;
  addReview(review: NewReview): Promise<string>;
}

// 2. 開發模式
class DevelopmentDataLayer implements DataLayer {
  async getAllReviews() {
    const response = await fetch('/api/reviews');
    return response.json();
  }
}

// 3. 生產模式
class ProductionDataLayer implements DataLayer {
  async getAllReviews() {
    const response = await fetch('/data/reviews.json');
    return response.json();
  }
}

// 4. 導出腳本
async function exportReviewsFromDatabase() {
  const reviews = await db.review.findMany();
  return reviews;
}
```

---

## 故障恢復

### 問題：生產環境無法加載數據

**解決方案**:
```typescript
// 帶有降級的 try-catch
async function loadPlans() {
  try {
    const dataLayer = getDataLayer();
    return await dataLayer.getAllPlans();
  } catch (error) {
    console.error('Failed to load plans:', error);
    // 返回緩存數據或空陣列
    return JSON.parse(localStorage.getItem('cachedPlans') || '[]');
  }
}
```

### 問題：開發環境數據庫離線

**解決方案**:
```typescript
// 檢測數據庫連接
async function checkDatabaseConnection() {
  try {
    const response = await fetch('/api/health-check');
    return response.ok;
  } catch {
    return false;
  }
}

// 在應用啟動時檢查
useEffect(() => {
  if (isDevelopment()) {
    checkDatabaseConnection().then((isConnected) => {
      if (!isConnected) {
        showNotification('警告：無法連接到數據庫');
      }
    });
  }
}, []);
```

---

## 部署檢查清單

- [ ] `.env.local` 包含有效的 `DATABASE_URL`
- [ ] PostgreSQL 數據庫已啟動並包含最新數據
- [ ] 運行 `npm run export-data` 並驗證 `public/data/` 中的 JSON 文件
- [ ] 運行 `npm run build` 確保構建成功
- [ ] 測試生產模式 `NODE_ENV=production npm run start`
- [ ] 驗證所有 JSON 文件都被包含在構建中
- [ ] 提交 `public/data/` 到 Git
- [ ] 推送到 main 分支（自動部署到 GitHub Pages）
- [ ] 驗證 https://your-repo.github.io 可以訪問

---

## 相關文檔

- [部署指南](./DEPLOYMENT_GUIDE.md) - 詳細的部署步驟
- [環境配置](./src/lib/config.ts) - 配置系統實現
- [數據層](./src/lib/dataLayer.ts) - 抽象接口實現
- [API 路由](./src/app/api/) - 後端 API 實現
