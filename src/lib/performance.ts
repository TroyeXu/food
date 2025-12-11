/**
 * 性能監控和分析工具
 */

interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private marks = new Map<string, number>();
  private readonly MAX_METRICS = 1000;

  /**
   * 標記開始點
   */
  mark(name: string): void {
    this.marks.set(name, performance.now());
  }

  /**
   * 測量時間差
   */
  measure(name: string, startMark: string, metadata?: Record<string, any>): void {
    const startTime = this.marks.get(startMark);
    if (!startTime) {
      console.warn(`[Performance] Start mark "${startMark}" not found`);
      return;
    }

    const duration = performance.now() - startTime;
    const metric: PerformanceMetric = {
      name,
      duration,
      timestamp: Date.now(),
      metadata,
    };

    this.metrics.push(metric);

    // 限制記錄大小
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics.shift();
    }

    // 輸出慢速操作警告
    if (duration > 1000) {
      console.warn(`[Performance] Slow operation: ${name} took ${duration.toFixed(2)}ms`);
    }
  }

  /**
   * 快速測量（標記+測量）
   */
  time<T>(name: string, fn: () => T): T {
    const markName = `${name}_start`;
    this.mark(markName);

    try {
      return fn();
    } finally {
      this.measure(name, markName);
    }
  }

  /**
   * 非同步操作的快速測量
   */
  async timeAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const markName = `${name}_start`;
    this.mark(markName);

    try {
      return await fn();
    } finally {
      this.measure(name, markName);
    }
  }

  /**
   * 取得所有記錄
   */
  getMetrics(name?: string): PerformanceMetric[] {
    return name ? this.metrics.filter((m) => m.name === name) : [...this.metrics];
  }

  /**
   * 取得平均時間
   */
  getAverage(name: string): number {
    const metrics = this.getMetrics(name);
    if (metrics.length === 0) return 0;

    const sum = metrics.reduce((acc, m) => acc + m.duration, 0);
    return sum / metrics.length;
  }

  /**
   * 取得統計信息
   */
  getStats(name?: string) {
    const metrics = name ? this.getMetrics(name) : this.metrics;

    if (metrics.length === 0) {
      return {
        count: 0,
        min: 0,
        max: 0,
        avg: 0,
        total: 0,
      };
    }

    const durations = metrics.map((m) => m.duration);
    const total = durations.reduce((a, b) => a + b, 0);

    return {
      count: metrics.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      avg: total / metrics.length,
      total,
    };
  }

  /**
   * 輸出報告
   */
  report(name?: string): void {
    const stats = this.getStats(name);

    console.group(`[Performance] ${name ? `"${name}" Report` : 'Full Report'}`);
    console.log(`Count:      ${stats.count}`);
    console.log(`Min:        ${stats.min.toFixed(2)}ms`);
    console.log(`Max:        ${stats.max.toFixed(2)}ms`);
    console.log(`Average:    ${stats.avg.toFixed(2)}ms`);
    console.log(`Total:      ${stats.total.toFixed(2)}ms`);
    console.groupEnd();
  }

  /**
   * 清除記錄
   */
  clear(): void {
    this.metrics = [];
    this.marks.clear();
  }

  /**
   * 清除特定操作的記錄
   */
  clearMetric(name: string): void {
    this.metrics = this.metrics.filter((m) => m.name !== name);
  }
}

// 單例
export const performanceMonitor = new PerformanceMonitor();

/**
 * Web Vitals 監控
 */
export function initWebVitalsMonitoring(): void {
  if (typeof window === 'undefined') return;

  // LCP (Largest Contentful Paint)
  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];

      console.log(`[WebVitals] LCP: ${lastEntry.startTime.toFixed(2)}ms`);
    });

    observer.observe({ entryTypes: ['largest-contentful-paint'] });
  } catch (e) {
    // LCP not supported
  }

  // FID (First Input Delay)
  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();

      entries.forEach((entry: any) => {
        const delay = entry.processingStart - entry.startTime;
        console.log(`[WebVitals] FID: ${delay.toFixed(2)}ms`);
      });
    });

    observer.observe({ entryTypes: ['first-input'] });
  } catch (e) {
    // FID not supported
  }

  // CLS (Cumulative Layout Shift)
  try {
    let clsValue = 0;
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value;
        }
      }

      console.log(`[WebVitals] CLS: ${clsValue.toFixed(4)}`);
    });

    observer.observe({ entryTypes: ['layout-shift'] });
  } catch (e) {
    // CLS not supported
  }
}

/**
 * 記憶體監控（Dev only）
 */
export function getMemoryUsage(): { usedJSHeapSize: number; jsHeapSizeLimit: number } | null {
  if (typeof performance === 'undefined' || !(performance as any).memory) {
    return null;
  }

  return {
    usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
    jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit,
  };
}
