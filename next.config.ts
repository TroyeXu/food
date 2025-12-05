import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === 'production';
const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] || 'food';

const nextConfig: NextConfig = {
  // GitHub Pages 靜態匯出
  output: isProduction ? 'export' : undefined,

  // GitHub Pages base path (例如: /food)
  basePath: isProduction ? `/${repoName}` : '',
  assetPrefix: isProduction ? `/${repoName}/` : '',

  // 設定環境變數給前端使用
  env: {
    NEXT_PUBLIC_BASE_PATH: isProduction ? `/${repoName}` : '',
  },

  // 圖片優化在靜態匯出時需要關閉
  images: {
    unoptimized: true,
  },

  // 禁用 trailing slash 以避免路由問題
  trailingSlash: true,
};

export default nextConfig;
