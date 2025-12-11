'use client';

import { useState, useCallback } from 'react';
import { ChevronDown, ChevronUp, RotateCcw, X, MapPin, Loader2 } from 'lucide-react';
import { usePlanStore } from '@/stores/planStore';
import type { ShippingType, StorageType, SortOption, TaiwanRegion, TaiwanCity } from '@/types';
import { REGION_LABELS, REGION_CITIES, CITY_DISTRICTS } from '@/types';

const PRICE_MIN = 0;
const PRICE_MAX = 20000;
const PRICE_STEP = 500;

const SERVING_RANGES = [
  { min: 2, max: 4, label: '2-4 人' },
  { min: 5, max: 6, label: '5-6 人' },
  { min: 7, max: 8, label: '7-8 人' },
  { min: 9, max: 10, label: '9-10 人' },
  { min: 10, max: undefined, label: '10 人以上' },
];

const SHIPPING_OPTIONS: { value: ShippingType; label: string }[] = [
  { value: 'delivery', label: '宅配' },
  { value: 'pickup', label: '自取' },
];

const STORAGE_OPTIONS: { value: StorageType; label: string }[] = [
  { value: 'frozen', label: '冷凍' },
  { value: 'chilled', label: '冷藏' },
  { value: 'room_temp', label: '常溫' },
];

const REGION_OPTIONS: { value: TaiwanRegion | 'all'; label: string }[] = [
  { value: 'all', label: '全部地區' },
  { value: 'north', label: '北部' },
  { value: 'central', label: '中部' },
  { value: 'south', label: '南部' },
  { value: 'east', label: '東部' },
  { value: 'islands', label: '離島' },
  { value: 'nationwide', label: '全台配送' },
];

const TAG_CATEGORIES = [
  {
    label: '菜系風格',
    tags: ['台式', '粵式', '日式', '西式', '川式', '上海', '客家', '潮州'],
  },
  {
    label: '主打食材',
    tags: ['海鮮', '雞肉', '豬肉', '牛肉', '鴨肉', '羊肉', '蔬食', '素食'],
  },
  {
    label: '經典年菜',
    tags: ['佛跳牆', '烏魚子', '東坡肉', '紅燒蹄膀', '燒雞', '烤鴨', '鮑魚', '龍蝦', '帝王蟹', '干貝', '魚翅'],
  },
  {
    label: '年節必備',
    tags: ['年糕', '蘿蔔糕', '發糕', '長年菜', '魚料理', '湯品', '甜點'],
  },
  {
    label: '套餐類型',
    tags: ['圍爐套餐', '年菜禮盒', '單點組合', '精緻小家庭', '澎湃大家庭'],
  },
  {
    label: '品牌特色',
    tags: ['飯店級', '米其林', '老字號', '手工製作', '有機', '無添加', '低油低鈉'],
  },
  {
    label: '其他',
    tags: ['含酒', '不含酒', '可加熱即食', '需料理'],
  },
  {
    label: '飲食限制',
    tags: ['不吃牛', '不吃豬', '不吃海鮮', '無甲殼類', '無堅果', '清真'],
  },
];

const SORT_OPTIONS: { value: SortOption; label: string; needsLocation?: boolean }[] = [
  { value: 'price_asc', label: '價格低 → 高' },
  { value: 'price_desc', label: '價格高 → 低' },
  { value: 'price_per_person_asc', label: '單人價低 → 高' },
  { value: 'servings_asc', label: '份量少 → 多' },
  { value: 'servings_desc', label: '份量多 → 少' },
  { value: 'updated_desc', label: '最新更新' },
  { value: 'vendor_asc', label: '餐廳名稱 A-Z' },
  { value: 'distance_asc', label: '距離最近', needsLocation: true },
];

// 區塊圖標對應
const SECTION_ICONS: Record<string, string> = {
  '價格區間': '💰',
  '份量人數': '👨‍👩‍👧‍👦',
  '供應方式': '🚚',
  '保存方式': '❄️',
  '地區': '📍',
  '標籤': '🏷️',
};

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: number;
}

function CollapsibleSection({ title, defaultOpen = true, children, badge }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const icon = SECTION_ICONS[title] || '✨';

  return (
    <div className="border-b border-[var(--border)] pb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full py-2 text-sm font-medium text-[var(--foreground)] hover:text-[var(--primary)] transition-colors"
      >
        <span className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <span className="font-semibold">{title}</span>
          {badge !== undefined && badge > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-gradient-to-r from-[var(--primary)] to-[#ff6b6b] text-white rounded-full shadow-sm">
              {badge}
            </span>
          )}
        </span>
        {isOpen ? <ChevronUp className="w-4 h-4 text-[var(--gold)]" /> : <ChevronDown className="w-4 h-4 text-[var(--muted)]" />}
      </button>
      {isOpen && <div className="mt-2 pl-6">{children}</div>}
    </div>
  );
}

// 雙滑桿元件
function PriceRangeSlider({
  minValue,
  maxValue,
  onChange,
}: {
  minValue: number;
  maxValue: number;
  onChange: (min: number, max: number) => void;
}) {
  const [localMin, setLocalMin] = useState(minValue);
  const [localMax, setLocalMax] = useState(maxValue);

  const handleMinChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.min(Number(e.target.value), localMax - PRICE_STEP);
    setLocalMin(value);
  }, [localMax]);

  const handleMaxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(Number(e.target.value), localMin + PRICE_STEP);
    setLocalMax(value);
  }, [localMin]);

  const handleMouseUp = useCallback(() => {
    onChange(localMin, localMax);
  }, [localMin, localMax, onChange]);

  const minPercent = ((localMin - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)) * 100;
  const maxPercent = ((localMax - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)) * 100;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-[var(--primary)]">${localMin.toLocaleString()}</span>
        <span className="text-[var(--muted)]">至</span>
        <span className="font-medium text-[var(--primary)]">
          ${localMax >= PRICE_MAX ? '20,000+' : localMax.toLocaleString()}
        </span>
      </div>

      <div className="relative h-2">
        {/* Track background */}
        <div className="absolute inset-0 bg-gray-200 rounded-full" />

        {/* Active track */}
        <div
          className="absolute h-full bg-[var(--primary)] rounded-full"
          style={{
            left: `${minPercent}%`,
            width: `${maxPercent - minPercent}%`,
          }}
        />

        {/* Min slider */}
        <input
          type="range"
          min={PRICE_MIN}
          max={PRICE_MAX}
          step={PRICE_STEP}
          value={localMin}
          onChange={handleMinChange}
          onMouseUp={handleMouseUp}
          onTouchEnd={handleMouseUp}
          className="absolute w-full h-2 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[var(--primary)] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md"
        />

        {/* Max slider */}
        <input
          type="range"
          min={PRICE_MIN}
          max={PRICE_MAX}
          step={PRICE_STEP}
          value={localMax}
          onChange={handleMaxChange}
          onMouseUp={handleMouseUp}
          onTouchEnd={handleMouseUp}
          className="absolute w-full h-2 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[var(--primary)] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md"
        />
      </div>

      {/* Quick select buttons */}
      <div className="flex flex-wrap gap-1.5">
        {[
          { label: '5千以下', min: 0, max: 5000 },
          { label: '5千-1萬', min: 5000, max: 10000 },
          { label: '1萬以上', min: 10000, max: 20000 },
        ].map((preset) => (
          <button
            key={preset.label}
            onClick={() => {
              setLocalMin(preset.min);
              setLocalMax(preset.max);
              onChange(preset.min, preset.max);
            }}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              localMin === preset.min && localMax === preset.max
                ? 'bg-[var(--primary)] text-white'
                : 'bg-[var(--background)] border border-[var(--border)] hover:border-[var(--primary)]'
            }`}
          >
            {preset.label}
          </button>
        ))}
        <button
          onClick={() => {
            setLocalMin(PRICE_MIN);
            setLocalMax(PRICE_MAX);
            onChange(PRICE_MIN, PRICE_MAX);
          }}
          className="px-2 py-1 text-xs bg-[var(--background)] border border-[var(--border)] hover:border-[var(--primary)] rounded transition-colors"
        >
          重置
        </button>
      </div>
    </div>
  );
}

interface FilterSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FilterSidebar({ isOpen, onClose }: FilterSidebarProps) {
  const {
    filters,
    setFilters,
    resetFilters,
    sortBy,
    setSortBy,
    userLocation,
    isLoadingLocation,
    locationError,
    requestLocation,
    clearLocation,
  } = usePlanStore();

  const handlePriceRange = (min: number, max: number) => {
    setFilters({
      priceMin: min === PRICE_MIN ? undefined : min,
      priceMax: max === PRICE_MAX ? undefined : max,
    });
  };

  const handleServingRange = (min: number, max: number | undefined) => {
    if (filters.servingsMin === min && filters.servingsMax === max) {
      setFilters({ servingsMin: undefined, servingsMax: undefined });
    } else {
      setFilters({ servingsMin: min, servingsMax: max });
    }
  };

  const handleTagToggle = (tag: string) => {
    const currentTags = filters.tags || [];
    if (currentTags.includes(tag)) {
      setFilters({ tags: currentTags.filter((t) => t !== tag) });
    } else {
      setFilters({ tags: [...currentTags, tag] });
    }
  };

  // 根據選擇的地區取得可用城市
  const availableCities: TaiwanCity[] = filters.region && filters.region !== 'all' && filters.region !== 'nationwide'
    ? REGION_CITIES[filters.region]
    : [];

  // 根據選擇的城市取得可用行政區
  const availableDistricts: string[] = filters.city && filters.city !== 'all'
    ? CITY_DISTRICTS[filters.city] || []
    : [];

  const activeFilterCount = [
    filters.priceMin !== undefined || filters.priceMax !== undefined,
    filters.servingsMin !== undefined || filters.servingsMax !== undefined,
    (filters.shippingTypes?.length || 0) > 0,
    (filters.storageTypes?.length || 0) > 0,
    filters.shippingFee === 'free',
    filters.region && filters.region !== 'all',
    filters.city && filters.city !== 'all',
    filters.district && filters.district !== 'all',
    (filters.tags?.length || 0) > 0,
  ].filter(Boolean).length;

  const tagCount = filters.tags?.length || 0;

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-[var(--card-bg)] border-r-2 border-[#ffd700]/30 overflow-y-auto transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-[#c41e3a] flex items-center gap-2">
              <span className="text-xl">🎯</span>
              篩選條件
            </h2>
            <div className="flex items-center gap-2">
              {activeFilterCount > 0 && (
                <span className="px-2 py-0.5 text-xs bg-[var(--primary)] text-white rounded-full">
                  {activeFilterCount}
                </span>
              )}
              <button
                onClick={resetFilters}
                className="p-1.5 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                title="重置篩選"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors lg:hidden"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Sort */}
          <div className="mb-4 pb-4 border-b border-[var(--border)]">
            <label className="block text-sm font-medium mb-2">排序方式</label>
            <select
              value={sortBy}
              onChange={(e) => {
                const value = e.target.value as SortOption;
                // 如果選擇距離排序但沒有位置，先請求位置
                if (value === 'distance_asc' && !userLocation) {
                  requestLocation();
                }
                setSortBy(value);
              }}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.needsLocation && !userLocation && isLoadingLocation}>
                  {opt.label}
                  {opt.needsLocation && !userLocation && ' (需定位)'}
                </option>
              ))}
            </select>

            {/* Location button */}
            <div className="mt-3">
              {!userLocation ? (
                <button
                  onClick={requestLocation}
                  disabled={isLoadingLocation}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm hover:border-[var(--primary)] transition-colors disabled:opacity-50"
                >
                  {isLoadingLocation ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <MapPin className="w-4 h-4 text-[var(--primary)]" />
                  )}
                  <span>{isLoadingLocation ? '取得位置中...' : '啟用定位排序'}</span>
                </button>
              ) : (
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-sm">
                  <div className="flex items-center gap-2 text-green-700">
                    <MapPin className="w-4 h-4" />
                    <span>已取得位置</span>
                  </div>
                  <button
                    onClick={clearLocation}
                    className="text-xs text-green-600 hover:text-red-600"
                  >
                    清除
                  </button>
                </div>
              )}
              {locationError && (
                <p className="mt-1 text-xs text-red-500">{locationError}</p>
              )}
            </div>
          </div>

          {/* Price Range Slider */}
          <CollapsibleSection title="價格區間">
            <PriceRangeSlider
              minValue={filters.priceMin ?? PRICE_MIN}
              maxValue={filters.priceMax ?? PRICE_MAX}
              onChange={handlePriceRange}
            />
          </CollapsibleSection>

          {/* Servings */}
          <CollapsibleSection title="份量人數">
            <div className="space-y-2">
              {SERVING_RANGES.map((range) => (
                <label
                  key={range.label}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={filters.servingsMin === range.min && filters.servingsMax === range.max}
                    onChange={() => handleServingRange(range.min, range.max)}
                    className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                  />
                  <span className="text-sm">{range.label}</span>
                </label>
              ))}
            </div>
          </CollapsibleSection>

          {/* Shipping Type - 多選 */}
          <CollapsibleSection title="供應方式">
            <div className="space-y-2">
              {SHIPPING_OPTIONS.map((opt) => {
                const isSelected = filters.shippingTypes?.includes(opt.value) || false;
                return (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {
                        const current = filters.shippingTypes || [];
                        if (isSelected) {
                          setFilters({ shippingTypes: current.filter(t => t !== opt.value) });
                        } else {
                          setFilters({ shippingTypes: [...current, opt.value] });
                        }
                      }}
                      className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                    />
                    <span className="text-sm">{opt.label}</span>
                  </label>
                );
              })}
              {/* 免運篩選 */}
              <label className="flex items-center gap-2 cursor-pointer mt-3 pt-2 border-t border-[var(--border)]">
                <input
                  type="checkbox"
                  checked={filters.shippingFee === 'free'}
                  onChange={() => {
                    setFilters({ shippingFee: filters.shippingFee === 'free' ? undefined : 'free' });
                  }}
                  className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                />
                <span className="text-sm">只顯示免運</span>
              </label>
            </div>
          </CollapsibleSection>

          {/* Storage Type - 多選 */}
          <CollapsibleSection title="保存方式">
            <div className="space-y-2">
              {STORAGE_OPTIONS.map((opt) => {
                const isSelected = filters.storageTypes?.includes(opt.value) || false;
                return (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {
                        const current = filters.storageTypes || [];
                        if (isSelected) {
                          setFilters({ storageTypes: current.filter(t => t !== opt.value) });
                        } else {
                          setFilters({ storageTypes: [...current, opt.value] });
                        }
                      }}
                      className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                    />
                    <span className="text-sm">{opt.label}</span>
                  </label>
                );
              })}
            </div>
          </CollapsibleSection>

          {/* Region */}
          <CollapsibleSection title="地區">
            <div className="flex flex-wrap gap-2">
              {REGION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFilters({ region: opt.value, city: 'all' })}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                    (filters.region || 'all') === opt.value
                      ? 'bg-[var(--primary)] text-white'
                      : 'bg-[var(--background)] border border-[var(--border)] hover:border-[var(--primary)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* City filter (shows when region is selected) */}
            {availableCities.length > 0 && (
              <div className="mt-3 pt-3 border-t border-[var(--border)]">
                <p className="text-xs text-[var(--muted)] mb-2">縣市篩選</p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setFilters({ city: 'all', district: 'all' })}
                    className={`px-2 py-1 rounded text-xs transition-colors ${
                      !filters.city || filters.city === 'all'
                        ? 'bg-[var(--primary)] text-white'
                        : 'bg-[var(--background)] border border-[var(--border)] hover:border-[var(--primary)]'
                    }`}
                  >
                    全部
                  </button>
                  {availableCities.map((city) => (
                    <button
                      key={city}
                      onClick={() => setFilters({ city, district: 'all' })}
                      className={`px-2 py-1 rounded text-xs transition-colors ${
                        filters.city === city
                          ? 'bg-[var(--primary)] text-white'
                          : 'bg-[var(--background)] border border-[var(--border)] hover:border-[var(--primary)]'
                      }`}
                    >
                      {city}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* District filter (shows when city with districts is selected) */}
            {availableDistricts.length > 0 && (
              <div className="mt-3 pt-3 border-t border-[var(--border)]">
                <p className="text-xs text-[var(--muted)] mb-2">行政區篩選</p>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  <button
                    onClick={() => setFilters({ district: 'all' })}
                    className={`px-2 py-1 rounded text-xs transition-colors ${
                      !filters.district || filters.district === 'all'
                        ? 'bg-[var(--primary)] text-white'
                        : 'bg-[var(--background)] border border-[var(--border)] hover:border-[var(--primary)]'
                    }`}
                  >
                    全部
                  </button>
                  {availableDistricts.map((district) => (
                    <button
                      key={district}
                      onClick={() => setFilters({ district })}
                      className={`px-2 py-1 rounded text-xs transition-colors ${
                        filters.district === district
                          ? 'bg-[var(--primary)] text-white'
                          : 'bg-[var(--background)] border border-[var(--border)] hover:border-[var(--primary)]'
                      }`}
                    >
                      {district}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CollapsibleSection>


          {/* Tags with AND/OR logic */}
          <CollapsibleSection title="標籤" badge={tagCount}>
            {/* Tag logic toggle */}
            {tagCount >= 2 && (
              <div className="mb-3 p-2 bg-[var(--background)] rounded-lg">
                <p className="text-xs text-[var(--muted)] mb-2">條件邏輯</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFilters({ tagLogic: 'OR' })}
                    className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
                      (filters.tagLogic || 'OR') === 'OR'
                        ? 'bg-[var(--primary)] text-white'
                        : 'bg-white border border-[var(--border)]'
                    }`}
                  >
                    任一符合 (OR)
                  </button>
                  <button
                    onClick={() => setFilters({ tagLogic: 'AND' })}
                    className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
                      filters.tagLogic === 'AND'
                        ? 'bg-[var(--primary)] text-white'
                        : 'bg-white border border-[var(--border)]'
                    }`}
                  >
                    全部符合 (AND)
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {TAG_CATEGORIES.map((category, categoryIndex) => (
                <div key={category.label}>
                  <p className="text-xs text-[var(--muted)] mb-1.5 font-medium">{category.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {category.tags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => handleTagToggle(tag)}
                        className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                          filters.tags?.includes(tag)
                            ? 'bg-[var(--primary)] text-white'
                            : 'bg-[var(--background)] border border-[var(--border)] hover:border-[var(--primary)]'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                  {categoryIndex < TAG_CATEGORIES.length - 1 && (
                    <div className="mt-3 border-b border-[var(--border)]" />
                  )}
                </div>
              ))}
            </div>
          </CollapsibleSection>

        </div>
      </aside>
    </>
  );
}
