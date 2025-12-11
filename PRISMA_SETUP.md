# Prisma ORM 設置指南

本指南說明如何使用 Prisma 連接 PostgreSQL 數據庫。

## 前置要求

- Node.js 18+
- PostgreSQL 13+
- npm 或 yarn

## 1. 環境配置

### 1.1 更新 `.env.local`

```env
# PostgreSQL 連接字符串
DATABASE_URL="postgresql://username:password@localhost:5432/lunar_meals"

# 開發環境
NODE_ENV=development
NEXT_PUBLIC_ENV=development

# Prisma
PRISMA_SKIP_ENGINE_CHECK=false
```

### 1.2 驗證環境變數

```bash
echo $DATABASE_URL
# 應該輸出: postgresql://...
```

## 2. 數據庫初始化

### 2.1 創建數據庫

```bash
# 使用 psql 連接 PostgreSQL
psql -U postgres

# 在 PostgreSQL 提示符中：
CREATE DATABASE lunar_meals;
\q
```

### 2.2 執行初始遷移

```bash
# 生成 Prisma client 和應用遷移
npx prisma migrate dev --name init

# 這將：
# 1. 建立所有表和索引
# 2. 生成 @prisma/client
# 3. 提示命名遷移（選擇 "init"）
```

### 2.3 驗證設置

```bash
# 連接到數據庫並檢查表
npx prisma studio

# 或使用 psql
psql $DATABASE_URL -c "\dt"
# 應該看到：vendors, plans, reviews, shopping_lists 等表
```

## 3. 常見命令

### 查看數據庫狀態

```bash
# 互動式數據庫 UI
npx prisma studio

# 命令行检查
npx prisma db pull  # 從現有數據庫提取架構
npx prisma db push  # 推送架構到數據庫（開發用）
```

### 管理遷移

```bash
# 建立新遷移
npx prisma migrate dev --name add_users_table

# 檢查遷移狀態
npx prisma migrate status

# 重置數據庫（清除所有數據！）
npx prisma migrate reset

# 部署遷移（生產環境）
npx prisma migrate deploy
```

### 生成客戶端

```bash
# 重新生成 @prisma/client
npx prisma generate

# 檢查型別
npx prisma format
```

## 4. 在 Next.js 中使用

### 4.1 在 API 路由中

```typescript
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const plans = await prisma.plan.findMany({
    include: { vendor: true },
    take: 10,
  });

  return NextResponse.json(plans);
}
```

### 4.2 在服務器組件中

```typescript
import { prisma } from '@/lib/prisma';

export default async function Dashboard() {
  const stats = await prisma.plan.aggregate({
    _count: true,
    _avg: { priceDiscount: true },
  });

  return (
    <div>
      <p>總計劃數: {stats._count}</p>
      <p>平均價格: {stats._avg.priceDiscount}</p>
    </div>
  );
}
```

### 4.3 事務處理

```typescript
const result = await prisma.$transaction(async (tx) => {
  // 建立計劃
  const plan = await tx.plan.create({
    data: { /* ... */ },
  });

  // 建立評價
  const review = await tx.review.create({
    data: {
      planId: plan.id,
      /* ... */
    },
  });

  return { plan, review };
});
```

## 5. 數據導出流程

### 5.1 從 Prisma 導出到 JSON

```typescript
// scripts/export-to-json.ts
import { prisma } from '@/src/lib/prisma';

async function exportData() {
  const plans = await prisma.plan.findMany({
    include: { vendor: true, reviews: true },
  });

  const vendors = await prisma.vendor.findMany();

  // 寫入 JSON
  fs.writeFileSync(
    'public/data/plans.json',
    JSON.stringify(plans, null, 2)
  );
}

exportData();
```

運行：
```bash
npm run export-data
```

## 6. 備份和恢復

### 6.1 備份數據庫

```bash
# 使用 pg_dump
pg_dump $DATABASE_URL > backup.sql

# 壓縮
gzip backup.sql
```

### 6.2 恢復數據庫

```bash
# 恢復
gunzip backup.sql.gz
psql $DATABASE_URL < backup.sql
```

## 7. 常見問題

### Q: 如何將現有數據導入？

```bash
# 從 JSON 導入
npx prisma db seed

# 在 prisma/seed.ts 中定義種子數據
```

### Q: 如何修改架構？

```bash
# 1. 編輯 prisma/schema.prisma
# 2. 執行遷移
npx prisma migrate dev --name describe_change

# 3. Prisma 會：
#    - 檢測更改
#    - 生成遷移文件
#    - 應用到數據庫
#    - 重新生成 client
```

### Q: 生產環境如何部署？

```bash
# 1. 確保 DATABASE_URL 已設置
# 2. 執行遷移
npx prisma migrate deploy

# 3. 導出數據
npm run export-data

# 4. 構建並部署
npm run build
```

### Q: 如何檢查數據庫連接？

```bash
# 運行 Prisma Studio
npx prisma studio

# 或在代碼中
const connected = await checkDatabaseConnection();
```

### Q: 如何安全地刪除數據？

```typescript
// 刪除特定計劃
await prisma.plan.delete({
  where: { id: planId },
});

// 清空表（謹慎！）
await prisma.plan.deleteMany({});

// 保留外鍵約束
// Prisma 會自動處理級聯刪除
```

## 8. 性能優化

### 8.1 添加索引

```prisma
model Plan {
  // ... 字段定義

  // 單個索引
  @@index([vendorId])
  @@index([status])
  @@index([createdAt])

  // 複合索引
  @@index([vendorId, status])

  // 唯一索引
  @@unique([vendorId, title])
}
```

### 8.2 查詢優化

```typescript
// ❌ 不好 - N+1 查詢
const plans = await prisma.plan.findMany();
const reviews = await Promise.all(
  plans.map(p => prisma.review.findMany({ where: { planId: p.id } }))
);

// ✅ 好 - 單個查詢
const plans = await prisma.plan.findMany({
  include: { reviews: true },
});
```

### 8.3 分頁

```typescript
const plans = await prisma.plan.findMany({
  skip: (page - 1) * pageSize,
  take: pageSize,
  orderBy: { createdAt: 'desc' },
});
```

## 9. 相關命令快速參考

```bash
# 開發工作流
npm run dev                    # 啟動開發服務器
npx prisma studio            # 打開數據庫 UI
npx prisma migrate dev        # 創建新遷移

# 生成和檢查
npx prisma generate          # 重新生成 client
npx prisma format            # 格式化 schema
npx prisma validate          # 驗證 schema

# 數據操作
npx prisma db push           # 推送架構
npx prisma db pull           # 從數據庫拉取架構
npx prisma db seed           # 運行種子腳本
npx prisma migrate reset     # 重置數據庫

# 生產環境
npx prisma migrate deploy    # 部署遷移
npm run export-data          # 導出到 JSON
npm run build                # 構建生產版本
```

## 10. 下一步

1. [設置 GitHub Actions 自動遷移](./DEPLOYMENT_GUIDE.md#cicd)
2. [配置 Prisma Accelerate（可選性能優化）](https://www.prisma.io/data-platform/accelerate)
3. [實施數據驗證和中間件](./ARCHITECTURE.md#middleware)
4. [設置監控和日誌](./monitoring.md)
