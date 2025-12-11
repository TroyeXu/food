'use client';

import React, { useEffect, useState } from 'react';
import { usePriceMonitorStore } from '@/stores/priceMonitorStore';

interface PriceMonitorProps {
  planId: string;
  sourceUrl?: string;
  onMonitorToggle?: (isMonitored: boolean) => void;
}

export const PriceMonitor: React.FC<PriceMonitorProps> = ({
  planId,
  sourceUrl,
  onMonitorToggle,
}) => {
  const [isMonitored, setIsMonitored] = useState(false);
  const [checking, setChecking] = useState(false);

  const {
    monitors,
    loading,
    error,
    priceHistory,
    addMonitor,
    removeMonitor,
    checkMonitor,
    fetchPriceHistory,
  } = usePriceMonitorStore();

  // 初始化監控狀態
  useEffect(() => {
    const monitor = monitors.find((m) => m.planId === planId);
    setIsMonitored(!!monitor);

    if (monitor) {
      fetchPriceHistory(planId);
    }
  }, [planId, monitors, fetchPriceHistory]);

  // 切換監控
  const handleToggleMonitor = async () => {
    if (!sourceUrl) {
      alert('需要來源 URL 才能設置價格監控');
      return;
    }

    if (isMonitored) {
      await removeMonitor(planId);
      setIsMonitored(false);
    } else {
      await addMonitor(planId, sourceUrl, 'daily');
      setIsMonitored(true);
    }

    onMonitorToggle?.(!isMonitored);
  };

  // 手動檢查價格
  const handleCheckPrice = async () => {
    setChecking(true);
    const updated = await checkMonitor(planId);
    if (updated) {
      await fetchPriceHistory(planId);
    }
    setChecking(false);
  };

  const monitor = monitors.find((m) => m.planId === planId);
  const history = priceHistory.get(planId) || [];

  return (
    <div className="space-y-4">
      {/* 監控狀態 */}
      <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
        <div>
          <h3 className="font-medium text-gray-900">價格監控</h3>
          <p className="mt-1 text-sm text-gray-500">
            {isMonitored ? '✓ 已啟用 - 每日檢查價格變化' : '未啟用 - 點擊啟用價格監控'}
          </p>
        </div>

        <button
          onClick={handleToggleMonitor}
          disabled={loading || !sourceUrl}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            isMonitored
              ? 'bg-red-100 text-red-700 hover:bg-red-200'
              : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
          } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isMonitored ? '停止監控' : '開始監控'}
        </button>
      </div>

      {/* 監控詳情 */}
      {isMonitored && monitor && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {/* 最後檢查 */}
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-600">最後檢查</p>
              <p className="mt-1 font-medium">
                {monitor.lastCheckedAt
                  ? new Date(monitor.lastCheckedAt).toLocaleDateString('zh-TW')
                  : '未檢查'}
              </p>
            </div>

            {/* 檢查間隔 */}
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-600">檢查間隔</p>
              <p className="mt-1 font-medium">
                {monitor.checkInterval === 'daily' && '每日'}
                {monitor.checkInterval === 'weekly' && '每週'}
                {monitor.checkInterval === 'manual' && '手動'}
              </p>
            </div>

            {/* 狀態 */}
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-600">狀態</p>
              <p className="mt-1 font-medium">
                {monitor.status === 'changed' && (
                  <span className="text-orange-600">價格變化</span>
                )}
                {monitor.status === 'idle' && <span className="text-gray-600">正常</span>}
                {monitor.status === 'checking' && <span className="text-blue-600">檢查中</span>}
                {monitor.status === 'error' && <span className="text-red-600">錯誤</span>}
              </p>
            </div>

            {/* 手動檢查 */}
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-600">&nbsp;</p>
              <button
                onClick={handleCheckPrice}
                disabled={checking || loading}
                className="mt-1 w-full rounded bg-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
              >
                {checking ? '檢查中...' : '檢查現在'}
              </button>
            </div>
          </div>

          {/* 錯誤訊息 */}
          {monitor.status === 'error' && monitor.errorMessage && (
            <div className="rounded-lg bg-red-50 p-3">
              <p className="text-sm text-red-700">錯誤: {monitor.errorMessage}</p>
            </div>
          )}

          {/* 價格歷史 */}
          {history.length > 0 && (
            <div className="rounded-lg border border-gray-200 p-4">
              <h4 className="font-medium text-gray-900">價格歷史</h4>

              <div className="mt-3 space-y-2">
                {history.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between border-b border-gray-200 py-2 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        NT${item.price.toLocaleString('zh-TW')}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(item.recordedAt).toLocaleDateString('zh-TW')}
                      </p>
                    </div>
                    {item.originalPrice && (
                      <p className="text-xs text-gray-500 line-through">
                        NT${item.originalPrice.toLocaleString('zh-TW')}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {history.length > 5 && (
                <p className="mt-2 text-xs text-gray-500">
                  及更多 {history.length - 5} 筆記錄
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* 錯誤訊息 */}
      {error && (
        <div className="rounded-lg bg-red-50 p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  );
};
