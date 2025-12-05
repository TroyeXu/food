'use client';

import { useState, useEffect } from 'react';
import { Search, Heart, X, Clock, GitCompare, LayoutGrid, List } from 'lucide-react';
import { usePlanStore } from '@/stores/planStore';

interface ConsumerToolbarProps {
  onOpenCompare?: () => void;
}

export default function ConsumerToolbar({ onOpenCompare }: ConsumerToolbarProps) {
  const {
    filters,
    setFilters,
    getFilteredPlans,
    favoriteIds,
    historyIds,
    comparisonIds,
    setCompareModalOpen,
    viewMode,
    setViewMode,
  } = usePlanStore();

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const planCount = getFilteredPlans().length;
  const favoriteCount = isMounted ? favoriteIds.length : 0;
  const historyCount = isMounted ? historyIds.length : 0;
  const comparisonCount = isMounted ? comparisonIds.length : 0;
  const showFavoritesOnly = filters.showFavoritesOnly || false;
  const showHistoryOnly = filters.showHistoryOnly || false;

  const toggleFavoritesFilter = () => {
    setFilters({ showFavoritesOnly: !showFavoritesOnly, showHistoryOnly: false });
  };

  const toggleHistoryFilter = () => {
    setFilters({ showHistoryOnly: !showHistoryOnly, showFavoritesOnly: false });
  };

  const handleOpenCompare = () => {
    if (onOpenCompare) {
      onOpenCompare();
    } else {
      setCompareModalOpen(true);
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-gradient-to-r from-[#c41e3a] via-[#dc2626] to-[#c41e3a] border-b-4 border-[#ffd700] px-4 py-3 shadow-lg">
      {/* 第一行：Logo / 標題 - 獨立一行置中 */}
      <div className="flex items-center justify-center gap-2 mb-2">
        <span className="text-2xl">🧧</span>
        <h1 className="text-xl font-bold text-[#ffd700]">年菜比較</h1>
        <span className="text-2xl">🧧</span>
      </div>

      {/* 第二行：搜尋欄 + 結果數 */}
      <div className="flex items-center gap-2 mb-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
          <input
            type="text"
            placeholder="搜尋餐廳、方案、菜名、標籤..."
            value={filters.searchQuery || ''}
            onChange={(e) => setFilters({ searchQuery: e.target.value })}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-white/30 bg-white/95 text-sm text-[#5d4037] placeholder-[#8b7355] focus:outline-none focus:ring-2 focus:ring-[#ffd700] focus:border-transparent"
          />
          {filters.searchQuery && (
            <button
              onClick={() => setFilters({ searchQuery: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full text-[var(--muted)]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {/* Result count - 顯示為文字資訊 */}
        <span className="text-xs text-white/90 whitespace-nowrap">
          共 <span className="font-bold text-[#ffd700]">{planCount}</span> 個方案
        </span>
      </div>

      {/* 第三行：按鈕組 */}
      <div className="flex items-center gap-2">
          {/* Compare button */}
          <button
            onClick={handleOpenCompare}
            disabled={comparisonCount < 2}
            className={`flex items-center gap-1 rounded text-[11px] font-medium transition-all ${
              comparisonCount >= 2
                ? 'bg-gradient-to-r from-[#ffd700] to-[#ffed4a] text-[#5d4037] border border-[#ffd700] shadow-md pulse-glow'
                : comparisonCount > 0
                  ? 'toolbar-btn border border-[#ffd700]/50'
                  : 'toolbar-btn opacity-60 cursor-not-allowed'
            }`}
            style={{ padding: '0.3rem' }}
            title={comparisonCount >= 2 ? '開啟比較' : comparisonCount > 0 ? `已選 ${comparisonCount} 個，需選 2 個以上` : '請選擇方案加入比對'}
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>比較</span>
            {comparisonCount > 0 && (
              <span className={comparisonCount >= 2 ? 'bg-[#5d4037] text-[#ffd700] text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center' : 'badge-gold'}>
                {comparisonCount}
              </span>
            )}
          </button>

          {/* History toggle */}
          {isMounted && historyCount > 0 && (
            <button
              onClick={toggleHistoryFilter}
              className={`flex items-center gap-1 rounded text-[11px] transition-all ${
                showHistoryOnly
                  ? 'toolbar-btn-active'
                  : 'toolbar-btn'
              }`}
              style={{ padding: '0.3rem' }}
              title="最近瀏覽"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>紀錄</span>
              <span className={showHistoryOnly ? 'badge-white' : 'badge-gold'}>
                {historyCount}
              </span>
            </button>
          )}

          {/* Favorites toggle */}
          <button
            onClick={toggleFavoritesFilter}
            className={`flex items-center gap-1 rounded text-[11px] transition-all ${
              showFavoritesOnly
                ? 'toolbar-btn-active'
                : 'toolbar-btn'
            }`}
            style={{ padding: '0.3rem' }}
            title="查看收藏"
          >
            <Heart className={`w-3.5 h-3.5 ${showFavoritesOnly ? 'fill-current' : ''}`} />
            <span>收藏</span>
            {favoriteCount > 0 && (
              <span className={showFavoritesOnly ? 'badge-white' : 'badge-gold'}>
                {favoriteCount}
              </span>
            )}
          </button>

          {/* View mode toggle - 卡片 */}
          <button
            onClick={() => setViewMode('grid')}
            className={`flex items-center gap-1 rounded text-[11px] transition-all ${
              viewMode === 'grid'
                ? 'toolbar-btn-active'
                : 'toolbar-btn'
            }`}
            style={{ padding: '0.3rem' }}
            title="卡片檢視"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          {/* View mode toggle - 列表 */}
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1 rounded text-[11px] transition-all ${
              viewMode === 'list'
                ? 'toolbar-btn-active'
                : 'toolbar-btn'
            }`}
            style={{ padding: '0.3rem' }}
            title="列表檢視"
          >
            <List className="w-3.5 h-3.5" />
          </button>
      </div>

      {/* Favorites filter banner */}
      {showFavoritesOnly && (
        <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-[#ffd700] rounded-lg text-sm shadow-md">
          <Heart className="w-4 h-4 fill-current text-[#c41e3a]" />
          <span className="text-[#5d4037] font-medium">僅顯示 <strong className="text-[#c41e3a]">{favoriteCount}</strong> 個收藏的方案</span>
          <button
            onClick={toggleFavoritesFilter}
            className="ml-auto p-1.5 hover:bg-[#5d4037]/10 rounded-full text-[#5d4037]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* History filter banner */}
      {showHistoryOnly && (
        <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-[#ffd700] rounded-lg text-sm shadow-md">
          <Clock className="w-4 h-4 text-[#c41e3a]" />
          <span className="text-[#5d4037] font-medium">僅顯示 <strong className="text-[#c41e3a]">{historyCount}</strong> 個最近瀏覽的方案</span>
          <button
            onClick={toggleHistoryFilter}
            className="ml-auto p-1.5 hover:bg-[#5d4037]/10 rounded-full text-[#5d4037]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </header>
  );
}
