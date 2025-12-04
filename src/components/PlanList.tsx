'use client';

import { usePlanStore } from '@/stores/planStore';
import PlanCard from './PlanCard';
import PlanListItem from './PlanListItem';
import type { Plan } from '@/types';

interface PlanListProps {
  onEditPlan: (plan: Plan) => void;
  onViewDetail?: (plan: Plan) => void;
}

export default function PlanList({ onEditPlan, onViewDetail }: PlanListProps) {
  const { getFilteredPlans, isLoading, addToHistory, viewMode } = usePlanStore();

  const plans = getFilteredPlans();

  const handleViewDetail = (plan: Plan) => {
    addToHistory(plan.id);
    onViewDetail?.(plan);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-[var(--muted)]">
        <p className="text-lg mb-2">沒有符合條件的年菜方案</p>
        <p className="text-sm">試著調整篩選條件，或新增資料</p>
      </div>
    );
  }

  // 列表檢視
  if (viewMode === 'list') {
    return (
      <div className="flex flex-col gap-3 p-3 sm:p-4 max-w-full overflow-hidden">
        {plans.map((plan) => (
          <PlanListItem
            key={plan.id}
            plan={plan}
            onEdit={onEditPlan}
            onViewDetail={handleViewDetail}
          />
        ))}
      </div>
    );
  }

  // 卡片檢視 (grid)
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
      {plans.map((plan) => (
        <PlanCard
          key={plan.id}
          plan={plan}
          onEdit={onEditPlan}
          onViewDetail={handleViewDetail}
        />
      ))}
    </div>
  );
}
