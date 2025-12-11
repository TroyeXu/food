/**
 * API 錯誤處理和標準化
 *
 * 用途：
 * - 統一的錯誤響應格式
 * - 自定義錯誤類型
 * - 結構化日誌記錄
 * - 錯誤追蹤 ID
 */

import { NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * 標準 API 響應格式
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
    traceId: string;
  };
  meta?: {
    timestamp: string;
    duration?: number;
  };
}

/**
 * 自定義錯誤類
 */
export class ApiError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * 驗證錯誤
 */
export class ValidationError extends ApiError {
  constructor(message: string, details?: any) {
    super('VALIDATION_ERROR', 400, message, details);
    this.name = 'ValidationError';
  }
}

/**
 * 認證錯誤
 */
export class AuthenticationError extends ApiError {
  constructor(message: string = '未經授權') {
    super('AUTHENTICATION_ERROR', 401, message);
    this.name = 'AuthenticationError';
  }
}

/**
 * 授權錯誤
 */
export class AuthorizationError extends ApiError {
  constructor(message: string = '沒有權限訪問此資源') {
    super('AUTHORIZATION_ERROR', 403, message);
    this.name = 'AuthorizationError';
  }
}

/**
 * 未找到錯誤
 */
export class NotFoundError extends ApiError {
  constructor(resource: string) {
    super('NOT_FOUND', 404, `${resource} 不存在`);
    this.name = 'NotFoundError';
  }
}

/**
 * 衝突錯誤
 */
export class ConflictError extends ApiError {
  constructor(message: string) {
    super('CONFLICT', 409, message);
    this.name = 'ConflictError';
  }
}

/**
 * 內部服務器錯誤
 */
export class InternalError extends ApiError {
  constructor(message: string = '內部服務器錯誤', details?: any) {
    super('INTERNAL_ERROR', 500, message, details);
    this.name = 'InternalError';
  }
}

/**
 * 服務不可用
 */
export class ServiceUnavailableError extends ApiError {
  constructor(message: string = '服務暫時不可用') {
    super('SERVICE_UNAVAILABLE', 503, message);
    this.name = 'ServiceUnavailableError';
  }
}

/**
 * 結構化日誌
 */
export interface StructuredLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  traceId: string;
  context?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * 結構化日誌記錄器
 */
export class StructuredLogger {
  constructor(private context: string = 'API') {}

  private formatLog(
    level: 'info' | 'warn' | 'error' | 'debug',
    message: string,
    traceId: string,
    meta?: Record<string, any>,
    error?: Error
  ): StructuredLog {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      traceId,
      context: {
        service: this.context,
        ...meta,
      },
      error: error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : undefined,
    };
  }

  info(message: string, traceId: string, meta?: Record<string, any>) {
    const log = this.formatLog('info', message, traceId, meta);
    console.log(`[${this.context}] [INFO] ${message}`, log);
  }

  warn(message: string, traceId: string, meta?: Record<string, any>) {
    const log = this.formatLog('warn', message, traceId, meta);
    console.warn(`[${this.context}] [WARN] ${message}`, log);
  }

  error(message: string, traceId: string, error?: Error, meta?: Record<string, any>) {
    const log = this.formatLog('error', message, traceId, meta, error);
    console.error(`[${this.context}] [ERROR] ${message}`, log);
  }

  debug(message: string, traceId: string, meta?: Record<string, any>) {
    if (process.env.NODE_ENV === 'development') {
      const log = this.formatLog('debug', message, traceId, meta);
      console.debug(`[${this.context}] [DEBUG] ${message}`, log);
    }
  }
}

/**
 * 生成追蹤 ID
 */
export function generateTraceId(): string {
  return crypto.randomUUID();
}

/**
 * 建立成功響應
 */
export function successResponse<T>(data: T, meta?: any): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };
}

/**
 * 建立錯誤響應
 */
export function errorResponse(error: Error | ApiError, traceId: string): ApiResponse {
  let code = 'INTERNAL_ERROR';
  let statusCode = 500;
  let message = '內部服務器錯誤';
  let details = undefined;

  if (error instanceof ApiError) {
    code = error.code;
    statusCode = error.statusCode;
    message = error.message;
    details = error.details;
  } else {
    message = error.message;
  }

  return {
    success: false,
    error: {
      code,
      message,
      details,
      traceId,
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * 建立 NextResponse
 */
export function createErrorResponse(error: Error | ApiError, traceId: string) {
  let statusCode = 500;

  if (error instanceof ApiError) {
    statusCode = error.statusCode;
  }

  return NextResponse.json(errorResponse(error, traceId), {
    status: statusCode,
    headers: {
      'X-Trace-Id': traceId,
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

/**
 * 建立成功的 NextResponse
 */
export function createSuccessResponse<T>(data: T, statusCode: number = 200) {
  return NextResponse.json(successResponse(data), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}
