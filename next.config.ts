import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === 'production';
const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';
const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] || 'food';

const nextConfig: NextConfig = {
  // GitHub Pages 靜態匯出 - 僅在 GitHub Actions 中啟用
  // 本地開發保持動態模式以支援 API 路由
  output: isGitHubActions ? 'export' : undefined,

  // GitHub Pages base path (例如: /food)
  basePath: isProduction ? `/${repoName}` : '',
  assetPrefix: isProduction ? `/${repoName}/` : '',

  // 設定環境變數給前端使用
  env: {
    NEXT_PUBLIC_BASE_PATH: isProduction ? `/${repoName}` : '',
  },

  // 圖片優化
  images: {
    unoptimized: isGitHubActions, // GitHub Pages 不支援動態優化
    formats: ['image/webp', 'image/avif'], // 現代格式優先
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000, // 1 年快取
  },

  // 禁用 trailing slash 以避免路由問題
  trailingSlash: true,

  // ====== 性能優化 ======

  // 啟用實驗性功能以改進性能
  experimental: {
    optimizePackageImports: ['zustand', 'dexie'],
  },

  // 壓縮
  compress: true,

  // 生成 ETag
  generateEtags: true,

  // 預連接
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },

  // 頁面緩衝
  staticPageGenerationTimeout: 120,
};

export default nextConfig;
