'use client';

import { useState, useEffect } from 'react';
import { Menu, Settings, ChevronDown, Store, ShoppingCart } from 'lucide-react';
import { usePlanStore } from '@/stores/planStore';
import { seedMockData } from '@/lib/mockData';
import FilterSidebar from '@/components/FilterSidebar';
import PlanList from '@/components/PlanList';
import CompareModal from '@/components/CompareModal';
import ConsumerToolbar from '@/components/ConsumerToolbar';
import PlanDetailModal from '@/components/PlanDetailModal';
import FestiveBackground from '@/components/FestiveBackground';
import QuickFilters from '@/components/QuickFilters';
import QuickWizard from '@/components/QuickWizard';
import SmartRecommend from '@/components/SmartRecommend';
import MobileFilterBar from '@/components/MobileFilterBar';
import VendorList from '@/components/VendorList';
import SortDropdown from '@/components/SortDropdown';
import { ShoppingListPanel } from '@/components/ShoppingListPanel';
import type { Plan } from '@/types';

export default function Home() {
  const { loadPlans, addPlan, comparisonIds, plans, filters, setFilters, addToHistory } = usePlanStore();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [isVendorListOpen, setIsVendorListOpen] = useState(false);
  const [isShoppingListOpen, setIsShoppingListOpen] = useState(false);

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

      {/* Consumer Toolbar - 只在桌面版顯示 */}
      <div className="hidden lg:block">
        <ConsumerToolbar />
      </div>

      {/* 手機版：精簡的篩選列 */}
      <div className="lg:hidden">
        <MobileFilterBar onOpenVendorList={() => setIsVendorListOpen(true)} />
      </div>

      {/* 桌面版：智慧推薦區塊 */}
      <div className="hidden lg:block">
        <SmartRecommend />
      </div>

      {/* 桌面版：快速篩選 + 排序 + 廠商列表 */}
      <div className="hidden lg:block">
        <QuickFilters />
        {/* 排序與廠商入口 */}
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between border-b border-gray-100">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsVendorListOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:border-red-300 hover:bg-red-50 transition-all text-sm"
            >
              <Store className="w-4 h-4 text-red-600" />
              <span className="font-medium text-gray-700">廠商總覽</span>
            </button>
            <button
              onClick={() => setIsShoppingListOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all text-sm"
            >
              <ShoppingCart className="w-4 h-4 text-blue-600" />
              <span className="font-medium text-gray-700">購物清單</span>
            </button>
          </div>
          <SortDropdown />
        </div>
      </div>

      {/* 快速找年菜精靈按鈕 */}
      <div className="fixed bottom-20 right-4 z-40 lg:bottom-4 lg:right-20">
        <QuickWizard />
      </div>

      {/* Main content */}
      <div className="flex">
        {/* 桌面版：側邊篩選欄 */}
        <div className="hidden lg:block">
          <FilterSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        </div>

        {/* Plan list */}
        <main
          className={`flex-1 pb-24 transition-all duration-300 ${
            comparisonIds.length > 0 ? 'pb-32' : ''
          }`}
        >
          <PlanList onEditPlan={() => {}} onViewDetail={handleViewDetail} />
        </main>
      </div>

      {/* Admin link - 桌面版右下角，手機版左下角避免與 QuickWizard 重疊 */}
      <a
        href="/admin"
        className="fixed bottom-4 left-4 lg:left-auto lg:right-4 p-2 bg-[var(--card-bg)] border border-[var(--border)] rounded-full shadow-lg text-[var(--muted)] hover:text-[var(--foreground)] transition-colors z-30"
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

      {/* Vendor List Modal */}
      <VendorList
        isOpen={isVendorListOpen}
        onClose={() => setIsVendorListOpen(false)}
      />

      {/* Shopping List Panel */}
      <ShoppingListPanel
        isOpen={isShoppingListOpen}
        onClose={() => setIsShoppingListOpen(false)}
      />
    </div>
  );
}
