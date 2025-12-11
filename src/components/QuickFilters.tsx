'use client';

import { useState } from 'react';
import { X, Users, DollarSign, RotateCcw, Beef, Leaf, ChevronDown, ChevronUp, Tag, Building2, Snowflake, Truck, Store, Heart, UtensilsCrossed } from 'lucide-react';
import { usePlanStore } from '@/stores/planStore';
import type { VendorType, ProductType, CuisineStyle, PriceLevel, FamilySize } from '@/types';

// 標籤分類 - 二層結構
const TAG_CATEGORIES = [
  {
    id: 'cuisine',
    label: '料理風格',
    icon: '🍽️',
    tags: ['台式', '粵式', '日式', '川菜', '湘菜', '上海菜', '創意料理'],
  },
  {
    id: 'feature',
    label: '特色',
    icon: '⭐',
    tags: ['飯店級', '米其林', '老字號', '限量', '冷凍年菜'],
  },
  {
    id: 'dietary',
    label: '飲食需求',
    icon: '🥗',
    tags: ['素食', '全素', '海鮮', '佛跳牆'],
  },
  {
    id: 'product',
    label: '年菜類型',
    icon: '🥘',
    tags: ['圍爐套餐', '單品', '伴手禮', '甜點', '湯品'],
  },
];

export default function QuickFilters() {
  const { filters, setFilters } = usePlanStore();
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // 快速篩選選項 - 根據實際資料分布優化
  const quickFilterOptions = [
    // 價格篩選
    {
      id: 'budget',
      label: '💰 $3000以下',
      icon: null,
      isActive: filters.priceMax === 3000 && !filters.priceMin,
      toggle: () => {
        if (filters.priceMax === 3000 && !filters.priceMin) {
          setFilters({ priceMax: undefined });
        } else {
          setFilters({ priceMin: undefined, priceMax: 3000 });
        }
      },
    },
    // 廠商類型
    {
      id: 'hotel',
      label: '🏨 飯店級',
      icon: null,
      isActive: filters.tags?.includes('飯店級'),
      toggle: () => {
        const current = filters.tags || [];
        if (current.includes('飯店級')) {
          setFilters({ tags: current.filter(t => t !== '飯店級') });
        } else {
          setFilters({ tags: [...current, '飯店級'] });
        }
      },
    },
    // 人數
    {
      id: 'small_family',
      label: '👨‍👩‍👧 小家庭',
      icon: null,
      isActive: filters.servingsMax === 4,
      toggle: () => {
        if (filters.servingsMax === 4) {
          setFilters({ servingsMin: undefined, servingsMax: undefined });
        } else {
          setFilters({ servingsMin: undefined, servingsMax: 4 });
        }
      },
    },
    // 冷凍保存
    {
      id: 'frozen',
      label: '❄️ 冷凍',
      icon: null,
      isActive: filters.storageTypes?.includes('frozen'),
      toggle: () => {
        const current = filters.storageTypes || [];
        if (current.includes('frozen')) {
          setFilters({ storageTypes: current.filter(t => t !== 'frozen') });
        } else {
          setFilters({ storageTypes: [...current, 'frozen'] });
        }
      },
    },
    // 宅配
    {
      id: 'delivery',
      label: '🚚 宅配',
      icon: null,
      isActive: filters.shippingTypes?.includes('delivery'),
      toggle: () => {
        const current = filters.shippingTypes || [];
        if (current.includes('delivery')) {
          setFilters({ shippingTypes: current.filter(t => t !== 'delivery') });
        } else {
          setFilters({ shippingTypes: [...current, 'delivery'] });
        }
      },
    },
    // 自取
    {
      id: 'pickup',
      label: '🏪 自取',
      icon: null,
      isActive: filters.shippingTypes?.includes('pickup'),
      toggle: () => {
        const current = filters.shippingTypes || [];
        if (current.includes('pickup')) {
          setFilters({ shippingTypes: current.filter(t => t !== 'pickup') });
        } else {
          setFilters({ shippingTypes: [...current, 'pickup'] });
        }
      },
    },
    // 素食
    {
      id: 'vegetarian',
      label: '🥬 素食',
      icon: null,
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
    // 佛跳牆
    {
      id: 'buddha',
      label: '🍲 佛跳牆',
      icon: null,
      isActive: filters.tags?.includes('佛跳牆'),
      toggle: () => {
        const current = filters.tags || [];
        if (current.includes('佛跳牆')) {
          setFilters({ tags: current.filter(t => t !== '佛跳牆') });
        } else {
          setFilters({ tags: [...current, '佛跳牆'] });
        }
      },
    },
    // 不吃牛
    {
      id: 'no_beef',
      label: '🚫🐄 不吃牛',
      icon: null,
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
    // 免運
    {
      id: 'freeShipping',
      label: '🎁 免運',
      icon: null,
      isActive: filters.shippingFee === 'free',
      toggle: () => {
        if (filters.shippingFee === 'free') {
          setFilters({ shippingFee: undefined });
        } else {
          setFilters({ shippingFee: 'free' });
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
  const selectedTags = filters.tags || [];

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

  const handleTagToggle = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setFilters({ tags: selectedTags.filter(t => t !== tag) });
    } else {
      setFilters({ tags: [...selectedTags, tag] });
    }
  };

  const handleCategoryClick = (categoryId: string) => {
    setExpandedCategory(expandedCategory === categoryId ? null : categoryId);
  };

  // 計算每個分類已選擇的標籤數
  const getCategorySelectedCount = (tags: string[]) => {
    return tags.filter(tag => selectedTags.includes(tag)).length;
  };

  return (
    <div className="bg-[var(--card-bg)] border-b border-[var(--border)]">
      {/* 快速篩選標籤 - 允許換行 */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2">
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

      {/* 標籤群組 - 二層結構 */}
      <div className="border-t border-[var(--border)] bg-gradient-to-r from-[#fff9e6] to-[#fff5f5]">
        {/* 分類標題列 */}
        <div className="flex items-center gap-1 px-4 py-2 overflow-x-auto scrollbar-hide">
          <Tag className="w-3.5 h-3.5 text-[#c41e3a] flex-shrink-0" />
          <span className="text-xs text-[var(--muted)] font-medium whitespace-nowrap mr-1">標籤:</span>
          {TAG_CATEGORIES.map((category) => {
            const selectedCount = getCategorySelectedCount(category.tags);
            const isExpanded = expandedCategory === category.id;
            return (
              <button
                key={category.id}
                onClick={() => handleCategoryClick(category.id)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  isExpanded
                    ? 'bg-[#c41e3a] text-white shadow-md'
                    : selectedCount > 0
                      ? 'bg-[#c41e3a]/10 text-[#c41e3a] border border-[#c41e3a]/30'
                      : 'bg-white/80 text-[#5d4037] hover:bg-[#ffd700]/30 border border-[#ffd700]/30'
                }`}
              >
                <span>{category.icon}</span>
                <span>{category.label}</span>
                {selectedCount > 0 && (
                  <span className={`ml-0.5 px-1.5 py-0.5 text-[10px] rounded-full ${
                    isExpanded ? 'bg-white/30 text-white' : 'bg-[#c41e3a] text-white'
                  }`}>
                    {selectedCount}
                  </span>
                )}
                {isExpanded ? (
                  <ChevronUp className="w-3 h-3 ml-0.5" />
                ) : (
                  <ChevronDown className="w-3 h-3 ml-0.5" />
                )}
              </button>
            );
          })}

          {/* 已選標籤數量提示 */}
          {selectedTags.length > 0 && (
            <span className="ml-auto text-xs text-[#c41e3a] font-medium whitespace-nowrap flex-shrink-0">
              已選 {selectedTags.length} 個標籤
            </span>
          )}
        </div>

        {/* 展開的子標籤 */}
        {expandedCategory && (
          <div className="px-4 py-2 border-t border-[#ffd700]/30 bg-white/50">
            <div className="flex flex-wrap gap-1.5">
              {TAG_CATEGORIES.find(c => c.id === expandedCategory)?.tags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleTagToggle(tag)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                    selectedTags.includes(tag)
                      ? 'bg-[#c41e3a] text-white shadow-sm'
                      : 'bg-white text-[#5d4037] hover:bg-[#ffd700]/30 border border-[#e0e0e0] hover:border-[#ffd700]'
                  }`}
                >
                  {tag}
                </button>
              ))}
              {/* 全選/取消此分類 */}
              <button
                onClick={() => {
                  const categoryTags = TAG_CATEGORIES.find(c => c.id === expandedCategory)?.tags || [];
                  const allSelected = categoryTags.every(tag => selectedTags.includes(tag));
                  if (allSelected) {
                    // 取消此分類所有標籤
                    setFilters({ tags: selectedTags.filter(t => !categoryTags.includes(t)) });
                  } else {
                    // 全選此分類標籤
                    const newTags = [...new Set([...selectedTags, ...categoryTags])];
                    setFilters({ tags: newTags });
                  }
                }}
                className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all border border-gray-200"
              >
                {TAG_CATEGORIES.find(c => c.id === expandedCategory)?.tags.every(tag => selectedTags.includes(tag))
                  ? '取消全選'
                  : '全選此類'}
              </button>
            </div>
          </div>
        )}

        {/* 已選標籤快速顯示 (當沒有展開分類時) */}
        {!expandedCategory && selectedTags.length > 0 && (
          <div className="px-4 py-1.5 border-t border-[#ffd700]/30 bg-white/30">
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[10px] text-[var(--muted)]">已選:</span>
              {selectedTags.slice(0, 8).map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleTagToggle(tag)}
                  className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] bg-[#c41e3a]/10 text-[#c41e3a] hover:bg-[#c41e3a]/20 transition-all"
                >
                  {tag}
                  <X className="w-2.5 h-2.5" />
                </button>
              ))}
              {selectedTags.length > 8 && (
                <span className="text-[10px] text-[var(--muted)]">+{selectedTags.length - 8} 更多</span>
              )}
              <button
                onClick={() => setFilters({ tags: [] })}
                className="ml-auto text-[10px] text-gray-500 hover:text-[#c41e3a] transition-colors"
              >
                清除標籤
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
