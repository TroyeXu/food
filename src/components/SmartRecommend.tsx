'use client';

import { useState, useMemo } from 'react';
import {
  TrendingUp,
  Award,
  Sparkles,
  DollarSign,
  Users,
  Leaf,
  Building2,
  Truck,
  ChevronRight,
  X,
  Star,
  Flame,
  Clock
} from 'lucide-react';
import { usePlanStore } from '@/stores/planStore';
import type { Plan } from '@/types';

// 快速篩選預設
const QUICK_PRESETS = [
  {
    id: 'best_value',
    label: '高CP值',
    emoji: '🏆',
    icon: Award,
    color: 'from-amber-500 to-orange-500',
    description: '每人$500以下',
    filter: { pricePerPersonMax: 500 },
  },
  {
    id: 'small_family',
    label: '小家庭',
    emoji: '👨‍👩‍👧',
    icon: Users,
    color: 'from-blue-500 to-cyan-500',
    description: '2-4人份',
    filter: { servingsMax: 4 },
  },
  {
    id: 'hotel',
    label: '飯店級',
    emoji: '🏨',
    icon: Building2,
    color: 'from-purple-500 to-pink-500',
    description: '五星品質',
    filter: { vendorType: 'hotel' as const },
  },
  {
    id: 'frozen_delivery',
    label: '宅配到家',
    emoji: '📦',
    icon: Truck,
    color: 'from-green-500 to-emerald-500',
    description: '冷凍宅配',
    filter: { storageType: 'frozen' as const, shippingType: 'delivery' as const },
  },
  {
    id: 'vegetarian',
    label: '素食年菜',
    emoji: '🥬',
    icon: Leaf,
    color: 'from-lime-500 to-green-500',
    description: '全素/蛋奶素',
    filter: { tags: ['素食', '全素', '蛋奶素'], tagLogic: 'OR' as const },
  },
  {
    id: 'budget',
    label: '$2000有找',
    emoji: '💰',
    icon: DollarSign,
    color: 'from-yellow-500 to-amber-500',
    description: '平價首選',
    filter: { priceMax: 2000 },
  },
];

export default function SmartRecommend() {
  const { plans, setFilters, resetFilters, getFilteredPlans } = usePlanStore();
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [showTopPicks, setShowTopPicks] = useState(false);

  // 計算統計資料
  const stats = useMemo(() => {
    const publishedPlans = plans.filter(p => p.status === 'published');

    // 每人均價最低 Top 5
    const byPricePerPerson = [...publishedPlans]
      .map(p => ({ ...p, pricePerPerson: Math.round(p.priceDiscount / p.servingsMin) }))
      .sort((a, b) => a.pricePerPerson - b.pricePerPerson)
      .slice(0, 5);

    // 飯店年菜最熱門（假設有最多資料的飯店）
    const hotelPlans = publishedPlans.filter(p => p.vendorType === 'hotel');
    const topHotels = [...hotelPlans]
      .sort((a, b) => a.priceDiscount - b.priceDiscount)
      .slice(0, 5);

    // 素食年菜
    const vegPlans = publishedPlans.filter(p =>
      p.tags?.some(t => ['素食', '全素', '蛋奶素', '蔬食'].includes(t))
    ).slice(0, 5);

    // 小家庭推薦（4人以下，價格合理）
    const smallFamilyPlans = publishedPlans
      .filter(p => (p.servingsMax || p.servingsMin) <= 4)
      .sort((a, b) => a.priceDiscount - b.priceDiscount)
      .slice(0, 5);

    // 有早鳥優惠的
    const earlyBird = publishedPlans
      .filter(p => p.tags?.some(t => t.includes('早鳥')))
      .slice(0, 5);

    return {
      total: publishedPlans.length,
      byPricePerPerson,
      topHotels,
      vegPlans,
      smallFamilyPlans,
      earlyBird,
      priceRange: {
        min: Math.min(...publishedPlans.map(p => p.priceDiscount)),
        max: Math.max(...publishedPlans.map(p => p.priceDiscount)),
      },
    };
  }, [plans]);

  const handlePresetClick = (preset: typeof QUICK_PRESETS[0]) => {
    if (activePreset === preset.id) {
      // 取消篩選
      resetFilters();
      setFilters({ onlyPublished: true });
      setActivePreset(null);
    } else {
      // 套用篩選
      resetFilters();
      setFilters({ ...preset.filter, onlyPublished: true });
      setActivePreset(preset.id);
    }
  };

  const handleTopPickClick = (plans: Plan[], title: string) => {
    // 顯示這些方案
    const ids = plans.map(p => p.id);
    // 用搜尋來篩選（因為沒有 id 篩選）
    resetFilters();
    setFilters({
      onlyPublished: true,
      searchQuery: plans.map(p => p.title).join('|').substring(0, 50)
    });
    setShowTopPicks(false);
  };

  return (
    <div className="bg-gradient-to-r from-red-50 to-orange-50 border-b border-red-100">
      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* 快速篩選按鈕 */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <span className="flex-shrink-0 text-sm font-medium text-gray-600 flex items-center gap-1">
            <Sparkles className="w-4 h-4 text-amber-500" />
            快速找：
          </span>

          {QUICK_PRESETS.map((preset) => {
            const Icon = preset.icon;
            const isActive = activePreset === preset.id;

            return (
              <button
                key={preset.id}
                onClick={() => handlePresetClick(preset)}
                className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-all ${
                  isActive
                    ? `bg-gradient-to-r ${preset.color} text-white shadow-md scale-105`
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 hover:border-gray-300'
                }`}
              >
                <span>{preset.emoji}</span>
                <span>{preset.label}</span>
                {isActive && (
                  <X className="w-3 h-3 ml-1" />
                )}
              </button>
            );
          })}
        </div>

        {/* 統計摘要 */}
        <div className="mt-3 flex items-center gap-4 text-xs text-gray-500 overflow-x-auto">
          <span className="flex items-center gap-1 flex-shrink-0">
            <Flame className="w-3 h-3 text-orange-500" />
            共 {stats.total} 款年菜
          </span>
          <span className="flex items-center gap-1 flex-shrink-0">
            <DollarSign className="w-3 h-3 text-green-500" />
            ${stats.priceRange.min.toLocaleString()} ~ ${stats.priceRange.max.toLocaleString()}
          </span>
          <span className="flex items-center gap-1 flex-shrink-0">
            <Star className="w-3 h-3 text-amber-500" />
            最低每人 ${stats.byPricePerPerson[0]?.pricePerPerson || 0}
          </span>
          {stats.earlyBird.length > 0 && (
            <span className="flex items-center gap-1 flex-shrink-0 text-red-600">
              <Clock className="w-3 h-3" />
              {stats.earlyBird.length} 款早鳥優惠中
            </span>
          )}
        </div>

        {/* 熱門榜單按鈕 */}
        <div className="mt-3 flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => {
              resetFilters();
              setFilters({ onlyPublished: true });
              usePlanStore.getState().setSortBy('price_per_person_asc');
              setActivePreset(null);
            }}
            className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 bg-white rounded-lg text-xs text-gray-600 hover:bg-amber-50 hover:text-amber-700 border border-gray-200 transition-colors"
          >
            <TrendingUp className="w-3 h-3" />
            CP值排行
            <ChevronRight className="w-3 h-3" />
          </button>

          <button
            onClick={() => {
              resetFilters();
              setFilters({ onlyPublished: true, vendorType: 'hotel' });
              usePlanStore.getState().setSortBy('price_asc');
              setActivePreset('hotel');
            }}
            className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 bg-white rounded-lg text-xs text-gray-600 hover:bg-purple-50 hover:text-purple-700 border border-gray-200 transition-colors"
          >
            <Building2 className="w-3 h-3" />
            飯店年菜
            <ChevronRight className="w-3 h-3" />
          </button>

          <button
            onClick={() => {
              resetFilters();
              setFilters({ onlyPublished: true, priceMax: 3000, servingsMax: 4 });
              usePlanStore.getState().setSortBy('price_asc');
              setActivePreset(null);
            }}
            className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 bg-white rounded-lg text-xs text-gray-600 hover:bg-blue-50 hover:text-blue-700 border border-gray-200 transition-colors"
          >
            <Users className="w-3 h-3" />
            小資小家庭
            <ChevronRight className="w-3 h-3" />
          </button>

          <button
            onClick={() => {
              resetFilters();
              setFilters({ onlyPublished: true, tags: ['早鳥優惠', '早鳥'], tagLogic: 'OR' });
              setActivePreset(null);
            }}
            className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 bg-white rounded-lg text-xs text-gray-600 hover:bg-red-50 hover:text-red-700 border border-gray-200 transition-colors"
          >
            <Clock className="w-3 h-3" />
            早鳥優惠
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
