'use client';

import { useState, useMemo } from 'react';
import {
  X, Users, Wallet, Truck, Sparkles, ChevronRight, RotateCcw,
  MapPin, Calendar, Utensils, Heart, ChevronLeft, Check,
  Flame, Star, Clock, Gift
} from 'lucide-react';
import { usePlanStore } from '@/stores/planStore';
import type { Plan } from '@/types';

interface WizardStep {
  id: string;
  question: string;
  subtitle?: string;
  options: {
    label: string;
    emoji: string;
    value: string;
    description?: string;
  }[];
  allowSkip?: boolean;
}

const WIZARD_STEPS: WizardStep[] = [
  {
    id: 'scenario',
    question: '今年過年打算怎麼吃？',
    subtitle: '選擇最符合的情境',
    options: [
      { label: '在家圍爐', emoji: '🏠', value: 'home', description: '輕鬆在家享用' },
      { label: '送禮孝親', emoji: '🎁', value: 'gift', description: '送給長輩/親友' },
      { label: '公司尾牙', emoji: '🏢', value: 'company', description: '公司團體訂購' },
      { label: '還沒決定', emoji: '🤔', value: 'any', description: '先看看有什麼' },
    ],
  },
  {
    id: 'people',
    question: '大概幾個人一起吃？',
    options: [
      { label: '1-2人', emoji: '👫', value: 'couple', description: '兩人世界' },
      { label: '3-4人', emoji: '👨‍👩‍👧', value: 'small', description: '小家庭' },
      { label: '5-6人', emoji: '👨‍👩‍👧‍👦', value: 'medium', description: '一般家庭' },
      { label: '7-10人', emoji: '👨‍👩‍👧‍👦👴', value: 'large', description: '三代同堂' },
    ],
  },
  {
    id: 'budget',
    question: '預算大概多少？',
    subtitle: '含運費的總預算',
    options: [
      { label: '$2,000以下', emoji: '💰', value: 'budget', description: '平價實惠' },
      { label: '$2,000-5,000', emoji: '💵', value: 'mid', description: '豐盛划算' },
      { label: '$5,000-10,000', emoji: '💎', value: 'premium', description: '飯店等級' },
      { label: '不限預算', emoji: '👑', value: 'any', description: '品質優先' },
    ],
  },
  {
    id: 'style',
    question: '喜歡什麼口味風格？',
    subtitle: '可以之後再細篩',
    allowSkip: true,
    options: [
      { label: '傳統台菜', emoji: '🥢', value: 'taiwanese', description: '經典年味' },
      { label: '粵式港點', emoji: '🥟', value: 'cantonese', description: '廣東風味' },
      { label: '素食蔬食', emoji: '🥬', value: 'vegetarian', description: '健康清爽' },
      { label: '都可以', emoji: '😋', value: 'any', description: '什麼都吃' },
    ],
  },
  {
    id: 'delivery',
    question: '怎麼取餐最方便？',
    options: [
      { label: '宅配到家', emoji: '📦', value: 'delivery', description: '冷凍配送最省事' },
      { label: '自己去拿', emoji: '🚗', value: 'pickup', description: '現做熱騰騰' },
      { label: '都可以', emoji: '✨', value: 'any', description: '看哪個划算' },
    ],
  },
  {
    id: 'region',
    question: '你在哪個地區？',
    subtitle: '方便篩選可配送範圍',
    allowSkip: true,
    options: [
      { label: '北部', emoji: '🏙️', value: 'north', description: '台北/新北/桃園/基隆' },
      { label: '中部', emoji: '🌄', value: 'central', description: '台中/彰化/南投' },
      { label: '南部', emoji: '🌅', value: 'south', description: '高雄/台南/屏東' },
      { label: '全台都送', emoji: '🇹🇼', value: 'nationwide', description: '只看全台配送' },
    ],
  },
  {
    id: 'priority',
    question: '最後一題！最在意什麼？',
    subtitle: '我們會優先推薦',
    options: [
      { label: 'CP值要高', emoji: '🏆', value: 'value', description: '每人均價最划算' },
      { label: '品牌口碑', emoji: '⭐', value: 'brand', description: '大品牌有保障' },
      { label: '菜色豐富', emoji: '🍱', value: 'variety', description: '多道菜一次滿足' },
      { label: '快點送到', emoji: '⚡', value: 'fast', description: '還沒訂要快' },
    ],
  },
];

export default function QuickWizard() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [showResult, setShowResult] = useState(false);
  const { plans, setFilters, resetFilters, setSortBy } = usePlanStore();

  // 計算推薦結果
  const recommendations = useMemo(() => {
    if (!showResult) return null;

    let filtered = plans.filter(p => p.status === 'published');
    const sel = selections;

    // 人數篩選
    switch (sel.people) {
      case 'couple':
        filtered = filtered.filter(p => (p.servingsMax || p.servingsMin) <= 2);
        break;
      case 'small':
        filtered = filtered.filter(p => p.servingsMin <= 4 && (p.servingsMax || p.servingsMin) >= 2);
        break;
      case 'medium':
        filtered = filtered.filter(p => p.servingsMin <= 6 && (p.servingsMax || p.servingsMin) >= 4);
        break;
      case 'large':
        filtered = filtered.filter(p => (p.servingsMax || p.servingsMin) >= 6);
        break;
    }

    // 預算篩選
    switch (sel.budget) {
      case 'budget':
        filtered = filtered.filter(p => p.priceDiscount <= 2000);
        break;
      case 'mid':
        filtered = filtered.filter(p => p.priceDiscount >= 2000 && p.priceDiscount <= 5000);
        break;
      case 'premium':
        filtered = filtered.filter(p => p.priceDiscount >= 5000 && p.priceDiscount <= 10000);
        break;
    }

    // 風格篩選
    switch (sel.style) {
      case 'taiwanese':
        filtered = filtered.filter(p => p.cuisineStyle === 'taiwanese' || p.tags?.some(t => t.includes('台')));
        break;
      case 'cantonese':
        filtered = filtered.filter(p => p.cuisineStyle === 'cantonese' || p.tags?.some(t => t.includes('粵') || t.includes('港')));
        break;
      case 'vegetarian':
        filtered = filtered.filter(p => p.cuisineStyle === 'vegetarian' || p.tags?.some(t => t.includes('素')));
        break;
    }

    // 配送方式
    switch (sel.delivery) {
      case 'delivery':
        filtered = filtered.filter(p => p.shippingType === 'delivery' || p.shippingType === 'both');
        break;
      case 'pickup':
        filtered = filtered.filter(p => p.shippingType === 'pickup' || p.shippingType === 'both');
        break;
    }

    // 地區篩選
    if (sel.region && sel.region !== 'nationwide') {
      filtered = filtered.filter(p => p.region === sel.region || p.region === 'nationwide');
    }

    // 排序依據優先考量
    switch (sel.priority) {
      case 'value':
        filtered.sort((a, b) => (a.priceDiscount / a.servingsMin) - (b.priceDiscount / b.servingsMin));
        break;
      case 'brand':
        filtered.sort((a, b) => {
          const aScore = a.vendorType === 'hotel' ? 0 : a.vendorType === 'brand' ? 1 : 2;
          const bScore = b.vendorType === 'hotel' ? 0 : b.vendorType === 'brand' ? 1 : 2;
          return aScore - bScore;
        });
        break;
      case 'variety':
        filtered.sort((a, b) => (b.dishes?.length || 0) - (a.dishes?.length || 0));
        break;
      case 'fast':
        filtered.sort((a, b) => {
          if (!a.orderDeadline) return 1;
          if (!b.orderDeadline) return -1;
          return a.orderDeadline.localeCompare(b.orderDeadline);
        });
        break;
    }

    return {
      total: filtered.length,
      top5: filtered.slice(0, 5),
      avgPrice: filtered.length > 0
        ? Math.round(filtered.reduce((sum, p) => sum + p.priceDiscount, 0) / filtered.length)
        : 0,
      avgPricePerPerson: filtered.length > 0
        ? Math.round(filtered.reduce((sum, p) => sum + p.priceDiscount / p.servingsMin, 0) / filtered.length)
        : 0,
    };
  }, [showResult, selections, plans]);

  const handleSelect = (stepId: string, value: string) => {
    const newSelections = { ...selections, [stepId]: value };
    setSelections(newSelections);

    if (currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // 完成所有步驟，顯示結果
      setShowResult(true);
    }
  };

  const handleSkip = () => {
    if (currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setShowResult(true);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const applyFilters = () => {
    resetFilters();
    const sel = selections;

    const newFilters: Record<string, unknown> = {
      onlyPublished: true,
    };

    // 人數
    switch (sel.people) {
      case 'couple':
        newFilters.servingsMax = 2;
        break;
      case 'small':
        newFilters.servingsMax = 4;
        break;
      case 'medium':
        newFilters.servingsMin = 4;
        newFilters.servingsMax = 6;
        break;
      case 'large':
        newFilters.servingsMin = 6;
        break;
    }

    // 預算
    switch (sel.budget) {
      case 'budget':
        newFilters.priceMax = 2000;
        break;
      case 'mid':
        newFilters.priceMin = 2000;
        newFilters.priceMax = 5000;
        break;
      case 'premium':
        newFilters.priceMin = 5000;
        newFilters.priceMax = 10000;
        break;
    }

    // 風格
    switch (sel.style) {
      case 'taiwanese':
        newFilters.cuisineStyle = 'taiwanese';
        break;
      case 'cantonese':
        newFilters.cuisineStyle = 'cantonese';
        break;
      case 'vegetarian':
        newFilters.tags = ['素食', '全素', '蛋奶素', '蔬食'];
        newFilters.tagLogic = 'OR';
        break;
    }

    // 配送
    if (sel.delivery !== 'any') {
      newFilters.shippingType = sel.delivery;
    }

    // 地區
    if (sel.region && sel.region !== 'nationwide') {
      newFilters.region = sel.region;
    }

    // 排序
    switch (sel.priority) {
      case 'value':
        setSortBy('price_per_person_asc');
        break;
      case 'brand':
        setSortBy('vendor_asc');
        break;
      case 'fast':
        setSortBy('deadline_asc');
        break;
      default:
        setSortBy('price_asc');
    }

    setFilters(newFilters);
    handleClose();
  };

  const handleReset = () => {
    setCurrentStep(0);
    setSelections({});
    setShowResult(false);
  };

  const handleClose = () => {
    setIsOpen(false);
    setCurrentStep(0);
    setSelections({});
    setShowResult(false);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#c41e3a] to-[#e63946] text-white rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 font-medium"
      >
        <Sparkles className="w-5 h-5" />
        <span>快速找年菜</span>
      </button>
    );
  }

  const step = WIZARD_STEPS[currentStep];
  const progress = ((currentStep + 1) / WIZARD_STEPS.length) * 100;

  // 結果頁面
  if (showResult && recommendations) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-[var(--card-bg)] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
          {/* Header */}
          <div className="relative bg-gradient-to-r from-[#c41e3a] to-[#e63946] p-4 text-white">
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-1 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 mb-1">
              <Check className="w-6 h-6" />
              <h2 className="text-lg font-bold">找到了！</h2>
            </div>
            <p className="text-sm text-white/80">
              根據你的需求，我們找到 {recommendations.total} 款適合的年菜
            </p>
          </div>

          {/* Stats */}
          <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-b">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-[#c41e3a]">{recommendations.total}</div>
                <div className="text-xs text-gray-500">符合條件</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[#c41e3a]">${recommendations.avgPrice.toLocaleString()}</div>
                <div className="text-xs text-gray-500">平均價格</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[#c41e3a]">${recommendations.avgPricePerPerson}</div>
                <div className="text-xs text-gray-500">每人均價</div>
              </div>
            </div>
          </div>

          {/* Top Picks */}
          <div className="p-4 max-h-[300px] overflow-y-auto">
            <h3 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-1">
              <Star className="w-4 h-4 text-amber-500" />
              精選推薦 Top 5
            </h3>
            <div className="space-y-2">
              {recommendations.top5.map((plan, idx) => (
                <div
                  key={plan.id}
                  className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-100 hover:border-[#c41e3a]/30 transition-colors"
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-bold flex items-center justify-center">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{plan.vendorName}</div>
                    <div className="text-xs text-gray-500 truncate">{plan.title}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-[#c41e3a]">${plan.priceDiscount.toLocaleString()}</div>
                    <div className="text-xs text-gray-400">{plan.servingsMin}-{plan.servingsMax || plan.servingsMin}人</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 border-t bg-gray-50 flex gap-3">
            <button
              onClick={handleReset}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-white transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              重新選擇
            </button>
            <button
              onClick={applyFilters}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#c41e3a] to-[#e63946] text-white rounded-lg hover:opacity-90 transition-opacity font-medium"
            >
              查看全部 {recommendations.total} 款
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 問答步驟頁面
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-[var(--card-bg)] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-[#c41e3a] to-[#e63946] p-4 text-white">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-1 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-6 h-6" />
            <h2 className="text-lg font-bold">快速找年菜</h2>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 bg-white/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs mt-1 text-white/80">
            第 {currentStep + 1} 題，共 {WIZARD_STEPS.length} 題
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          <h3 className="text-xl font-bold text-[var(--foreground)] mb-1 text-center">
            {step.question}
          </h3>
          {step.subtitle && (
            <p className="text-sm text-[var(--muted)] text-center mb-6">{step.subtitle}</p>
          )}

          <div className="space-y-2">
            {step.options.map((option) => (
              <button
                key={option.value}
                onClick={() => handleSelect(step.id, option.value)}
                className={`w-full flex items-center gap-4 p-3.5 rounded-xl border-2 transition-all hover:scale-[1.01] ${
                  selections[step.id] === option.value
                    ? 'border-[#c41e3a] bg-red-50'
                    : 'border-[var(--border)] hover:border-[#c41e3a]/50 hover:bg-[var(--accent)]'
                }`}
              >
                <span className="text-2xl">{option.emoji}</span>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-[var(--foreground)]">{option.label}</div>
                  {option.description && (
                    <div className="text-xs text-[var(--muted)]">{option.description}</div>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-[var(--muted)]" />
              </button>
            ))}
          </div>

          {/* Navigation */}
          <div className="mt-5 flex items-center justify-between">
            {currentStep > 0 ? (
              <button
                onClick={handleBack}
                className="flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                上一題
              </button>
            ) : (
              <div />
            )}

            {step.allowSkip && (
              <button
                onClick={handleSkip}
                className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              >
                跳過此題 →
              </button>
            )}
          </div>
        </div>

        {/* Footer - Selected summary */}
        <div className="px-6 pb-4">
          <div className="flex items-center justify-center gap-3 text-xs text-[var(--muted)] flex-wrap">
            {selections.scenario && (
              <span className="px-2 py-1 bg-[var(--accent)] rounded-full">
                {WIZARD_STEPS[0].options.find(o => o.value === selections.scenario)?.emoji}
                {WIZARD_STEPS[0].options.find(o => o.value === selections.scenario)?.label}
              </span>
            )}
            {selections.people && (
              <span className="px-2 py-1 bg-[var(--accent)] rounded-full">
                {WIZARD_STEPS[1].options.find(o => o.value === selections.people)?.emoji}
                {WIZARD_STEPS[1].options.find(o => o.value === selections.people)?.label}
              </span>
            )}
            {selections.budget && (
              <span className="px-2 py-1 bg-[var(--accent)] rounded-full">
                {WIZARD_STEPS[2].options.find(o => o.value === selections.budget)?.emoji}
                {WIZARD_STEPS[2].options.find(o => o.value === selections.budget)?.label}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
