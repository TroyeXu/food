'use client';

import { useState, useEffect } from 'react';
import { Clock, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { usePlanStore } from '@/stores/planStore';
import type { Plan } from '@/types';

interface HistoryDrawerProps {
  onViewDetail: (plan: Plan) => void;
}

export default function HistoryDrawer({ onViewDetail }: HistoryDrawerProps) {
  const { getHistoryPlans, clearHistory, historyIds } = usePlanStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // 確保只在客戶端渲染，避免 hydration 錯誤
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const historyPlans = getHistoryPlans();

  // 伺服器端或無歷史記錄時不渲染
  if (!isMounted || historyIds.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-24 left-4 z-40">
      {/* Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 px-3 py-2 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg shadow-lg hover:border-[var(--primary)] transition-colors"
      >
        <Clock className="w-4 h-4 text-[var(--primary)]" />
        <span className="text-sm font-medium">最近瀏覽</span>
        <span className="text-xs px-1.5 py-0.5 bg-[var(--primary)] text-white rounded-full">
          {historyIds.length}
        </span>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronUp className="w-4 h-4" />
        )}
      </button>

      {/* Expanded Panel */}
      {isExpanded && (
        <div className="absolute bottom-full left-0 mb-2 w-72 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg shadow-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-[var(--border)] bg-[var(--background)]">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[var(--primary)]" />
              <span className="font-medium text-sm">最近瀏覽</span>
            </div>
            <button
              onClick={clearHistory}
              className="text-xs text-[var(--muted)] hover:text-[var(--danger)] flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              清除
            </button>
          </div>

          {/* History List */}
          <div className="max-h-64 overflow-y-auto">
            {historyPlans.map((plan) => (
              <button
                key={plan.id}
                onClick={() => {
                  onViewDetail(plan);
                  setIsExpanded(false);
                }}
                className="w-full flex items-center gap-3 p-3 hover:bg-[var(--background)] transition-colors text-left border-b border-[var(--border)] last:border-b-0"
              >
                {/* Thumbnail */}
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                  {plan.imageUrl ? (
                    <img
                      src={plan.imageUrl}
                      alt={plan.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[var(--muted)] text-xs">
                      無圖
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[var(--muted)] truncate">
                    {plan.vendorName}
                  </p>
                  <p className="text-sm font-medium truncate">{plan.title}</p>
                  <p className="text-sm text-[var(--primary)] font-medium">
                    ${plan.priceDiscount.toLocaleString()}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
