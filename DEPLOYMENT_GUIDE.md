# 部署指南 - 開發/生產環境分離

## 概述

本項目支持兩種部署模式：

1. **開發模式** (Development)
   - 使用 PostgreSQL 數據庫
   - API 連接實時數據庫
   - 支持數據編輯和管理
   - 用於本地開發和測試

2. **生產模式** (Production)
   - 使用靜態 JSON 文件
   - 無需數據庫服務
   - 完全靜態，適合 GitHub Pages
   - 數據只讀，所有修改需通過管理後台

---

## 開發模式設置

### 1. 安裝 PostgreSQL

#### macOS
```bash
# 使用 Homebrew
brew install postgresql@15

# 啟動服務
brew services start postgresql@15

# 確認安裝
psql --version
```

#### Ubuntu/Debian
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib

# 啟動服務
sudo systemctl start postgresql
```

#### Windows
- 下載安裝器：https://www.postgresql.org/download/windows/
- 運行安裝程序並記住 postgres 用戶的密碼

### 2. 建立數據庫

```bash
# 連接到 PostgreSQL
psql -U postgres

# 在 psql 提示符中執行：
CREATE DATABASE lunar_meals;
CREATE USER dev_user WITH PASSWORD 'dev_password';
ALTER ROLE dev_user SET client_encoding TO 'utf8';
ALTER ROLE dev_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE dev_user SET default_transaction_deferrable TO on;
ALTER ROLE dev_user SET default_transaction_read_only TO off;
GRANT ALL PRIVILEGES ON DATABASE lunar_meals TO dev_user;

# 退出 psql
\q
```

### 3. 配置環境變數

複製 `.env.example` 並編輯 `.env.local`：

```bash
cp .env.example .env.local
```

編輯 `.env.local`：

```env
NODE_ENV=development
NEXT_PUBLIC_ENV=development

# PostgreSQL 連接字符串
DATABASE_URL=postgresql://dev_user:dev_password@localhost:5432/lunar_meals

# 數據庫日誌
DEBUG=*
```

### 4. 初始化數據庫架構

```bash
# 使用 Prisma（推薦方案）或您選擇的 ORM
npm run db:migrate
```

### 5. 啟動開發服務器

```bash
npm run dev
```

訪問 `http://localhost:3000`

---

## 生產部署流程

### 1. 準備數據

#### 步驟 1A：從數據庫導出 JSON

```bash
# 確保 .env.local 包含有效的 DATABASE_URL
npm run export-data

# 此命令會：
# 1. 連接到 PostgreSQL 數據庫
# 2. 導出所有 Plans 到 public/data/plans.json
# 3. 導出所有 Vendors 到 public/data/vendors.json
# 4. 生成導出統計信息
```

檢查導出結果：

```bash
ls -lah public/data/
# 應該看到：
# - plans.json
# - vendors.json
# - export-stats.json
```

#### 步驟 1B：驗證數據

```bash
# 檢查 JSON 格式是否正確
npm run validate-data  # 可選

# 手動查看數據（取前 10 項）
jq '.[:10]' public/data/plans.json
```

### 2. 構建生產版本

```bash
# 構建包含靜態數據的生產版本
npm run deploy:prepare

# 或分步進行：
npm run export-data
npm run build
```

### 3. 部署到 GitHub Pages

#### 方式 A：使用 GitHub Actions（推薦）

在 `.github/workflows/deploy.yml` 中配置：

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Export data from database
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: npm run export-data

      - name: Build
        run: npm run build

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./out
```

#### 方式 B：手動部署

```bash
# 1. 確保有最新數據
npm run export-data

# 2. 構建靜態站點
npm run build

# 3. 推送到 GitHub
git add .
git commit -m "chore: export data and rebuild for production"
git push origin main
```

### 4. 驗證部署

```bash
# 檢查 public/data 目錄是否被打包
ls -lah .next/static/  # Next.js 輸出

# 驗證 JSON 文件在生產環境中可訪問
curl https://your-repo.github.io/data/plans.json
```

---

## 環境切換

### 檢查當前環境

```typescript
import { isDevelopment, isProduction, getDataSourceConfig } from '@/lib/config';

if (isDevelopment()) {
  console.log('運行在開發模式，連接 PostgreSQL');
} else {
  console.log('運行在生產模式，使用靜態 JSON');
}

const config = getDataSourceConfig();
console.log(config.description);
```

### 環境特定行為

```typescript
import { getDataLayer } from '@/lib/dataLayer';

const dataLayer = getDataLayer();

// 開發模式：支持所有操作
if (isDevelopment()) {
  await dataLayer.addPlan(newPlan);  // ✅ 有效
}

// 生產模式：只讀操作
if (isProduction()) {
  const plans = await dataLayer.getAllPlans();  // ✅ 有效
  await dataLayer.addPlan(newPlan);  // ❌ 拋出錯誤
}
```

---

## 數據同步工作流程

### 定期更新

定期同步開發數據庫到生產環境的推薦工作流程：

```bash
# 1. 在開發環境進行編輯
# ... 在 http://localhost:3000 上編輯數據 ...

# 2. 導出最新數據
npm run export-data

# 3. 提交更改
git add public/data/
git commit -m "feat: update meal plans data"

# 4. 推送到主分支（自動部署）
git push origin main
```

### 自動化更新（可選）

使用 cron job 定期導出數據：

```bash
# crontab -e
# 每天早上 6 點導出數據
0 6 * * * cd /path/to/project && npm run export-data && git add public/data && git commit -m "chore: daily data export" && git push origin main
```

---

## 常見問題

### Q1: 生產環境可以編輯數據嗎？

**A:** 不能。生產環境是只讀的，使用靜態 JSON 文件。所有編輯必須：
1. 在開發環境的數據庫中進行
2. 導出到 JSON
3. 部署生產環境

### Q2: 如何在 GitHub Pages 上使用自定義數據？

**A:**
1. 編輯開發環境的數據
2. 運行 `npm run export-data`
3. 提交 `public/data/` 目錄的更改
4. 推送到 main 分支

### Q3: 如何回滾到上一個版本的數據？

**A:**
```bash
# 查看 Git 歷史
git log --oneline public/data/

# 恢復到特定提交
git checkout <commit-hash> public/data/

# 重新部署
git add .
git commit -m "chore: revert data to previous version"
git push origin main
```

### Q4: 可以同時運行開發和生產環境嗎？

**A:** 可以，使用不同的端口：
```bash
# 開發服務器 (開發模式)
npm run dev  # :3000

# 生產預覽 (生產模式)
npm run build
npm run start  # :3000 (會覆蓋開發服務器)
```

建議在不同的機器或使用 Docker 隔離環境。

### Q5: 如何測試生產環境的行為？

**A:**
```bash
# 構建並以生產模式啟動
NODE_ENV=production npm run build
NODE_ENV=production npm run start

# 訪問 http://localhost:3000
# 現在應該從 public/data/plans.json 讀取數據
```

---

## 性能考慮

### 開發模式
- 數據庫查詢速度：取決於 PostgreSQL 性能
- 首次加載：500ms - 2s（取決於數據量）
- 編輯操作：即時保存到數據庫

### 生產模式
- 文件加載：通常 < 100ms（由 GitHub Pages CDN 緩存）
- 首次加載：100ms - 500ms
- 完全離線可用（在瀏覽器緩存後）

---

## 故障排除

### 導出失敗

```bash
# 檢查數據庫連接
psql $DATABASE_URL -c "SELECT 1;"

# 查看詳細錯誤
DEBUG=* npm run export-data

# 確保目錄存在
mkdir -p public/data
```

### 生產環境找不到 JSON 文件

```bash
# 檢查文件是否被打包
ls -lah .next/static/

# 確認 .gitignore 沒有忽略 public/data
git status public/data/
```

### 開發環境無法連接數據庫

```bash
# 確認 PostgreSQL 運行
psql -U postgres -c "\l"

# 測試連接字符串
psql $DATABASE_URL

# 查看錯誤日誌
tail -f /var/log/postgresql/
```

---

## 下一步

1. [設置 ORM (Prisma)](#orm-setup)
2. [配置 CI/CD Pipeline](#cicd)
3. [性能優化](#performance)
4. [備份和恢復策略](#backup)
