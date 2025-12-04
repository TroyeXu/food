'use client';

import { X, Users, DollarSign, RotateCcw, Beef, Leaf } from 'lucide-react';
import { usePlanStore } from '@/stores/planStore';

export default function QuickFilters() {
  const { filters, setFilters } = usePlanStore();

  // 快速篩選選項
  const quickFilterOptions = [
    {
      id: 'budget_under_5k',
      label: '5千以下',
      icon: <DollarSign className="w-3.5 h-3.5" />,
      isActive: filters.priceMax === 5000 && !filters.priceMin,
      toggle: () => {
        if (filters.priceMax === 5000 && !filters.priceMin) {
          setFilters({ priceMax: undefined });
        } else {
          setFilters({ priceMin: undefined, priceMax: 5000 });
        }
      },
    },
    {
      id: 'budget_5k_10k',
      label: '5千~1萬',
      icon: <DollarSign className="w-3.5 h-3.5" />,
      isActive: filters.priceMin === 5000 && filters.priceMax === 10000,
      toggle: () => {
        if (filters.priceMin === 5000 && filters.priceMax === 10000) {
          setFilters({ priceMin: undefined, priceMax: undefined });
        } else {
          setFilters({ priceMin: 5000, priceMax: 10000 });
        }
      },
    },
    {
      id: 'servings_5_6',
      label: '5~6人',
      icon: <Users className="w-3.5 h-3.5" />,
      isActive: filters.servingsMin === 5 && filters.servingsMax === 6,
      toggle: () => {
        if (filters.servingsMin === 5 && filters.servingsMax === 6) {
          setFilters({ servingsMin: undefined, servingsMax: undefined });
        } else {
          setFilters({ servingsMin: 5, servingsMax: 6 });
        }
      },
    },
    {
      id: 'servings_10_plus',
      label: '10人以上',
      icon: <Users className="w-3.5 h-3.5" />,
      isActive: filters.servingsMin === 10,
      toggle: () => {
        if (filters.servingsMin === 10) {
          setFilters({ servingsMin: undefined, servingsMax: undefined });
        } else {
          setFilters({ servingsMin: 10, servingsMax: undefined });
        }
      },
    },
    {
      id: 'no_beef',
      label: '不吃牛',
      icon: <Beef className="w-3.5 h-3.5" />,
      isActive: filters.excludeKeywords?.includes('牛'),
      toggle: () => {
        const current = filters.excludeKeywords || [];
        if (current.includes('牛')) {
          setFilters({ excludeKeywords: current.filter(i => i !== '牛') });
        } else {
          setFilters({ excludeKeywords: [...current, '牛'] });
        }
      },
    },
    {
      id: 'vegetarian',
      label: '素食',
      icon: <Leaf className="w-3.5 h-3.5" />,
      isActive: filters.tags?.includes('素食'),
      toggle: () => {
        const current = filters.tags || [];
        if (current.includes('素食')) {
          setFilters({ tags: current.filter(t => t !== '素食') });
        } else {
          setFilters({ tags: [...current, '素食'] });
        }
      },
    },
  ];

  // 取得目前啟用的篩選條件
  const getActiveFilters = () => {
    const active: { key: string; label: string; clear: () => void }[] = [];

    if (filters.priceMin || filters.priceMax) {
      const label = filters.priceMin && filters.priceMax
        ? `$${filters.priceMin}-${filters.priceMax}`
        : filters.priceMin
          ? `$${filters.priceMin}以上`
          : `$${filters.priceMax}以下`;
      active.push({
        key: 'price',
        label: `價格: ${label}`,
        clear: () => setFilters({ priceMin: undefined, priceMax: undefined }),
      });
    }

    if (filters.pricePerPersonMax) {
      active.push({
        key: 'pricePerPerson',
        label: `每人$${filters.pricePerPersonMax}以內`,
        clear: () => setFilters({ pricePerPersonMax: undefined }),
      });
    }

    if (filters.servingsMin || filters.servingsMax) {
      const label = filters.servingsMin && filters.servingsMax
        ? `${filters.servingsMin}-${filters.servingsMax}人`
        : filters.servingsMin
          ? `${filters.servingsMin}人以上`
          : `${filters.servingsMax}人以下`;
      active.push({
        key: 'servings',
        label: `人數: ${label}`,
        clear: () => setFilters({ servingsMin: undefined, servingsMax: undefined }),
      });
    }

    if (filters.storageTypes && filters.storageTypes.length > 0) {
      const labels: Record<string, string> = { frozen: '冷凍', chilled: '冷藏', room_temp: '常溫' };
      active.push({
        key: 'storage',
        label: filters.storageTypes.map(t => labels[t]).join('/'),
        clear: () => setFilters({ storageTypes: [] }),
      });
    }

    if (filters.shippingTypes && filters.shippingTypes.length > 0) {
      const labels: Record<string, string> = { delivery: '宅配', pickup: '自取', both: '皆可' };
      active.push({
        key: 'shipping',
        label: filters.shippingTypes.map(t => labels[t]).join('/'),
        clear: () => setFilters({ shippingTypes: [] }),
      });
    }

    if (filters.shippingFee === 'free') {
      active.push({
        key: 'shippingFee',
        label: '免運費',
        clear: () => setFilters({ shippingFee: undefined }),
      });
    }

    if (filters.region) {
      active.push({
        key: 'region',
        label: `地區: ${filters.region}`,
        clear: () => setFilters({ region: undefined }),
      });
    }

    if (filters.maxDistance) {
      active.push({
        key: 'distance',
        label: `${filters.maxDistance}km內`,
        clear: () => setFilters({ maxDistance: undefined }),
      });
    }

    if (filters.tags && filters.tags.length > 0) {
      active.push({
        key: 'tags',
        label: `標籤: ${filters.tags.join(', ')}`,
        clear: () => setFilters({ tags: [] }),
      });
    }

    if (filters.excludeKeywords && filters.excludeKeywords.length > 0) {
      active.push({
        key: 'exclude',
        label: `排除: ${filters.excludeKeywords.join(', ')}`,
        clear: () => setFilters({ excludeKeywords: [] }),
      });
    }

    return active;
  };

  const activeFilters = getActiveFilters();
  const hasActiveFilters = activeFilters.length > 0 || filters.searchQuery;

  const clearAllFilters = () => {
    setFilters({
      searchQuery: '',
      priceMin: undefined,
      priceMax: undefined,
      pricePerPersonMax: undefined,
      servingsMin: undefined,
      servingsMax: undefined,
      storageTypes: [],
      shippingTypes: [],
      shippingFee: undefined,
      region: undefined,
      city: undefined,
      tags: [],
      excludeKeywords: [],
      maxDistance: undefined,
      showFavoritesOnly: false,
      showHistoryOnly: false,
    });
  };

  return (
    <div className="bg-[var(--card-bg)] border-b border-[var(--border)] px-4 py-2">
      {/* 快速篩選標籤 - 允許換行 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-[var(--muted)] font-medium whitespace-nowrap">快速篩選:</span>
        {quickFilterOptions.map((option) => (
          <button
            key={option.id}
            onClick={option.toggle}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
              option.isActive
                ? 'bg-[#c41e3a] text-white shadow-md'
                : 'bg-[#ffd700]/20 text-[#5d4037] hover:bg-[#ffd700]/40 border border-[#ffd700]/50'
            }`}
          >
            {option.icon}
            {option.label}
          </button>
        ))}

        {/* 清除全部按鈕 */}
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            清除
          </button>
        )}

      </div>
    </div>
  );
}
