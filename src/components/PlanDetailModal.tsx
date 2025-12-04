'use client';

import { X, Heart, ExternalLink, Truck, Package, Users, MapPin, Tag, ChevronLeft, ChevronRight, Phone } from 'lucide-react';
import { useState } from 'react';
import type { Plan } from '@/types';
import { usePlanStore } from '@/stores/planStore';
import { REGION_LABELS } from '@/types';

interface PlanDetailModalProps {
  plan: Plan;
  onClose: () => void;
}

export default function PlanDetailModal({ plan, onClose }: PlanDetailModalProps) {
  const { favoriteIds, toggleFavorite, toggleComparison, comparisonIds } = usePlanStore();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const isFavorite = favoriteIds.includes(plan.id);
  const isInComparison = comparisonIds.includes(plan.id);

  // 取得電話（從取貨點）
  const pickupPhone = plan.pickupPoints?.[0]?.phone;
  // 取得地址（優先用 plan.address，否則用取貨點地址）
  const displayAddress = plan.address || plan.pickupPoints?.[0]?.address;

  // All images (main + additional)
  const allImages = [
    plan.imageUrl,
    ...(plan.images || []),
  ].filter(Boolean) as string[];

  const shippingLabels: Record<string, string> = {
    delivery: '宅配到府',
    pickup: '自取',
    both: '宅配/自取',
  };

  const storageLabels: Record<string, string> = {
    frozen: '冷凍',
    chilled: '冷藏',
    room_temp: '常溫',
    unknown: '未知',
  };

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % allImages.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className="bg-[var(--card-bg)] rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-bold text-[var(--foreground)]">{plan.title}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleFavorite(plan.id)}
              className={`p-2 rounded-lg transition-colors ${
                isFavorite
                  ? 'bg-red-100 text-red-500'
                  : 'bg-[var(--background)] text-[var(--secondary)] hover:text-red-500'
              }`}
            >
              <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-[var(--background)] text-[var(--secondary)] hover:text-[var(--foreground)]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Image Gallery */}
          {allImages.length > 0 && (
            <div className="relative bg-[var(--background)]">
              <img
                src={allImages[currentImageIndex]}
                alt={plan.title}
                className="w-full h-64 object-cover"
              />
              {allImages.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                    {allImages.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentImageIndex(idx)}
                        className={`w-2 h-2 rounded-full transition-colors ${
                          idx === currentImageIndex ? 'bg-white' : 'bg-white/50'
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="p-6 space-y-6">
            {/* Vendor and Price */}
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-[var(--muted)]">{plan.vendorName}</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-bold text-[var(--primary)]">
                    ${plan.priceDiscount.toLocaleString()}
                  </span>
                  {plan.priceOriginal && plan.priceOriginal > plan.priceDiscount && (
                    <span className="text-sm text-[var(--muted)] line-through">
                      ${plan.priceOriginal.toLocaleString()}
                    </span>
                  )}
                </div>
                {plan.shippingFee !== undefined && (
                  <p className="text-sm text-[var(--muted)] mt-1">
                    運費: {plan.shippingFee === 0 ? '免運' : `$${plan.shippingFee}`}
                  </p>
                )}
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-sm text-[var(--secondary)]">
                  <Users className="w-4 h-4" />
                  <span>
                    {plan.servingsMin}
                    {plan.servingsMax && plan.servingsMax !== plan.servingsMin
                      ? `~${plan.servingsMax}`
                      : ''} 人份
                  </span>
                </div>
                <p className="text-xs text-[var(--muted)] mt-1">
                  約 ${Math.round(plan.priceDiscount / plan.servingsMin).toLocaleString()}/人
                </p>
              </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-[var(--background)]">
                <Truck className="w-5 h-5 text-[var(--primary)]" />
                <div>
                  <p className="text-xs text-[var(--muted)]">配送方式</p>
                  <p className="text-sm font-medium">{shippingLabels[plan.shippingType]}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-[var(--background)]">
                <Package className="w-5 h-5 text-[var(--primary)]" />
                <div>
                  <p className="text-xs text-[var(--muted)]">保存方式</p>
                  <p className="text-sm font-medium">{storageLabels[plan.storageType]}</p>
                </div>
              </div>
              {plan.region && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-[var(--background)]">
                  <MapPin className="w-5 h-5 text-[var(--primary)]" />
                  <div>
                    <p className="text-xs text-[var(--muted)]">配送地區</p>
                    <p className="text-sm font-medium">
                      {REGION_LABELS[plan.region]}
                      {plan.city && ` - ${plan.city}`}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 地址 - 可點擊開啟 Google Maps */}
            {displayAddress && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(displayAddress)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 rounded-lg bg-[var(--background)] hover:bg-[var(--border)] transition-colors"
              >
                <MapPin className="w-5 h-5 text-[var(--primary)]" />
                <div className="flex-1">
                  <p className="text-xs text-[var(--muted)]">地址（點擊開啟地圖）</p>
                  <p className="text-sm font-medium text-[var(--primary)] underline decoration-dotted">{displayAddress}</p>
                </div>
                <ExternalLink className="w-4 h-4 text-[var(--muted)]" />
              </a>
            )}

            {/* 電話 - 可點擊撥打 */}
            {pickupPhone && (
              <a
                href={`tel:${pickupPhone}`}
                className="flex items-center gap-2 p-3 rounded-lg bg-[var(--background)] hover:bg-[var(--border)] transition-colors"
              >
                <Phone className="w-5 h-5 text-[var(--primary)]" />
                <div className="flex-1">
                  <p className="text-xs text-[var(--muted)]">電話（點擊撥打）</p>
                  <p className="text-sm font-medium text-[var(--primary)]">{pickupPhone}</p>
                </div>
              </a>
            )}

            {/* Description */}
            {plan.description && (
              <div>
                <h3 className="text-sm font-medium text-[var(--foreground)] mb-2">方案說明</h3>
                <p className="text-sm text-[var(--secondary)] whitespace-pre-wrap">
                  {plan.description}
                </p>
              </div>
            )}

            {/* Dishes */}
            {plan.dishes.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-[var(--foreground)] mb-2">
                  菜色內容 ({plan.dishes.length} 道)
                </h3>
                <ul className="grid grid-cols-2 gap-2">
                  {plan.dishes.map((dish, idx) => (
                    <li
                      key={idx}
                      className="flex items-center gap-2 text-sm text-[var(--secondary)] p-2 rounded bg-[var(--background)]"
                    >
                      <span className="w-5 h-5 flex items-center justify-center text-xs bg-[var(--primary)] text-white rounded-full">
                        {idx + 1}
                      </span>
                      {dish}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Tags */}
            {plan.tags.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-[var(--foreground)] mb-2">標籤</h3>
                <div className="flex flex-wrap gap-2">
                  {plan.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-[var(--background)] border border-[var(--border)] rounded-full"
                    >
                      <Tag className="w-3 h-3" />
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Allergens */}
            {plan.allergens && plan.allergens.length > 0 && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                <h3 className="text-sm font-medium text-amber-800 mb-1">過敏原警告</h3>
                <p className="text-sm text-amber-700">
                  含有: {plan.allergens.join('、')}
                </p>
              </div>
            )}

          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center gap-3 p-4 border-t border-[var(--border)] bg-[var(--background)]">
          <button
            onClick={() => toggleComparison(plan.id)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isInComparison
                ? 'bg-[var(--primary)] text-white'
                : 'bg-[var(--card-bg)] border border-[var(--border)] text-[var(--secondary)] hover:border-[var(--primary)]'
            }`}
          >
            {isInComparison ? '已加入比較' : '加入比較'}
          </button>
          {plan.sourceUrl && (
            <a
              href={plan.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              前往訂購
            </a>
          )}
        </div>
      </div>

      {/* Backdrop click to close */}
      <div className="absolute inset-0 -z-10" onClick={onClose} />
    </div>
  );
}
