'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, ArrowUpDown } from 'lucide-react';
import { usePlanStore } from '@/stores/planStore';
import type { SortOption } from '@/types';

const SORT_OPTIONS: { value: SortOption; label: string; icon?: string }[] = [
  { value: 'price_asc', label: '價格低到高', icon: '💰' },
  { value: 'price_desc', label: '價格高到低', icon: '💎' },
  { value: 'price_per_person_asc', label: 'CP值最高', icon: '🏆' },
  { value: 'servings_asc', label: '人數少到多', icon: '👤' },
  { value: 'servings_desc', label: '人數多到少', icon: '👥' },
  { value: 'deadline_asc', label: '截止日期最近', icon: '⏰' },
  { value: 'vendor_asc', label: '廠商名稱 A-Z', icon: '🏪' },
  { value: 'updated_desc', label: '最近更新', icon: '🆕' },
];

interface SortDropdownProps {
  className?: string;
  compact?: boolean;
}

export default function SortDropdown({ className = '', compact = false }: SortDropdownProps) {
  const { sortBy, setSortBy } = usePlanStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentOption = SORT_OPTIONS.find(opt => opt.value === sortBy) || SORT_OPTIONS[0];

  // 點擊外部關閉
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (value: SortOption) => {
    setSortBy(value);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-all text-sm ${
          isOpen ? 'border-red-300 ring-2 ring-red-100' : ''
        }`}
      >
        <ArrowUpDown className="w-4 h-4 text-gray-500" />
        {!compact && (
          <>
            <span className="text-gray-600">排序：</span>
            <span className="font-medium text-gray-800">
              {currentOption.icon} {currentOption.label}
            </span>
          </>
        )}
        {compact && (
          <span className="font-medium text-gray-800">
            {currentOption.icon}
          </span>
        )}
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="py-1">
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => handleSelect(option.value)}
                className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left hover:bg-gray-50 transition-colors ${
                  sortBy === option.value ? 'bg-red-50 text-red-700' : 'text-gray-700'
                }`}
              >
                <span className="w-5 text-center">{option.icon}</span>
                <span className="flex-1">{option.label}</span>
                {sortBy === option.value && (
                  <Check className="w-4 h-4 text-red-600" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
