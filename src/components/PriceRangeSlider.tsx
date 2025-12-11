'use client';

import { useState, useEffect, useMemo } from 'react';
import { DollarSign } from 'lucide-react';
import { usePlanStore } from '@/stores/planStore';

interface PriceRangeSliderProps {
  className?: string;
}

export default function PriceRangeSlider({ className = '' }: PriceRangeSliderProps) {
  const { plans, filters, setFilters } = usePlanStore();

  // 計算價格範圍
  const priceRange = useMemo(() => {
    const publishedPlans = plans.filter(p => p.status === 'published');
    if (publishedPlans.length === 0) return { min: 0, max: 20000 };

    const prices = publishedPlans.map(p => p.priceDiscount);
    return {
      min: Math.floor(Math.min(...prices) / 100) * 100,
      max: Math.ceil(Math.max(...prices) / 100) * 100,
    };
  }, [plans]);

  const [localMin, setLocalMin] = useState(filters.priceMin || priceRange.min);
  const [localMax, setLocalMax] = useState(filters.priceMax || priceRange.max);

  // 同步外部 filter 變化
  useEffect(() => {
    setLocalMin(filters.priceMin || priceRange.min);
    setLocalMax(filters.priceMax || priceRange.max);
  }, [filters.priceMin, filters.priceMax, priceRange]);

  const handleMinChange = (value: number) => {
    const newMin = Math.min(value, localMax - 500);
    setLocalMin(newMin);
  };

  const handleMaxChange = (value: number) => {
    const newMax = Math.max(value, localMin + 500);
    setLocalMax(newMax);
  };

  const handleApply = () => {
    setFilters({
      priceMin: localMin === priceRange.min ? undefined : localMin,
      priceMax: localMax === priceRange.max ? undefined : localMax,
    });
  };

  const handleReset = () => {
    setLocalMin(priceRange.min);
    setLocalMax(priceRange.max);
    setFilters({ priceMin: undefined, priceMax: undefined });
  };

  const isFiltered = filters.priceMin !== undefined || filters.priceMax !== undefined;

  // 快速選擇
  const quickRanges = [
    { label: '平價', min: 0, max: 2000 },
    { label: '中價', min: 2000, max: 5000 },
    { label: '高價', min: 5000, max: 10000 },
    { label: '頂級', min: 10000, max: priceRange.max },
  ];

  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-green-600" />
          <span className="font-medium text-gray-800">價格範圍</span>
        </div>
        {isFiltered && (
          <button
            onClick={handleReset}
            className="text-xs text-red-600 hover:text-red-700"
          >
            清除
          </button>
        )}
      </div>

      {/* 快速選擇按鈕 */}
      <div className="flex flex-wrap gap-2 mb-4">
        {quickRanges.map((range) => {
          const isActive = localMin === range.min && localMax === range.max;
          return (
            <button
              key={range.label}
              onClick={() => {
                setLocalMin(range.min);
                setLocalMax(range.max);
                setFilters({ priceMin: range.min || undefined, priceMax: range.max });
              }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                isActive
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {range.label}
            </button>
          );
        })}
      </div>

      {/* 顯示目前範圍 */}
      <div className="text-center mb-4">
        <span className="text-lg font-bold text-gray-800">
          ${localMin.toLocaleString()} - ${localMax.toLocaleString()}
        </span>
      </div>

      {/* 雙滑桿 */}
      <div className="relative h-6 mb-4">
        {/* 軌道背景 */}
        <div className="absolute top-1/2 -translate-y-1/2 w-full h-2 bg-gray-200 rounded-full" />

        {/* 選中範圍 */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-2 bg-green-500 rounded-full"
          style={{
            left: `${((localMin - priceRange.min) / (priceRange.max - priceRange.min)) * 100}%`,
            right: `${100 - ((localMax - priceRange.min) / (priceRange.max - priceRange.min)) * 100}%`,
          }}
        />

        {/* Min 滑桿 */}
        <input
          type="range"
          min={priceRange.min}
          max={priceRange.max}
          step={500}
          value={localMin}
          onChange={(e) => handleMinChange(Number(e.target.value))}
          onMouseUp={handleApply}
          onTouchEnd={handleApply}
          className="absolute w-full h-6 appearance-none bg-transparent cursor-pointer slider-thumb"
        />

        {/* Max 滑桿 */}
        <input
          type="range"
          min={priceRange.min}
          max={priceRange.max}
          step={500}
          value={localMax}
          onChange={(e) => handleMaxChange(Number(e.target.value))}
          onMouseUp={handleApply}
          onTouchEnd={handleApply}
          className="absolute w-full h-6 appearance-none bg-transparent cursor-pointer slider-thumb"
        />
      </div>

      {/* 範圍標籤 */}
      <div className="flex justify-between text-xs text-gray-500">
        <span>${priceRange.min.toLocaleString()}</span>
        <span>${priceRange.max.toLocaleString()}</span>
      </div>

      <style jsx>{`
        .slider-thumb::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          background: white;
          border: 3px solid #16a34a;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .slider-thumb::-moz-range-thumb {
          width: 20px;
          height: 20px;
          background: white;
          border: 3px solid #16a34a;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
      `}</style>
    </div>
  );
}
