'use client';

import { useState, useEffect } from 'react';
import { X, GitCompare } from 'lucide-react';
import { usePlanStore } from '@/stores/planStore';

export default function FloatingCompareBar() {
  const { comparisonIds, plans, toggleComparison, setCompareModalOpen } = usePlanStore();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted || comparisonIds.length === 0) return null;

  const selectedPlans = plans.filter((p) => comparisonIds.includes(p.id));
  const canCompare = comparisonIds.length >= 2;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-r from-[#8b0000] via-[#c41e3a] to-[#8b0000] border-t-2 border-[#ffd700] shadow-lg">
      <div className="max-w-screen-xl mx-auto px-4 py-3">
        <div className="flex items-center gap-4">
          {/* 已選方案縮圖 */}
          <div className="flex items-center gap-2 flex-1 overflow-x-auto">
            <span className="text-white text-sm font-medium whitespace-nowrap">
              已選 {comparisonIds.length}/4:
            </span>
            {selectedPlans.map((plan) => (
              <div
                key={plan.id}
                className="relative flex-shrink-0 group"
              >
                <div className="w-12 h-12 rounded-lg overflow-hidden border-2 border-[#ffd700] bg-white">
                  {plan.imageUrl ? (
                    <img
                      src={plan.imageUrl}
                      alt={plan.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[8px] text-gray-400">
                      無圖
                    </div>
                  )}
                </div>
                {/* 移除按鈕 */}
                <button
                  onClick={() => toggleComparison(plan.id)}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-white text-[#c41e3a] rounded-full shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
                {/* 價格標籤 */}
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-[#ffd700] text-[#5d4037] text-[8px] font-bold px-1 rounded whitespace-nowrap">
                  ${(plan.priceDiscount / 1000).toFixed(1)}k
                </div>
              </div>
            ))}

            {/* 空位提示 */}
            {Array.from({ length: Math.max(0, 2 - comparisonIds.length) }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="w-12 h-12 rounded-lg border-2 border-dashed border-white/30 flex items-center justify-center text-white/50 text-xs flex-shrink-0"
              >
                +
              </div>
            ))}
          </div>

          {/* 比較按鈕 */}
          <button
            onClick={() => setCompareModalOpen(true)}
            disabled={!canCompare}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all flex-shrink-0 ${
              canCompare
                ? 'bg-[#ffd700] text-[#5d4037] hover:bg-[#ffed4a] shadow-lg'
                : 'bg-white/20 text-white/50 cursor-not-allowed'
            }`}
          >
            <GitCompare className="w-5 h-5" />
            <span className="hidden sm:inline">
              {canCompare ? '開始比較' : `再選 ${2 - comparisonIds.length} 個`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
