'use client';

import React, { useEffect, useState } from 'react';
import { usePriceMonitorStore } from '@/stores/priceMonitorStore';

export default function PriceMonitorPage() {
  const {
    monitors,
    stats,
    loading,
    error,
    fetchMonitors,
    checkMonitor,
    enableMonitor,
    disableMonitor,
    removeMonitor,
  } = usePriceMonitorStore();

  const [selectedTab, setSelectedTab] = useState<'all' | 'changed' | 'errors'>('all');

  useEffect(() => {
    fetchMonitors();

    // 定時刷新（每 5 分鐘）
    const interval = setInterval(fetchMonitors, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchMonitors]);

  const displayMonitors = monitors.filter((m) => {
    if (selectedTab === 'changed') return m.status === 'changed';
    if (selectedTab === 'errors') return m.status === 'error';
    return true;
  });

  return (
    <div className="space-y-6 p-8">
      {/* 標題 */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">價格監控儀表板</h1>
        <p className="mt-2 text-gray-600">實時監控年菜方案的價格變化</p>
      </div>

      {/* 統計卡片 */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="監控方案"
          value={stats.total}
          color="bg-blue-50"
          textColor="text-blue-700"
        />
        <StatCard
          label="已啟用"
          value={stats.enabled}
          color="bg-green-50"
          textColor="text-green-700"
        />
        <StatCard
          label="價格變化"
          value={stats.changed}
          color="bg-orange-50"
          textColor="text-orange-700"
        />
        <StatCard
          label="檢查失敗"
          value={stats.errors}
          color="bg-red-50"
          textColor="text-red-700"
        />
      </div>

      {/* 全量檢查按鈕 */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            monitors.forEach((m) => {
              if (m.enabled) checkMonitor(m.planId);
            });
          }}
          disabled={loading}
          className="rounded-lg bg-blue-500 px-4 py-2 font-medium text-white hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? '檢查中...' : '檢查全部'}
        </button>

        <button
          onClick={fetchMonitors}
          className="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
        >
          刷新
        </button>
      </div>

      {/* 標籤切換 */}
      <div className="flex gap-2 border-b border-gray-200">
        {['all', 'changed', 'errors'].map((tab) => (
          <button
            key={tab}
            onClick={() => setSelectedTab(tab as any)}
            className={`px-4 py-2 font-medium ${
              selectedTab === tab
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab === 'all' && `全部 (${monitors.length})`}
            {tab === 'changed' && `價格變化 (${monitors.filter((m) => m.status === 'changed').length})`}
            {tab === 'errors' && `檢查失敗 (${monitors.filter((m) => m.status === 'error').length})`}
          </button>
        ))}
      </div>

      {/* 錯誤訊息 */}
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {/* 監控列表 */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">方案 ID</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">來源 URL</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">狀態</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">最後檢查</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">動作</th>
            </tr>
          </thead>
          <tbody>
            {displayMonitors.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  {selectedTab === 'all' ? '尚無監控任務' : '此類別暫無任務'}
                </td>
              </tr>
            ) : (
              displayMonitors.map((monitor) => (
                <tr
                  key={monitor.id}
                  className="border-b border-gray-200 hover:bg-gray-50"
                >
                  {/* 方案 ID */}
                  <td className="px-4 py-3 text-sm text-gray-900 font-mono">
                    {monitor.planId.substring(0, 12)}...
                  </td>

                  {/* 來源 URL */}
                  <td className="px-4 py-3 text-sm text-gray-600">
                    <a
                      href={monitor.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline truncate max-w-xs block"
                    >
                      {new URL(monitor.sourceUrl).hostname}
                    </a>
                  </td>

                  {/* 狀態 */}
                  <td className="px-4 py-3 text-sm">
                    {monitor.status === 'idle' && (
                      <span className="inline-block rounded-full bg-green-100 px-3 py-1 text-green-700">
                        正常
                      </span>
                    )}
                    {monitor.status === 'changed' && (
                      <span className="inline-block rounded-full bg-orange-100 px-3 py-1 text-orange-700">
                        價格變化
                      </span>
                    )}
                    {monitor.status === 'checking' && (
                      <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-blue-700">
                        檢查中
                      </span>
                    )}
                    {monitor.status === 'error' && (
                      <span className="inline-block rounded-full bg-red-100 px-3 py-1 text-red-700">
                        失敗
                      </span>
                    )}
                  </td>

                  {/* 最後檢查 */}
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {monitor.lastCheckedAt
                      ? new Date(monitor.lastCheckedAt).toLocaleDateString('zh-TW', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '未檢查'}
                  </td>

                  {/* 動作 */}
                  <td className="px-4 py-3 text-sm">
                    <div className="flex gap-2">
                      <button
                        onClick={() => checkMonitor(monitor.planId)}
                        className="text-blue-600 hover:text-blue-700"
                        title="檢查現在"
                      >
                        🔍
                      </button>

                      <button
                        onClick={() => {
                          if (monitor.enabled) {
                            disableMonitor(monitor.planId);
                          } else {
                            enableMonitor(monitor.planId);
                          }
                        }}
                        className={monitor.enabled ? 'text-green-600' : 'text-gray-400'}
                        title={monitor.enabled ? '禁用' : '啟用'}
                      >
                        {monitor.enabled ? '✓' : '○'}
                      </button>

                      <button
                        onClick={() => {
                          if (confirm('確定刪除此監控任務？')) {
                            removeMonitor(monitor.planId);
                          }
                        }}
                        className="text-red-600 hover:text-red-700"
                        title="刪除"
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 使用說明 */}
      <div className="rounded-lg bg-blue-50 p-4">
        <h3 className="font-medium text-blue-900">使用說明</h3>
        <ul className="mt-2 space-y-1 text-sm text-blue-800">
          <li>✓ 每天自動檢查已監控方案的價格</li>
          <li>✓ 價格下降時會自動通知</li>
          <li>✓ 可手動點擊「🔍」立即檢查</li>
          <li>✓ 點擊「✓/○」可啟用或禁用監控</li>
          <li>✓ 點擊「✕」可刪除監控任務</li>
        </ul>
      </div>
    </div>
  );
}

// 統計卡片元件
function StatCard({
  label,
  value,
  color,
  textColor,
}: {
  label: string;
  value: number;
  color: string;
  textColor: string;
}) {
  return (
    <div className={`rounded-lg ${color} p-4`}>
      <p className="text-sm text-gray-600">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${textColor}`}>{value}</p>
    </div>
  );
}
