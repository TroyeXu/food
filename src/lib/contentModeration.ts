/**
 * 內容審核模組
 *
 * 用途：
 * - 自動檢測垃圾內容
 * - 敏感詞過濾
 * - 內容品質評分
 * - 可疑內容標記
 */

/**
 * 審核結果
 */
export interface ModerationResult {
  isClean: boolean;
  score: number; // 0-100, 越高越可疑
  flags: ModerationFlag[];
  suggestion: 'approve' | 'review' | 'reject';
  details: string[];
}

/**
 * 審核標記
 */
export interface ModerationFlag {
  type: FlagType;
  severity: 'low' | 'medium' | 'high';
  message: string;
  matchedText?: string;
}

/**
 * 標記類型
 */
export type FlagType =
  | 'spam'
  | 'profanity'
  | 'advertisement'
  | 'link'
  | 'repetitive'
  | 'low_quality'
  | 'suspicious_pattern'
  | 'fake_review';

/**
 * 垃圾詞彙模式（英文）
 */
const SPAM_PATTERNS_EN = [
  /viagra|cialis|casino|lottery|poker/gi,
  /\b(click here|buy now|limited offer|act now|free money)\b/gi,
  /\b(make money|work from home|earn cash)\b/gi,
  /\b(winner|congratulations|you have been selected)\b/gi,
];

/**
 * 垃圾詞彙模式（中文）
 */
const SPAM_PATTERNS_ZH = [
  /代購|代理|兼職|日賺|月入/g,
  /加(我|賴|LINE|微信|QQ)/gi,
  /私訊|私聊|詳情請/g,
  /優惠碼|折扣碼|免費領/g,
  /刷單|好評返現|返利/g,
];

/**
 * 廣告模式
 */
const AD_PATTERNS = [
  /(http|https|www\.|\.com|\.tw|\.cn)/gi,
  /\b\d{10,}\b/g, // 長數字（可能是電話）
  /@\w+\.(com|tw|cn|net)/gi, // 郵箱
  /LINE\s*[:：]?\s*\w+/gi,
  /微信\s*[:：]?\s*\w+/gi,
];

/**
 * 不良詞彙（簡化版，實際應用應使用更完整的詞庫）
 */
const PROFANITY_PATTERNS = [
  /幹你|操你|去死|白癡|智障|廢物/g,
  /fuck|shit|damn|ass|bitch/gi,
];

/**
 * 假評價模式
 */
const FAKE_REVIEW_PATTERNS = [
  /五星好評|必買|超級推薦|無敵好吃/g,
  /回購\d+次|買了\d+組/g,
  /比\w+還好|市面上最好/g,
];

/**
 * 分析文本內容
 */
export function moderateContent(
  title: string,
  content: string,
  options?: {
    checkLinks?: boolean;
    checkProfanity?: boolean;
    strictMode?: boolean;
  }
): ModerationResult {
  const text = `${title} ${content}`;
  const flags: ModerationFlag[] = [];
  const details: string[] = [];
  let score = 0;

  const checkLinks = options?.checkLinks ?? true;
  const checkProfanity = options?.checkProfanity ?? true;
  const strictMode = options?.strictMode ?? false;

  // 1. 檢查垃圾內容（英文）
  for (const pattern of SPAM_PATTERNS_EN) {
    const matches = text.match(pattern);
    if (matches) {
      score += matches.length * 15;
      flags.push({
        type: 'spam',
        severity: 'high',
        message: '檢測到可疑的垃圾詞彙',
        matchedText: matches.slice(0, 3).join(', '),
      });
      details.push(`垃圾詞彙: ${matches.join(', ')}`);
    }
  }

  // 2. 檢查垃圾內容（中文）
  for (const pattern of SPAM_PATTERNS_ZH) {
    const matches = text.match(pattern);
    if (matches) {
      score += matches.length * 12;
      flags.push({
        type: 'spam',
        severity: 'medium',
        message: '檢測到可能的推銷內容',
        matchedText: matches.slice(0, 3).join(', '),
      });
      details.push(`推銷詞彙: ${matches.join(', ')}`);
    }
  }

  // 3. 檢查廣告連結
  if (checkLinks) {
    for (const pattern of AD_PATTERNS) {
      const matches = text.match(pattern);
      if (matches) {
        score += matches.length * 10;
        flags.push({
          type: 'advertisement',
          severity: 'medium',
          message: '包含連結或聯繫方式',
          matchedText: matches.slice(0, 3).join(', '),
        });
        details.push(`廣告連結: ${matches.join(', ')}`);
      }
    }
  }

  // 4. 檢查不良詞彙
  if (checkProfanity) {
    for (const pattern of PROFANITY_PATTERNS) {
      const matches = text.match(pattern);
      if (matches) {
        score += matches.length * 20;
        flags.push({
          type: 'profanity',
          severity: 'high',
          message: '包含不當用語',
          matchedText: '[已隱藏]',
        });
        details.push('檢測到不當用語');
      }
    }
  }

  // 5. 檢查假評價模式
  for (const pattern of FAKE_REVIEW_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      score += matches.length * 8;
      flags.push({
        type: 'fake_review',
        severity: 'low',
        message: '可能是刷評或過度誇張',
        matchedText: matches.slice(0, 3).join(', '),
      });
      details.push(`可疑用語: ${matches.join(', ')}`);
    }
  }

  // 6. 檢查重複字符
  const repetitivePattern = /(.)\1{4,}/g;
  const repetitiveMatches = text.match(repetitivePattern);
  if (repetitiveMatches) {
    score += repetitiveMatches.length * 5;
    flags.push({
      type: 'repetitive',
      severity: 'low',
      message: '包含過多重複字符',
      matchedText: repetitiveMatches.slice(0, 3).join(', '),
    });
    details.push('檢測到重複字符');
  }

  // 7. 檢查過多大寫（英文）
  const uppercaseRatio = (text.match(/[A-Z]/g) || []).length / Math.max(text.length, 1);
  if (uppercaseRatio > 0.5 && text.length > 10) {
    score += 10;
    flags.push({
      type: 'suspicious_pattern',
      severity: 'low',
      message: '過多大寫字母',
    });
    details.push('過多大寫字母');
  }

  // 8. 檢查內容長度
  if (content.length < 10) {
    score += 15;
    flags.push({
      type: 'low_quality',
      severity: 'medium',
      message: '內容過短',
    });
    details.push('內容過短（少於 10 字）');
  } else if (content.length < 20) {
    score += 5;
    flags.push({
      type: 'low_quality',
      severity: 'low',
      message: '內容較短',
    });
    details.push('內容較短（少於 20 字）');
  }

  // 9. 嚴格模式額外檢查
  if (strictMode) {
    // 檢查是否只有表情符號
    const emojiOnly = /^[\s\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]+$/u;
    if (emojiOnly.test(content)) {
      score += 20;
      flags.push({
        type: 'low_quality',
        severity: 'medium',
        message: '內容僅包含表情符號',
      });
      details.push('內容僅包含表情符號');
    }

    // 檢查是否只有標點符號
    const punctuationOnly = /^[！!？?。，,、；;：:""''「」【】（）()]+$/;
    if (punctuationOnly.test(content)) {
      score += 25;
      flags.push({
        type: 'low_quality',
        severity: 'high',
        message: '內容僅包含標點符號',
      });
      details.push('內容僅包含標點符號');
    }
  }

  // 計算建議
  let suggestion: 'approve' | 'review' | 'reject';
  if (score >= 50) {
    suggestion = 'reject';
  } else if (score >= 20) {
    suggestion = 'review';
  } else {
    suggestion = 'approve';
  }

  return {
    isClean: score < 20,
    score: Math.min(score, 100),
    flags,
    suggestion,
    details,
  };
}

/**
 * 快速檢查是否需要審核
 */
export function needsModeration(title: string, content: string): boolean {
  const result = moderateContent(title, content);
  return result.suggestion !== 'approve';
}

/**
 * 獲取審核摘要
 */
export function getModerationSummary(result: ModerationResult): string {
  if (result.isClean) {
    return '內容檢查通過';
  }

  const highSeverityCount = result.flags.filter((f) => f.severity === 'high').length;
  const mediumSeverityCount = result.flags.filter((f) => f.severity === 'medium').length;

  if (highSeverityCount > 0) {
    return `發現 ${highSeverityCount} 個嚴重問題，建議拒絕`;
  }

  if (mediumSeverityCount > 0) {
    return `發現 ${mediumSeverityCount} 個中等問題，建議人工審核`;
  }

  return `發現 ${result.flags.length} 個輕微問題`;
}

/**
 * 批量審核
 */
export function moderateMultiple(
  items: Array<{ id: string; title: string; content: string }>
): Map<string, ModerationResult> {
  const results = new Map<string, ModerationResult>();

  for (const item of items) {
    results.set(item.id, moderateContent(item.title, item.content));
  }

  return results;
}

/**
 * 審核統計
 */
export interface ModerationStats {
  total: number;
  clean: number;
  needsReview: number;
  rejected: number;
  flagTypes: Record<FlagType, number>;
}

/**
 * 計算審核統計
 */
export function calculateModerationStats(results: ModerationResult[]): ModerationStats {
  const stats: ModerationStats = {
    total: results.length,
    clean: 0,
    needsReview: 0,
    rejected: 0,
    flagTypes: {
      spam: 0,
      profanity: 0,
      advertisement: 0,
      link: 0,
      repetitive: 0,
      low_quality: 0,
      suspicious_pattern: 0,
      fake_review: 0,
    },
  };

  for (const result of results) {
    if (result.suggestion === 'approve') {
      stats.clean++;
    } else if (result.suggestion === 'review') {
      stats.needsReview++;
    } else {
      stats.rejected++;
    }

    for (const flag of result.flags) {
      stats.flagTypes[flag.type]++;
    }
  }

  return stats;
}
