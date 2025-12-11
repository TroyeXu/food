/**
 * API 中間件
 *
 * 用途：
 * - 請求速率限制
 * - 請求驗證
 * - 錯誤處理包裝
 * - 記錄和追蹤
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  ApiError,
  StructuredLogger,
  generateTraceId,
  createErrorResponse,
  createSuccessResponse,
} from './errors';

/**
 * API 處理器類型
 */
export type ApiHandler<T = any> = (
  request: NextRequest,
  context?: {
    params?: Record<string, string>;
  }
) => Promise<NextResponse<T>>;

/**
 * 速率限制配置
 */
interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  message?: string;
}

/**
 * 速率限制存儲（內存）
 */
class RateLimitStore {
  private store = new Map<string, number[]>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // 每分鐘清理一次過期的記錄
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, times] of this.store.entries()) {
      const valid = times.filter((t) => now - t < 3600000); // 保持 1 小時的記錄
      if (valid.length === 0) {
        this.store.delete(key);
      } else {
        this.store.set(key, valid);
      }
    }
  }

  isAllowed(key: string, config: RateLimitConfig): boolean {
    const now = Date.now();
    const times = this.store.get(key) || [];
    const validTimes = times.filter((t) => now - t < config.windowMs);

    if (validTimes.length >= config.maxRequests) {
      return false;
    }

    validTimes.push(now);
    this.store.set(key, validTimes);
    return true;
  }

  getRemainingRequests(key: string, config: RateLimitConfig): number {
    const now = Date.now();
    const times = this.store.get(key) || [];
    const validTimes = times.filter((t) => now - t < config.windowMs);
    return Math.max(0, config.maxRequests - validTimes.length);
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

/**
 * 全局速率限制存儲實例
 */
const rateLimitStore = new RateLimitStore();

/**
 * 取得客戶端 IP
 */
export function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwardedFor?.split(',')[0].trim() || realIp || 'unknown';
  return ip;
}

/**
 * 速率限制中間件
 */
export function createRateLimitMiddleware(
  config: RateLimitConfig = { maxRequests: 100, windowMs: 60000 }
) {
  return (handler: ApiHandler): ApiHandler => {
    return async (request: NextRequest, context?: { params?: Record<string, string> }) => {
      const ip = getClientIp(request);
      const traceId = generateTraceId();

      if (!rateLimitStore.isAllowed(`${ip}:${request.method}:${request.nextUrl.pathname}`, config)) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: config.message || '請求過於頻繁，請稍候再試',
              traceId,
            },
          },
          {
            status: 429,
            headers: {
              'X-Trace-Id': traceId,
              'Retry-After': `${Math.ceil(config.windowMs / 1000)}`,
            },
          }
        );
      }

      const remaining = rateLimitStore.getRemainingRequests(
        `${ip}:${request.method}:${request.nextUrl.pathname}`,
        config
      );

      const response = await handler(request, context);
      response.headers.set('X-RateLimit-Remaining', remaining.toString());
      response.headers.set('X-Trace-Id', traceId);

      return response;
    };
  };
}

/**
 * 錯誤處理中間件
 */
export function createErrorHandlingMiddleware(logger?: StructuredLogger) {
  return (handler: ApiHandler): ApiHandler => {
    return async (request: NextRequest, context?: { params?: Record<string, string> }) => {
      const traceId = generateTraceId();
      const startTime = Date.now();
      const log = logger || new StructuredLogger('API');

      try {
        const response = await handler(request, context);
        const duration = Date.now() - startTime;

        if (response.status >= 400) {
          log.warn(
            `${request.method} ${request.nextUrl.pathname} - ${response.status}`,
            traceId,
            {
              method: request.method,
              path: request.nextUrl.pathname,
              status: response.status,
              duration,
            }
          );
        } else {
          log.info(
            `${request.method} ${request.nextUrl.pathname} - ${response.status}`,
            traceId,
            {
              method: request.method,
              path: request.nextUrl.pathname,
              status: response.status,
              duration,
            }
          );
        }

        response.headers.set('X-Trace-Id', traceId);
        response.headers.set('X-Response-Time', `${duration}ms`);

        return response;
      } catch (error) {
        const duration = Date.now() - startTime;

        log.error(
          `${request.method} ${request.nextUrl.pathname} - 500`,
          traceId,
          error instanceof Error ? error : new Error(String(error)),
          {
            method: request.method,
            path: request.nextUrl.pathname,
            duration,
          }
        );

        return createErrorResponse(
          error instanceof ApiError ? error : new Error('Internal server error'),
          traceId
        );
      }
    };
  };
}

/**
 * 組合中間件
 */
export function withMiddleware(
  handler: ApiHandler,
  middlewares: Array<(handler: ApiHandler) => ApiHandler> = []
): ApiHandler {
  return middlewares.reduce((h, middleware) => middleware(h), handler);
}

/**
 * 創建 API 處理器，包含所有中間件
 */
export function createApiHandler(
  handler: ApiHandler,
  options?: {
    rateLimit?: RateLimitConfig | false;
    errorHandling?: boolean;
    logger?: StructuredLogger;
  }
): ApiHandler {
  const middlewares: Array<(handler: ApiHandler) => ApiHandler> = [];

  if (options?.errorHandling !== false) {
    middlewares.push(createErrorHandlingMiddleware(options?.logger));
  }

  if (options?.rateLimit !== false) {
    const rateLimitConfig =
      typeof options?.rateLimit === 'object' ? options.rateLimit : {};
    middlewares.push(
      createRateLimitMiddleware({
        maxRequests: 100,
        windowMs: 60000,
        ...rateLimitConfig,
      })
    );
  }

  return withMiddleware(handler, middlewares);
}

/**
 * 銷毀全局速率限制存儲
 */
export function destroyRateLimiter() {
  rateLimitStore.destroy();
}
