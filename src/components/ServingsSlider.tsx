'use client';

import { useState, useEffect } from 'react';
import { Users } from 'lucide-react';
import { usePlanStore } from '@/stores/planStore';

interface ServingsSliderProps {
  className?: string;
}

export default function ServingsSlider({ className = '' }: ServingsSliderProps) {
  const { filters, setFilters } = usePlanStore();

  const MIN_SERVINGS = 1;
  const MAX_SERVINGS = 12;

  const [localMin, setLocalMin] = useState(filters.servingsMin || MIN_SERVINGS);
  const [localMax, setLocalMax] = useState(filters.servingsMax || MAX_SERVINGS);

  // 同步外部 filter 變化
  useEffect(() => {
    setLocalMin(filters.servingsMin || MIN_SERVINGS);
    setLocalMax(filters.servingsMax || MAX_SERVINGS);
  }, [filters.servingsMin, filters.servingsMax]);

  const handleMinChange = (value: number) => {
    const newMin = Math.min(value, localMax - 1);
    setLocalMin(newMin);
  };

  const handleMaxChange = (value: number) => {
    const newMax = Math.max(value, localMin + 1);
    setLocalMax(newMax);
  };

  const handleApply = () => {
    setFilters({
      servingsMin: localMin === MIN_SERVINGS ? undefined : localMin,
      servingsMax: localMax === MAX_SERVINGS ? undefined : localMax,
    });
  };

  const handleReset = () => {
    setLocalMin(MIN_SERVINGS);
    setLocalMax(MAX_SERVINGS);
    setFilters({ servingsMin: undefined, servingsMax: undefined });
  };

  const isFiltered = filters.servingsMin !== undefined || filters.servingsMax !== undefined;

  // 快速選擇
  const quickOptions = [
    { label: '小倆口', emoji: '👫', min: 1, max: 2 },
    { label: '小家庭', emoji: '👨‍👩‍👧', min: 3, max: 4 },
    { label: '中型聚餐', emoji: '👨‍👩‍👧‍👦', min: 5, max: 6 },
    { label: '大家族', emoji: '👨‍👩‍👧‍👦👴👵', min: 7, max: 12 },
  ];

  const getLabel = () => {
    if (localMin === localMax) return `${localMin} 人`;
    if (localMax >= MAX_SERVINGS) return `${localMin}+ 人`;
    return `${localMin} - ${localMax} 人`;
  };

  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-600" />
          <span className="font-medium text-gray-800">用餐人數</span>
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
      <div className="grid grid-cols-2 gap-2 mb-4">
        {quickOptions.map((option) => {
          const isActive = localMin === option.min && localMax === option.max;
          return (
            <button
              key={option.label}
              onClick={() => {
                setLocalMin(option.min);
                setLocalMax(option.max);
                setFilters({
                  servingsMin: option.min,
                  servingsMax: option.max >= MAX_SERVINGS ? undefined : option.max,
                });
              }}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span>{option.emoji}</span>
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>

      {/* 顯示目前範圍 */}
      <div className="text-center mb-4">
        <span className="text-lg font-bold text-gray-800">
          {getLabel()}
        </span>
      </div>

      {/* 雙滑桿 */}
      <div className="relative h-6 mb-4">
        {/* 軌道背景 */}
        <div className="absolute top-1/2 -translate-y-1/2 w-full h-2 bg-gray-200 rounded-full" />

        {/* 選中範圍 */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-2 bg-blue-500 rounded-full"
          style={{
            left: `${((localMin - MIN_SERVINGS) / (MAX_SERVINGS - MIN_SERVINGS)) * 100}%`,
            right: `${100 - ((localMax - MIN_SERVINGS) / (MAX_SERVINGS - MIN_SERVINGS)) * 100}%`,
          }}
        />

        {/* Min 滑桿 */}
        <input
          type="range"
          min={MIN_SERVINGS}
          max={MAX_SERVINGS}
          step={1}
          value={localMin}
          onChange={(e) => handleMinChange(Number(e.target.value))}
          onMouseUp={handleApply}
          onTouchEnd={handleApply}
          className="absolute w-full h-6 appearance-none bg-transparent cursor-pointer slider-thumb-blue"
        />

        {/* Max 滑桿 */}
        <input
          type="range"
          min={MIN_SERVINGS}
          max={MAX_SERVINGS}
          step={1}
          value={localMax}
          onChange={(e) => handleMaxChange(Number(e.target.value))}
          onMouseUp={handleApply}
          onTouchEnd={handleApply}
          className="absolute w-full h-6 appearance-none bg-transparent cursor-pointer slider-thumb-blue"
        />
      </div>

      {/* 人數標籤 */}
      <div className="flex justify-between text-xs text-gray-500">
        <span>{MIN_SERVINGS} 人</span>
        <span>{MAX_SERVINGS}+ 人</span>
      </div>

      <style jsx>{`
        .slider-thumb-blue::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          background: white;
          border: 3px solid #2563eb;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .slider-thumb-blue::-moz-range-thumb {
          width: 20px;
          height: 20px;
          background: white;
          border: 3px solid #2563eb;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
      `}</style>
    </div>
  );
}
