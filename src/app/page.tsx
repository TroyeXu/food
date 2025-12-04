'use client';

import { useState, useEffect } from 'react';
import { Menu, Settings, ChevronDown } from 'lucide-react';
import { usePlanStore } from '@/stores/planStore';
import { seedMockData } from '@/lib/mockData';
import FilterSidebar from '@/components/FilterSidebar';
import PlanList from '@/components/PlanList';
import CompareModal from '@/components/CompareModal';
import ConsumerToolbar from '@/components/ConsumerToolbar';
import PlanDetailModal from '@/components/PlanDetailModal';
import FestiveBackground from '@/components/FestiveBackground';
import QuickFilters from '@/components/QuickFilters';
import type { Plan } from '@/types';

export default function Home() {
  const { loadPlans, addPlan, comparisonIds, plans, filters, setFilters, addToHistory } = usePlanStore();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  const handleViewDetail = (plan: Plan) => {
    setSelectedPlan(plan);
    addToHistory(plan.id);
  };

  useEffect(() => {
    const init = async () => {
      await loadPlans();
      setIsInitialized(true);
    };
    init();
  }, [loadPlans]);

  useEffect(() => {
    const checkAndSeed = async () => {
      if (isInitialized && plans.length === 0) {
        await seedMockData(addPlan);
        await loadPlans();
      }
    };
    checkAndSeed();
  }, [isInitialized, plans.length, addPlan, loadPlans]);

  // 確保消費者只看到已上架的
  useEffect(() => {
    if (filters.onlyPublished !== true) {
      setFilters({ onlyPublished: true });
    }
  }, [filters.onlyPublished, setFilters]);

  return (
    <div className="min-h-screen bg-[var(--background)] relative overflow-hidden">
      {/* 過年背景裝飾 */}
      <FestiveBackground />

      {/* Consumer Toolbar */}
      <ConsumerToolbar />

      {/* 快速篩選 */}
      <QuickFilters />

      {/* 滾動到底部按鈕 - 固定在右下角 */}
      <button
        onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}
        className="fixed bottom-20 right-4 z-30 p-3 bg-[#c41e3a] text-white rounded-full shadow-lg hover:bg-[#a01830] transition-all hover:scale-110"
        title="滾動到底部"
      >
        <ChevronDown className="w-5 h-5" />
      </button>

      {/* Main content */}
      <div className="flex">
        {/* Mobile sidebar toggle */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="fixed bottom-20 left-4 z-30 lg:hidden p-3 bg-[var(--primary)] text-white rounded-full shadow-lg"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Filter sidebar */}
        <FilterSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

        {/* Plan list */}
        <main
          className={`flex-1 pb-24 transition-all duration-300 ${
            comparisonIds.length > 0 ? 'pb-32' : ''
          }`}
        >
          <PlanList onEditPlan={() => {}} onViewDetail={handleViewDetail} />
        </main>
      </div>

      {/* Admin link - small button in corner */}
      <a
        href="/admin"
        className="fixed bottom-4 right-4 p-2 bg-[var(--card-bg)] border border-[var(--border)] rounded-full shadow-lg text-[var(--muted)] hover:text-[var(--foreground)] transition-colors z-30"
        title="管理後台"
      >
        <Settings className="w-5 h-5" />
      </a>

      {/* Compare modal */}
      <CompareModal />


      {/* Plan Detail Modal */}
      {selectedPlan && (
        <PlanDetailModal
          plan={selectedPlan}
          onClose={() => setSelectedPlan(null)}
        />
      )}
    </div>
  );
}
