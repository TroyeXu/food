'use client';

import { X, GitCompare, Trash2 } from 'lucide-react';
import { usePlanStore } from '@/stores/planStore';

export default function ComparisonDrawer() {
  const {
    comparisonIds,
    getComparisonPlans,
    toggleComparison,
    clearComparison,
    setCompareModalOpen,
  } = usePlanStore();

  const plans = getComparisonPlans();

  if (comparisonIds.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--card-bg)] border-t border-[var(--border)] shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center gap-4">
          {/* Selected items */}
          <div className="flex-1 flex items-center gap-3 overflow-x-auto">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="flex items-center gap-2 px-3 py-2 bg-[var(--background)] rounded-lg shrink-0"
              >
                {plan.imageUrl && (
                  <img
                    src={plan.imageUrl}
                    alt={plan.title}
                    className="w-10 h-10 rounded object-cover"
                  />
                )}
                <div className="max-w-[150px]">
                  <p className="text-xs text-[var(--muted)] truncate">{plan.vendorName}</p>
                  <p className="text-sm font-medium truncate">{plan.title}</p>
                  <p className="text-sm text-[var(--primary)]">
                    ${plan.priceDiscount.toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => toggleComparison(plan.id)}
                  className="p-1 text-[var(--muted)] hover:text-[var(--danger)] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}

            {/* Empty slots indicator */}
            {comparisonIds.length < 4 && (
              <div className="text-sm text-[var(--muted)]">
                還可加入 {4 - comparisonIds.length} 個
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={clearComparison}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              清除
            </button>
            <button
              onClick={() => setCompareModalOpen(true)}
              disabled={comparisonIds.length < 2}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                comparisonIds.length >= 2
                  ? 'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]'
                  : 'bg-[var(--muted)] text-white cursor-not-allowed'
              }`}
            >
              <GitCompare className="w-4 h-4" />
              比較 ({comparisonIds.length})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
