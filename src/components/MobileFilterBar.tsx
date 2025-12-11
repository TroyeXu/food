'use client';

import { useState, useMemo } from 'react';
import {
  Filter, X, ChevronDown, ChevronUp, RotateCcw,
  Sparkles, TrendingUp, Users, DollarSign, Truck, Leaf,
  SortAsc, Tag, MapPin, Check, Search, Store, ArrowUpDown
} from 'lucide-react';
import { usePlanStore } from '@/stores/planStore';
import type { SortOption } from '@/types';

// 預設快速篩選
const QUICK_FILTERS = [
  { id: 'cp', label: 'CP值', emoji: '🏆', filter: { sortBy: 'price_per_person_asc' as const } },
  { id: 'free_ship', label: '免運', emoji: '🚚', filter: { shippingFee: 'free' } },
  { id: 'early_bird', label: '早鳥', emoji: '🐦', filter: { tags: ['早鳥優惠'] } },
  { id: 'small', label: '小家庭', emoji: '👨‍👩‍👧', filter: { servingsMax: 4 } },
  { id: 'budget', label: '$3K以下', emoji: '💰', filter: { priceMax: 3000 } },
  { id: 'hotel', label: '飯店級', emoji: '🏨', filter: { vendorType: 'hotel' } },
  { id: 'veg', label: '素食', emoji: '🥬', filter: { tags: ['素食'] } },
];

// 排序選項
const SORT_OPTIONS: { value: SortOption; label: string; emoji: string }[] = [
  { value: 'price_asc', label: '價格低→高', emoji: '💰' },
  { value: 'price_desc', label: '價格高→低', emoji: '💎' },
  { value: 'price_per_person_asc', label: '單人價低→高', emoji: '🏆' },
  { value: 'servings_asc', label: '份量少→多', emoji: '👤' },
  { value: 'servings_desc', label: '份量多→少', emoji: '👨‍👩‍👧‍👦' },
  { value: 'deadline_asc', label: '即將截止', emoji: '⏰' },
  { value: 'updated_desc', label: '最新更新', emoji: '🆕' },
];

// 標籤分類
const TAG_CATEGORIES = [
  {
    id: 'promo',
    label: '優惠活動',
    emoji: '🎉',
    tags: ['早鳥優惠', '免運', '限量', '頂級', '平價'],
  },
  {
    id: 'cuisine',
    label: '料理風格',
    emoji: '🍽️',
    tags: ['台式', '粵式', '日式', '西式', '川式', '上海', '客家'],
  },
  {
    id: 'ingredient',
    label: '主打食材',
    emoji: '🥩',
    tags: ['海鮮', '雞肉', '豬肉', '牛肉', '素食', '蔬食'],
  },
  {
    id: 'classic',
    label: '經典年菜',
    emoji: '🍲',
    tags: ['佛跳牆', '烏魚子', '東坡肉', '紅燒蹄膀', '燒雞', '烤鴨', '鮑魚'],
  },
  {
    id: 'type',
    label: '套餐類型',
    emoji: '🎁',
    tags: ['圍爐套餐', '年菜禮盒', '單品', '小家庭', '冷凍年菜'],
  },
  {
    id: 'brand',
    label: '品牌特色',
    emoji: '⭐',
    tags: ['飯店級', '米其林', '老字號', '手工製作', '有機'],
  },
  {
    id: 'dietary',
    label: '飲食限制',
    emoji: '🚫',
    tags: ['不吃牛', '不吃豬', '不吃海鮮', '無甲殼類', '清真'],
  },
];

// 地區選項
const REGION_OPTIONS = [
  { value: 'all', label: '全部', emoji: '🌏' },
  { value: 'north', label: '北部', emoji: '🏙️' },
  { value: 'central', label: '中部', emoji: '🏔️' },
  { value: 'south', label: '南部', emoji: '🌴' },
  { value: 'east', label: '東部', emoji: '🌊' },
  { value: 'nationwide', label: '全台配送', emoji: '📦' },
];

// 廠商 Tab 內容元件
function VendorTabContent({
  plans,
  onSelectVendor,
}: {
  plans: { vendorName: string; vendorType?: string; priceDiscount: number; status: string }[];
  onSelectVendor: (name: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');

  const vendorStats = useMemo(() => {
    const publishedPlans = plans.filter(p => p.status === 'published');
    const vendorMap = new Map<string, { name: string; type: string; count: number; minPrice: number }>();

    for (const plan of publishedPlans) {
      const existing = vendorMap.get(plan.vendorName);
      if (existing) {
        existing.count++;
        existing.minPrice = Math.min(existing.minPrice, plan.priceDiscount);
      } else {
        vendorMap.set(plan.vendorName, {
          name: plan.vendorName,
          type: plan.vendorType || 'other',
          count: 1,
          minPrice: plan.priceDiscount,
        });
      }
    }

    return Array.from(vendorMap.values()).sort((a, b) => b.count - a.count);
  }, [plans]);

  const filteredVendors = useMemo(() => {
    if (!searchQuery) return vendorStats;
    const query = searchQuery.toLowerCase();
    return vendorStats.filter(v => v.name.toLowerCase().includes(query));
  }, [vendorStats, searchQuery]);

  const typeEmojis: Record<string, string> = {
    hotel: '🏨',
    restaurant: '🍽️',
    brand: '📦',
    convenience: '🏪',
    hypermarket: '🛒',
    vegetarian: '🥬',
    other: '🏷️',
  };

  return (
    <div className="p-4 space-y-3">
      {/* 搜尋欄 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="搜尋廠商名稱..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#c41e3a]/30"
        />
      </div>

      {/* 廠商數量 */}
      <div className="text-sm text-gray-500">
        共 {filteredVendors.length} 家廠商
      </div>

      {/* 廠商列表 */}
      <div className="space-y-2">
        {filteredVendors.map((vendor) => (
          <button
            key={vendor.name}
            onClick={() => onSelectVendor(vendor.name)}
            className="w-full py-3 px-4 rounded-lg text-left transition-all flex items-center gap-3 bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            <span className="text-xl">{typeEmojis[vendor.type] || '🏷️'}</span>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{vendor.name}</div>
              <div className="text-xs text-gray-500">
                {vendor.count} 款 · ${vendor.minPrice.toLocaleString()} 起
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400 -rotate-90" />
          </button>
        ))}
      </div>
    </div>
  );
}

interface MobileFilterBarProps {
  onOpenVendorList?: () => void;
}

export default function MobileFilterBar({ onOpenVendorList }: MobileFilterBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeQuickFilter, setActiveQuickFilter] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'basic' | 'sort' | 'tags' | 'region' | 'vendor'>('basic');
  const [expandedTagCategory, setExpandedTagCategory] = useState<string | null>(null);
  const { plans, filters, setFilters, resetFilters, setSortBy, sortBy, getFilteredPlans } = usePlanStore();

  const filteredCount = getFilteredPlans().length;
  const totalCount = plans.filter(p => p.status === 'published').length;

  // 計算是否有篩選條件
  const hasFilters = useMemo(() => {
    return (
      !!filters.searchQuery ||
      filters.priceMin !== undefined ||
      filters.priceMax !== undefined ||
      filters.servingsMin !== undefined ||
      filters.servingsMax !== undefined ||
      (filters.storageTypes && filters.storageTypes.length > 0) ||
      (filters.shippingTypes && filters.shippingTypes.length > 0) ||
      filters.shippingFee === 'free' ||
      filters.vendorType !== undefined ||
      (filters.tags && filters.tags.length > 0) ||
      filters.region !== undefined
    );
  }, [filters]);

  const handleQuickFilter = (filterId: string) => {
    const quickFilter = QUICK_FILTERS.find(f => f.id === filterId);
    if (!quickFilter) return;

    if (activeQuickFilter === filterId) {
      // 取消篩選
      resetFilters();
      setFilters({ onlyPublished: true });
      setActiveQuickFilter(null);
    } else {
      // 套用篩選
      resetFilters();
      const newFilters: Record<string, unknown> = { onlyPublished: true, ...quickFilter.filter };

      // 特殊處理排序
      if ('sortBy' in quickFilter.filter && quickFilter.filter.sortBy) {
        setSortBy(quickFilter.filter.sortBy);
        delete newFilters.sortBy;
      }

      setFilters(newFilters);
      setActiveQuickFilter(filterId);
    }
  };

  const handleClearAll = () => {
    resetFilters();
    setFilters({ onlyPublished: true });
    setActiveQuickFilter(null);
  };

  return (
    <div className="lg:hidden bg-white border-b border-gray-200 sticky top-0 z-20">
      {/* 搜尋欄 */}
      <div className="px-4 pt-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜尋餐廳、方案、菜名..."
            value={filters.searchQuery || ''}
            onChange={(e) => setFilters({ searchQuery: e.target.value })}
            className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#c41e3a]/30 focus:border-[#c41e3a] transition-all"
          />
          {filters.searchQuery && (
            <button
              onClick={() => setFilters({ searchQuery: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 rounded-full text-gray-400"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 主列：統計 + 篩選按鈕 */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-800">
            {filteredCount} 款年菜
          </span>
          {hasFilters && filteredCount !== totalCount && (
            <span className="text-xs text-gray-400">
              / 共 {totalCount} 款
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {hasFilters && (
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-red-600"
            >
              <RotateCcw className="w-3 h-3" />
              清除
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              isExpanded || hasFilters
                ? 'bg-[#c41e3a] text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            <Filter className="w-4 h-4" />
            篩選
            {hasFilters && !isExpanded && (
              <span className="w-2 h-2 bg-white rounded-full" />
            )}
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* 快速篩選列 */}
      <div className="flex items-center gap-2 px-4 pb-2 overflow-x-auto scrollbar-hide">
        {QUICK_FILTERS.map((qf) => (
          <button
            key={qf.id}
            onClick={() => handleQuickFilter(qf.id)}
            className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              activeQuickFilter === qf.id
                ? 'bg-[#c41e3a] text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <span>{qf.emoji}</span>
            <span>{qf.label}</span>
          </button>
        ))}
      </div>

      {/* 展開的詳細篩選 - 全屏滑出面板 */}
      {isExpanded && (
        <div className="fixed inset-0 z-50 bg-white animate-in slide-in-from-bottom duration-300">
          {/* 頂部標題列 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white sticky top-0">
            <h2 className="text-lg font-bold text-gray-800">篩選條件</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={handleClearAll}
                className="text-sm text-gray-500 hover:text-red-600"
              >
                清除全部
              </button>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Tab 頁籤 */}
          <div className="flex border-b border-gray-200 bg-gray-50">
            {[
              { id: 'basic', label: '基本', icon: '📋' },
              { id: 'sort', label: '排序', icon: '📊' },
              { id: 'tags', label: '標籤', icon: '🏷️' },
              { id: 'region', label: '地區', icon: '📍' },
              { id: 'vendor', label: '廠商', icon: '🏪' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex-1 py-3 text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'text-[#c41e3a] border-b-2 border-[#c41e3a] bg-white'
                    : 'text-gray-500'
                }`}
              >
                <span className="mr-1">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab 內容 */}
          <div className="overflow-y-auto" style={{ height: 'calc(100vh - 180px)' }}>
            {/* 基本篩選 */}
            {activeTab === 'basic' && (
              <div className="p-4 space-y-5">
                {/* 預算 */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">預算範圍</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: '不限', value: undefined },
                      { label: '$2K', value: 2000 },
                      { label: '$5K', value: 5000 },
                      { label: '$10K', value: 10000 },
                    ].map((opt) => (
                      <button
                        key={opt.label}
                        onClick={() => setFilters({ priceMax: opt.value, priceMin: undefined })}
                        className={`py-2.5 text-sm rounded-lg transition-all ${
                          filters.priceMax === opt.value
                            ? 'bg-[#c41e3a] text-white shadow-md'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 人數 */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">用餐人數</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: '不限', min: undefined, max: undefined },
                      { label: '2-4人', min: undefined, max: 4 },
                      { label: '5-6人', min: 5, max: 6 },
                      { label: '7人+', min: 7, max: undefined },
                    ].map((opt) => (
                      <button
                        key={opt.label}
                        onClick={() => setFilters({ servingsMin: opt.min, servingsMax: opt.max })}
                        className={`py-2.5 text-sm rounded-lg transition-all ${
                          filters.servingsMin === opt.min && filters.servingsMax === opt.max
                            ? 'bg-[#c41e3a] text-white shadow-md'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 配送方式 - 多選 */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">配送方式（可多選）</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: '宅配', value: 'delivery', emoji: '🚚' },
                      { label: '自取', value: 'pickup', emoji: '🏪' },
                    ].map((opt) => {
                      const isSelected = filters.shippingTypes?.includes(opt.value as 'delivery' | 'pickup') || false;
                      return (
                        <button
                          key={opt.label}
                          onClick={() => {
                            const current = filters.shippingTypes || [];
                            if (isSelected) {
                              setFilters({ shippingTypes: current.filter(t => t !== opt.value) });
                            } else {
                              setFilters({ shippingTypes: [...current, opt.value as 'delivery' | 'pickup'] });
                            }
                          }}
                          className={`py-2.5 text-sm rounded-lg transition-all flex items-center justify-center gap-1 ${
                            isSelected
                              ? 'bg-[#c41e3a] text-white shadow-md'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          <span>{opt.emoji}</span>
                          {opt.label}
                          {isSelected && <Check className="w-4 h-4 ml-1" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 保存方式 - 多選 */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">保存方式（可多選）</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: '冷凍', value: 'frozen', emoji: '❄️' },
                      { label: '冷藏', value: 'chilled', emoji: '🧊' },
                      { label: '常溫', value: 'room_temp', emoji: '🌡️' },
                    ].map((opt) => {
                      const isSelected = filters.storageTypes?.includes(opt.value as 'frozen' | 'chilled' | 'room_temp') || false;
                      return (
                        <button
                          key={opt.label}
                          onClick={() => {
                            const current = filters.storageTypes || [];
                            if (isSelected) {
                              setFilters({ storageTypes: current.filter(t => t !== opt.value) });
                            } else {
                              setFilters({ storageTypes: [...current, opt.value as 'frozen' | 'chilled' | 'room_temp'] });
                            }
                          }}
                          className={`py-2.5 text-sm rounded-lg transition-all flex flex-col items-center gap-0.5 ${
                            isSelected
                              ? 'bg-[#c41e3a] text-white shadow-md'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          <span>{opt.emoji}</span>
                          <span className="text-xs">{opt.label}</span>
                          {isSelected && <Check className="w-3 h-3" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 免運篩選 */}
                <div>
                  <button
                    onClick={() => setFilters({
                      shippingFee: filters.shippingFee === 'free' ? undefined : 'free'
                    })}
                    className={`w-full py-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                      filters.shippingFee === 'free'
                        ? 'bg-green-500 text-white shadow-md'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <Truck className="w-4 h-4" />
                    只看免運費
                    {filters.shippingFee === 'free' && <Check className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* 排序 */}
            {activeTab === 'sort' && (
              <div className="p-4 space-y-2">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSortBy(opt.value)}
                    className={`w-full py-3 px-4 rounded-lg text-left transition-all flex items-center gap-3 ${
                      sortBy === opt.value
                        ? 'bg-[#c41e3a] text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <span className="text-xl">{opt.emoji}</span>
                    <span className="font-medium">{opt.label}</span>
                    {sortBy === opt.value && <Check className="w-5 h-5 ml-auto" />}
                  </button>
                ))}
              </div>
            )}

            {/* 標籤 */}
            {activeTab === 'tags' && (
              <div className="p-4 space-y-3">
                {/* 已選標籤 */}
                {filters.tags && filters.tags.length > 0 && (
                  <div className="pb-3 border-b border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        已選標籤 ({filters.tags.length})
                      </span>
                      <button
                        onClick={() => setFilters({ tags: [] })}
                        className="text-xs text-red-500"
                      >
                        清除標籤
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {filters.tags.map((tag) => (
                        <button
                          key={tag}
                          onClick={() => {
                            const newTags = filters.tags?.filter(t => t !== tag) || [];
                            setFilters({ tags: newTags });
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 bg-[#c41e3a] text-white rounded-full text-xs"
                        >
                          {tag}
                          <X className="w-3 h-3" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 標籤分類 */}
                {TAG_CATEGORIES.map((category) => (
                  <div key={category.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedTagCategory(
                        expandedTagCategory === category.id ? null : category.id
                      )}
                      className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100"
                    >
                      <span className="flex items-center gap-2 font-medium text-gray-700">
                        <span>{category.emoji}</span>
                        {category.label}
                        {category.tags.filter(t => filters.tags?.includes(t)).length > 0 && (
                          <span className="px-1.5 py-0.5 bg-[#c41e3a] text-white text-xs rounded-full">
                            {category.tags.filter(t => filters.tags?.includes(t)).length}
                          </span>
                        )}
                      </span>
                      {expandedTagCategory === category.id ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                    {expandedTagCategory === category.id && (
                      <div className="p-3 bg-white">
                        <div className="flex flex-wrap gap-2">
                          {category.tags.map((tag) => {
                            const isSelected = filters.tags?.includes(tag);
                            return (
                              <button
                                key={tag}
                                onClick={() => {
                                  const currentTags = filters.tags || [];
                                  if (isSelected) {
                                    setFilters({ tags: currentTags.filter(t => t !== tag) });
                                  } else {
                                    setFilters({ tags: [...currentTags, tag] });
                                  }
                                }}
                                className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                                  isSelected
                                    ? 'bg-[#c41e3a] text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                              >
                                {tag}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 地區 */}
            {activeTab === 'region' && (
              <div className="p-4 space-y-3">
                {REGION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFilters({ region: opt.value === 'all' ? undefined : opt.value as 'north' | 'central' | 'south' | 'east' | 'islands' | 'nationwide' })}
                    className={`w-full py-3 px-4 rounded-lg text-left transition-all flex items-center gap-3 ${
                      (filters.region || 'all') === opt.value
                        ? 'bg-[#c41e3a] text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <span className="text-xl">{opt.emoji}</span>
                    <span className="font-medium">{opt.label}</span>
                    {(filters.region || 'all') === opt.value && <Check className="w-5 h-5 ml-auto" />}
                  </button>
                ))}
              </div>
            )}

            {/* 廠商列表 */}
            {activeTab === 'vendor' && (
              <VendorTabContent
                plans={plans}
                onSelectVendor={(vendorName) => {
                  resetFilters();
                  setFilters({ searchQuery: vendorName, onlyPublished: true });
                  setIsExpanded(false);
                }}
              />
            )}
          </div>

          {/* 底部套用按鈕 */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-lg">
            <button
              onClick={() => setIsExpanded(false)}
              className="w-full py-3.5 bg-[#c41e3a] text-white rounded-xl font-bold text-lg shadow-md"
            >
              查看 {filteredCount} 款年菜
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
