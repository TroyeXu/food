/**
 * 環境配置 - 支持開發和生產環境切換
 */

export type Environment = 'development' | 'production';

export const getEnvironment = (): Environment => {
  // 檢查編譯時環境變數
  if (typeof window === 'undefined') {
    // 服務器端
    return process.env.NODE_ENV === 'production' ? 'production' : 'development';
  }
  // 客戶端
  return process.env.NEXT_PUBLIC_ENV === 'production' ? 'production' : 'development';
};

export const isDevelopment = (): boolean => getEnvironment() === 'development';
export const isProduction = (): boolean => getEnvironment() === 'production';

/**
 * 數據源配置
 */
export interface DataSourceConfig {
  type: 'database' | 'json';
  description: string;
}

export const getDataSourceConfig = (): DataSourceConfig => {
  const env = getEnvironment();

  if (env === 'development') {
    return {
      type: 'database',
      description: '開發模式：連接 PostgreSQL 數據庫',
    };
  }

  return {
    type: 'json',
    description: '生產模式：讀取靜態 JSON 文件',
  };
};

/**
 * API 基礎 URL
 */
export const getApiBaseUrl = (): string => {
  if (typeof window === 'undefined') {
    // 服務器端
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
  }
  // 客戶端
  return process.env.NEXT_PUBLIC_API_URL || '/api';
};

/**
 * 數據庫連接字符串（僅用於服務器端）
 */
export const getDatabaseUrl = (): string => {
  return process.env.DATABASE_URL || 'postgresql://localhost:5432/lunar_meals';
};

/**
 * 是否啟用 API 路由
 * 開發模式：API 路由和數據庫查詢
 * 生產模式：API 路由返回靜態 JSON
 */
export const useApiRoutes = (): boolean => {
  return isDevelopment();
};

/**
 * 配置日誌
 */
export const logConfig = (): void => {
  const config = {
    environment: getEnvironment(),
    dataSource: getDataSourceConfig(),
    apiUrl: getApiBaseUrl(),
  };

  if (typeof window === 'undefined') {
    console.log('[Config]', JSON.stringify(config, null, 2));
  }
};
