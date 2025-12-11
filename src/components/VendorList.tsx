'use client';

import { useState, useMemo } from 'react';
import {
  Building2,
  ChefHat,
  Store,
  ShoppingBag,
  Leaf,
  Package,
  ChevronRight,
  X,
  Search,
  Filter,
} from 'lucide-react';
import { usePlanStore } from '@/stores/planStore';
import type { VendorType } from '@/types';
import { VENDOR_TYPE_LABELS } from '@/types';

interface VendorListProps {
  isOpen: boolean;
  onClose: () => void;
}

const VENDOR_TYPE_ICONS: Record<VendorType, React.ReactNode> = {
  hotel: <Building2 className="w-4 h-4" />,
  restaurant: <ChefHat className="w-4 h-4" />,
  brand: <Package className="w-4 h-4" />,
  convenience: <Store className="w-4 h-4" />,
  hypermarket: <ShoppingBag className="w-4 h-4" />,
  vegetarian: <Leaf className="w-4 h-4" />,
  other: <Package className="w-4 h-4" />,
};

const VENDOR_TYPE_COLORS: Record<VendorType, string> = {
  hotel: 'bg-purple-100 text-purple-700 border-purple-200',
  restaurant: 'bg-orange-100 text-orange-700 border-orange-200',
  brand: 'bg-blue-100 text-blue-700 border-blue-200',
  convenience: 'bg-green-100 text-green-700 border-green-200',
  hypermarket: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  vegetarian: 'bg-lime-100 text-lime-700 border-lime-200',
  other: 'bg-gray-100 text-gray-700 border-gray-200',
};

export default function VendorList({ isOpen, onClose }: VendorListProps) {
  const { plans, setFilters, resetFilters } = usePlanStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<VendorType | 'all'>('all');

  // 計算每個廠商的方案數量
  const vendorStats = useMemo(() => {
    const publishedPlans = plans.filter(p => p.status === 'published');
    const vendorMap = new Map<string, {
      name: string;
      type: VendorType;
      count: number;
      minPrice: number;
      maxPrice: number;
    }>();

    for (const plan of publishedPlans) {
      const existing = vendorMap.get(plan.vendorName);
      if (existing) {
        existing.count++;
        existing.minPrice = Math.min(existing.minPrice, plan.priceDiscount);
        existing.maxPrice = Math.max(existing.maxPrice, plan.priceDiscount);
      } else {
        vendorMap.set(plan.vendorName, {
          name: plan.vendorName,
          type: plan.vendorType || 'other',
          count: 1,
          minPrice: plan.priceDiscount,
          maxPrice: plan.priceDiscount,
        });
      }
    }

    return Array.from(vendorMap.values()).sort((a, b) => b.count - a.count);
  }, [plans]);

  // 按類型分組統計
  const typeStats = useMemo(() => {
    const stats: Record<VendorType, number> = {
      hotel: 0,
      restaurant: 0,
      brand: 0,
      convenience: 0,
      hypermarket: 0,
      vegetarian: 0,
      other: 0,
    };

    for (const vendor of vendorStats) {
      stats[vendor.type]++;
    }

    return stats;
  }, [vendorStats]);

  // 篩選後的廠商
  const filteredVendors = useMemo(() => {
    let result = vendorStats;

    if (selectedType !== 'all') {
      result = result.filter(v => v.type === selectedType);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(v => v.name.toLowerCase().includes(query));
    }

    return result;
  }, [vendorStats, selectedType, searchQuery]);

  const handleVendorClick = (vendorName: string) => {
    resetFilters();
    setFilters({ searchQuery: vendorName, onlyPublished: true });
    onClose();
  };

  const handleTypeClick = (type: VendorType) => {
    resetFilters();
    setFilters({ vendorType: type, onlyPublished: true });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-red-50 to-orange-50">
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5 text-red-600" />
            <h2 className="text-lg font-bold text-gray-800">廠商總覽</h2>
            <span className="text-sm text-gray-500">
              ({vendorStats.length} 家廠商)
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 類型快速篩選 */}
        <div className="p-4 border-b bg-gray-50">
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedType('all')}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                selectedType === 'all'
                  ? 'bg-red-600 text-white'
                  : 'bg-white text-gray-600 border hover:bg-gray-50'
              }`}
            >
              全部 ({vendorStats.length})
            </button>
            {(Object.keys(typeStats) as VendorType[])
              .filter(type => typeStats[type] > 0)
              .map(type => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type === selectedType ? 'all' : type)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    selectedType === type
                      ? 'bg-red-600 text-white'
                      : `${VENDOR_TYPE_COLORS[type]} border`
                  }`}
                >
                  {VENDOR_TYPE_ICONS[type]}
                  <span>{VENDOR_TYPE_LABELS[type]}</span>
                  <span className="opacity-70">({typeStats[type]})</span>
                </button>
              ))}
          </div>

          {/* 搜尋欄 */}
          <div className="mt-3 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜尋廠商名稱..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>
        </div>

        {/* 廠商列表 */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredVendors.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              沒有找到符合條件的廠商
            </div>
          ) : (
            <div className="grid gap-2">
              {filteredVendors.map((vendor) => (
                <button
                  key={vendor.name}
                  onClick={() => handleVendorClick(vendor.name)}
                  className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl hover:border-red-300 hover:bg-red-50 transition-all text-left group"
                >
                  {/* 類型圖示 */}
                  <div className={`p-2 rounded-lg ${VENDOR_TYPE_COLORS[vendor.type]}`}>
                    {VENDOR_TYPE_ICONS[vendor.type]}
                  </div>

                  {/* 廠商資訊 */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-800 truncate">
                      {vendor.name}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {vendor.count} 個方案 ·
                      ${vendor.minPrice.toLocaleString()}
                      {vendor.minPrice !== vendor.maxPrice && (
                        <> ~ ${vendor.maxPrice.toLocaleString()}</>
                      )}
                    </div>
                  </div>

                  {/* 方案數量 badge */}
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                      {vendor.count} 款
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-red-500 transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer - 類型快捷入口 */}
        <div className="p-4 border-t bg-gray-50">
          <div className="text-xs text-gray-500 mb-2">快速篩選類型：</div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(typeStats) as VendorType[])
              .filter(type => typeStats[type] > 0)
              .map(type => (
                <button
                  key={type}
                  onClick={() => handleTypeClick(type)}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${VENDOR_TYPE_COLORS[type]} border hover:opacity-80 transition-opacity`}
                >
                  {VENDOR_TYPE_ICONS[type]}
                  <span>看所有{VENDOR_TYPE_LABELS[type]}</span>
                </button>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
