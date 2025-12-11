/**
 * 安全和驗證工具
 *
 * 用途：
 * - CORS 和安全頭設置
 * - 輸入驗證和消毒
 * - XSS 防護
 * - CSRF 防護概念
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * 安全頭配置
 */
export interface SecurityHeaders {
  'Content-Security-Policy'?: string;
  'X-Content-Type-Options'?: string;
  'X-Frame-Options'?: string;
  'X-XSS-Protection'?: string;
  'Referrer-Policy'?: string;
  'Permissions-Policy'?: string;
  'Strict-Transport-Security'?: string;
}

/**
 * 默認安全頭
 */
export const DEFAULT_SECURITY_HEADERS: SecurityHeaders = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy':
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
};

/**
 * 添加安全頭到響應
 */
export function addSecurityHeaders(
  response: NextResponse,
  headers: Partial<SecurityHeaders> = {}
): NextResponse {
  const allHeaders = {
    ...DEFAULT_SECURITY_HEADERS,
    ...headers,
  };

  Object.entries(allHeaders).forEach(([key, value]) => {
    if (value) {
      response.headers.set(key, value);
    }
  });

  // HSTS 頭（如果使用 HTTPS）
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  return response;
}

/**
 * CORS 配置
 */
export interface CorsConfig {
  origin?: string | string[] | RegExp;
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

/**
 * 默認 CORS 配置
 */
export const DEFAULT_CORS_CONFIG: CorsConfig = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Trace-Id'],
  exposedHeaders: ['X-Trace-Id', 'X-RateLimit-Remaining', 'X-Response-Time'],
  credentials: true,
  maxAge: 86400,
};

/**
 * 檢查 CORS
 */
function isCorsAllowed(origin: string | null, config: CorsConfig): boolean {
  if (!origin) return false;

  const corsOrigin = config.origin;

  if (typeof corsOrigin === 'string') {
    return corsOrigin === origin || corsOrigin === '*';
  }

  if (Array.isArray(corsOrigin)) {
    return corsOrigin.includes(origin) || corsOrigin.includes('*');
  }

  if (corsOrigin instanceof RegExp) {
    return corsOrigin.test(origin);
  }

  return false;
}

/**
 * 添加 CORS 頭到響應
 */
export function addCorsHeaders(
  response: NextResponse,
  request: NextRequest,
  config: Partial<CorsConfig> = {}
): NextResponse {
  const corsConfig = {
    ...DEFAULT_CORS_CONFIG,
    ...config,
  };

  const origin = request.headers.get('origin');

  if (isCorsAllowed(origin, corsConfig)) {
    response.headers.set('Access-Control-Allow-Origin', origin || '*');
    response.headers.set('Access-Control-Allow-Methods', corsConfig.methods?.join(',') || '');
    response.headers.set('Access-Control-Allow-Headers', corsConfig.allowedHeaders?.join(',') || '');
    response.headers.set('Access-Control-Expose-Headers', corsConfig.exposedHeaders?.join(',') || '');

    if (corsConfig.credentials) {
      response.headers.set('Access-Control-Allow-Credentials', 'true');
    }

    if (corsConfig.maxAge) {
      response.headers.set('Access-Control-Max-Age', corsConfig.maxAge.toString());
    }
  }

  return response;
}

/**
 * HTML 實體編碼
 */
export function htmlEncode(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char] || char);
}

/**
 * 清理用戶輸入
 */
export function sanitizeInput(input: string, maxLength: number = 5000): string {
  if (typeof input !== 'string') {
    return '';
  }

  // 截斷超長輸入
  let cleaned = input.substring(0, maxLength);

  // 移除 HTML 標籤
  cleaned = cleaned.replace(/<[^>]*>/g, '');

  // 移除 JavaScript 協議
  cleaned = cleaned.replace(/javascript:/gi, '');

  // 移除事件處理程序
  cleaned = cleaned.replace(/on\w+\s*=/gi, '');

  // HTML 編碼
  cleaned = htmlEncode(cleaned);

  // 移除過多空格
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

/**
 * 驗證 URL
 */
export function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    // 只允許 HTTP 和 HTTPS
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * 驗證郵箱
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * 驗證 UUID
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * 生成 CSRF 令牌
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * 驗證 CSRF 令牌
 */
export function validateCsrfToken(token: string, storedToken: string): boolean {
  // 使用恆定時間比較防止時間攻擊
  const tokenBuffer = Buffer.from(token);
  const storedBuffer = Buffer.from(storedToken);

  if (tokenBuffer.length !== storedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(tokenBuffer, storedBuffer);
}

/**
 * 密碼強度驗證
 */
export interface PasswordStrengthResult {
  isStrong: boolean;
  score: number; // 0-4
  feedback: string[];
}

export function validatePasswordStrength(password: string): PasswordStrengthResult {
  const feedback: string[] = [];
  let score = 0;

  if (password.length < 8) {
    feedback.push('密碼至少需要 8 個字符');
  } else {
    score++;
  }

  if (!/[a-z]/.test(password)) {
    feedback.push('密碼需要包含小寫字母');
  } else {
    score++;
  }

  if (!/[A-Z]/.test(password)) {
    feedback.push('密碼需要包含大寫字母');
  } else {
    score++;
  }

  if (!/[0-9]/.test(password)) {
    feedback.push('密碼需要包含數字');
  } else {
    score++;
  }

  if (!/[!@#$%^&*]/.test(password)) {
    feedback.push('密碼需要包含特殊字符');
  }

  return {
    isStrong: score >= 3,
    score: Math.min(score, 4),
    feedback,
  };
}

/**
 * 哈希密碼（簡單版本，實際應用應使用 bcrypt）
 */
export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

/**
 * 驗證密碼哈希
 */
export function verifyPasswordHash(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

/**
 * IP 白名單驗證
 */
export function isIpAllowed(ip: string, whitelist: string[]): boolean {
  if (whitelist.length === 0) {
    return true; // 如果沒有白名單，允許所有
  }

  // 簡單的 IP 匹配（不支持 CIDR）
  return whitelist.includes(ip);
}

/**
 * 速率限制令牌桶
 */
export class TokenBucket {
  private tokens: number;
  private lastRefillTime: number;

  constructor(
    private capacity: number,
    private refillRate: number // 令牌/秒
  ) {
    this.tokens = capacity;
    this.lastRefillTime = Date.now();
  }

  refill(): void {
    const now = Date.now();
    const timePassed = (now - this.lastRefillTime) / 1000; // 轉換為秒
    const tokensToAdd = timePassed * this.refillRate;

    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefillTime = now;
  }

  consumeToken(amount: number = 1): boolean {
    this.refill();

    if (this.tokens >= amount) {
      this.tokens -= amount;
      return true;
    }

    return false;
  }

  getAvailableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }
}
