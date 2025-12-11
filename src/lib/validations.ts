import { z } from 'zod';

/**
 * API Request/Response 驗證模式
 * 用於確保所有 API 輸入都是有效的
 */

// ==================== 評價相關 ====================

export const CreateReviewSchema = z.object({
  planId: z.string().uuid('Invalid plan ID'),
  rating: z.number().int().min(1, 'Rating must be at least 1').max(5, 'Rating must be at most 5'),
  title: z.string().min(1, 'Title is required').max(100, 'Title must be less than 100 characters'),
  content: z.string().min(10, 'Content must be at least 10 characters').max(5000, 'Content must be less than 5000 characters'),
  dimensionRatings: z.record(z.string(), z.number().min(1).max(5)).optional(),
  userName: z.string().max(50, 'User name must be less than 50 characters').optional(),
});

export type CreateReviewInput = z.infer<typeof CreateReviewSchema>;

export const UpdateReviewSchema = z.object({
  reviewId: z.string().uuid('Invalid review ID'),
  helpful: z.boolean().optional(),
  unhelpful: z.boolean().optional(),
  vendorReply: z.string().max(1000, 'Reply must be less than 1000 characters').optional(),
});

export type UpdateReviewInput = z.infer<typeof UpdateReviewSchema>;

// ==================== 購物清單相關 ====================

export const CreateShoppingListSchema = z.object({
  name: z.string().min(1, 'List name is required').max(100, 'List name must be less than 100 characters'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
});

export type CreateShoppingListInput = z.infer<typeof CreateShoppingListSchema>;

export const AddShoppingListItemSchema = z.object({
  listId: z.string().uuid('Invalid list ID'),
  planId: z.string().uuid('Invalid plan ID'),
  quantity: z.number().int().positive('Quantity must be positive'),
  notes: z.string().max(200, 'Notes must be less than 200 characters').optional(),
});

export type AddShoppingListItemInput = z.infer<typeof AddShoppingListItemSchema>;

export const UpdateShoppingListItemSchema = z.object({
  listId: z.string().uuid('Invalid list ID'),
  planId: z.string().uuid('Invalid plan ID'),
  quantity: z.number().int().positive('Quantity must be positive'),
  notes: z.string().max(200, 'Notes must be less than 200 characters').optional(),
});

export type UpdateShoppingListItemInput = z.infer<typeof UpdateShoppingListItemSchema>;

export const DeleteShoppingListSchema = z.object({
  listId: z.string().uuid('Invalid list ID'),
});

export type DeleteShoppingListInput = z.infer<typeof DeleteShoppingListSchema>;

// ==================== 價格監控相關 ====================

export const CreatePriceMonitorSchema = z.object({
  planId: z.string().uuid('Invalid plan ID'),
  targetPrice: z.number().positive('Target price must be positive'),
  email: z.string().email('Invalid email address'),
});

export type CreatePriceMonitorInput = z.infer<typeof CreatePriceMonitorSchema>;

// ==================== 實用函數 ====================

/**
 * 安全驗證並解析 JSON 體
 */
export async function validateRequestBody<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<{ data: T; error: null } | { data: null; error: string }> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      const errors = Object.entries(fieldErrors)
        .map(([field, msgs]) => `${field}: ${(msgs as string[] | undefined)?.join(', ') || '未知錯誤'}`)
        .join(', ');
      return { data: null, error: `Validation failed: ${errors}` };
    }

    return { data: result.data, error: null };
  } catch (error) {
    return { data: null, error: 'Invalid JSON' };
  }
}

/**
 * 檢查用戶是否超過速率限制
 */
const rateLimitMap = new Map<string, number[]>();

export function checkRateLimit(
  key: string,
  maxRequests: number = 10,
  windowMs: number = 60000
): boolean {
  const now = Date.now();
  const requests = rateLimitMap.get(key) || [];
  const recentRequests = requests.filter((time) => now - time < windowMs);

  if (recentRequests.length >= maxRequests) {
    return false;
  }

  recentRequests.push(now);
  rateLimitMap.set(key, recentRequests);

  // 定期清理舊的條目
  if (recentRequests.length > maxRequests * 2) {
    const filtered = recentRequests.filter((time) => now - time < windowMs);
    rateLimitMap.set(key, filtered);
  }

  return true;
}

/**
 * HTML 轉義，防止 XSS
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

/**
 * 清理用戶輸入（移除可疑標記）
 */
export function sanitizeInput(input: string): string {
  // 移除 HTML 標籤
  let cleaned = input.replace(/<[^>]*>/g, '');
  // HTML 轉義
  cleaned = escapeHtml(cleaned);
  // 移除過多的空格
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
}

/**
 * 檢查評價內容是否應該標記為待審核
 * 返回是否需要人工審核
 */
export function shouldModerateReview(title: string, content: string): boolean {
  // 檢查垃圾詞彙
  const spamPatterns = [
    /viagra|cialis|casino|lottery|poker|adult/gi,
    /\b(click here|buy now|limited offer)\b/gi,
    /(http|https|www\.|\.com)/g, // 過多的 URL
  ];

  const text = `${title} ${content}`.toLowerCase();

  // 計算可疑模式的匹配數
  let suspicionScore = 0;

  for (const pattern of spamPatterns) {
    const matches = text.match(pattern);
    if (matches) suspicionScore += matches.length * 2;
  }

  // 檢查過多的大寫字母（可能是垃圾）
  const uppercaseRatio = (text.match(/[A-Z]/g) || []).length / text.length;
  if (uppercaseRatio > 0.5) suspicionScore += 5;

  // 檢查重複字符（例如 "!!!!!!!"）
  if (/(.)\1{4,}/g.test(text)) suspicionScore += 3;

  // 檢查很短的內容（可能是垃圾）
  if (content.length < 15) suspicionScore += 1;

  // 需要審核的閾值
  return suspicionScore > 3;
}

// ==================== Plan 相關驗證 ====================

export const CreatePlanSchema = z.object({
  vendorId: z.string().uuid('Invalid vendor ID'),
  vendorName: z.string().min(1, 'Vendor name is required'),
  title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters'),
  description: z.string().max(2000, 'Description must be less than 2000 characters').optional(),
  priceDiscount: z.number().positive('Price must be positive'),
  priceOriginal: z.number().positive('Original price must be positive').optional(),
  shippingFee: z.number().min(0, 'Shipping fee must be non-negative').optional(),
  shippingType: z.enum(['delivery', 'pickup', 'both'], { message: 'Invalid shipping type' }),
  storageType: z.enum(['frozen', 'chilled', 'room_temp', 'unknown'], { message: 'Invalid storage type' }),
  servingsMin: z.number().int().positive('Minimum servings must be positive'),
  servingsMax: z.number().int().positive('Maximum servings must be positive').optional(),
  tags: z.array(z.string()).default([]),
  dishes: z.array(z.string()).default([]),
  status: z.enum(['draft', 'needs_review', 'published'], { message: 'Invalid status' }).default('draft'),
});

export type CreatePlanInput = z.infer<typeof CreatePlanSchema>;

export const UpdatePlanSchema = CreatePlanSchema.partial().extend({
  id: z.string().uuid('Invalid plan ID'),
});

export type UpdatePlanInput = z.infer<typeof UpdatePlanSchema>;

// ==================== 篩選相關驗證 ====================

export const FilterQuerySchema = z.object({
  priceMin: z.number().min(0).optional(),
  priceMax: z.number().min(0).optional(),
  shippingType: z.string().optional(),
  storageType: z.string().optional(),
  tags: z.string().optional(), // 逗號分隔
  searchQuery: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export type FilterQueryInput = z.infer<typeof FilterQuerySchema>;
