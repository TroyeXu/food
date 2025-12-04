'use client';

import {
  Truck,
  Store,
  Snowflake,
  Thermometer,
  Users,
  CheckSquare,
  Square,
  Edit3,
  Trash2,
  AlertCircle,
  FileWarning,
  MapPin,
  Heart,
  Phone,
  ExternalLink,
} from 'lucide-react';
import type { Plan } from '@/types';
import { REGION_LABELS } from '@/types';
import { usePlanStore } from '@/stores/planStore';

interface PlanCardProps {
  plan: Plan;
  onEdit?: (plan: Plan) => void;
  onViewDetail?: (plan: Plan) => void;
}

export default function PlanCard({ plan, onEdit, onViewDetail }: PlanCardProps) {
  const { comparisonIds, toggleComparison, editMode, deletePlan, favoriteIds, toggleFavorite, userLocation, getDistanceToPlan } = usePlanStore();

  // 計算距離
  const distance = userLocation ? getDistanceToPlan(plan) : null;

  const isSelected = comparisonIds.includes(plan.id);
  const canSelect = comparisonIds.length < 4 || isSelected;
  const isFavorite = favoriteIds.includes(plan.id);

  // 取得電話（從取貨點）
  const pickupPhone = plan.pickupPoints?.[0]?.phone;
  // 取得地址（優先用 plan.address，否則用取貨點地址）
  const displayAddress = plan.address || plan.pickupPoints?.[0]?.address;

  const pricePerPerson = Math.round(plan.priceDiscount / plan.servingsMin);
  const hasDiscount = plan.priceOriginal && plan.priceOriginal > plan.priceDiscount;

  const getStatusBadge = () => {
    switch (plan.status) {
      case 'draft':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
            <AlertCircle className="w-3 h-3" />
            草稿
          </span>
        );
      case 'needs_review':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full">
            <FileWarning className="w-3 h-3" />
            待校正
          </span>
        );
      case 'published':
        return null;
    }
  };

  const getShippingIcon = () => {
    switch (plan.shippingType) {
      case 'delivery':
        return <Truck className="w-4 h-4" />;
      case 'pickup':
        return <Store className="w-4 h-4" />;
      case 'both':
        return (
          <>
            <Truck className="w-4 h-4" />
            <Store className="w-4 h-4" />
          </>
        );
    }
  };

  const getShippingLabel = () => {
    switch (plan.shippingType) {
      case 'delivery':
        return '宅配';
      case 'pickup':
        return '自取';
      case 'both':
        return '宅配/自取';
    }
  };

  const getStorageIcon = () => {
    switch (plan.storageType) {
      case 'frozen':
        return <Snowflake className="w-4 h-4 text-blue-500" />;
      case 'chilled':
        return <Thermometer className="w-4 h-4 text-cyan-500" />;
      default:
        return null;
    }
  };

  const getStorageLabel = () => {
    switch (plan.storageType) {
      case 'frozen':
        return '冷凍';
      case 'chilled':
        return '冷藏';
      case 'room_temp':
        return '常溫';
      default:
        return '';
    }
  };

  const handleDelete = async () => {
    if (window.confirm(`確定要刪除「${plan.title}」嗎？`)) {
      await deletePlan(plan.id);
    }
  };

  return (
    <div
      className={`relative bg-[var(--card-bg)] rounded-xl border-2 transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1 ${
        isSelected ? 'border-[#ffd700] ring-2 ring-[#ffd700]/30 shadow-lg' : 'border-[var(--border)]'
      }`}
    >
      {/* Image */}
      <div className="relative h-40 bg-gray-100 rounded-t-xl overflow-hidden">
        {plan.imageUrl ? (
          <img
            src={plan.imageUrl}
            alt={plan.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[var(--muted)]">
            無圖片
          </div>
        )}

        {/* Status badge */}
        {editMode === 'edit' && (
          <div className="absolute top-2 left-2">{getStatusBadge()}</div>
        )}

        {/* 右上角按鈕組：收藏 + 比對 */}
        <div className="absolute top-2 right-2 flex items-center gap-1.5">
          {/* Favorite button */}
          <button
            onClick={(e) => { e.stopPropagation(); toggleFavorite(plan.id); }}
            className={`p-1.5 rounded-lg transition-all ${
              isFavorite
                ? 'bg-gradient-to-r from-pink-500 to-red-500 text-white shadow-lg scale-110'
                : 'bg-white/90 text-[var(--secondary)] hover:bg-white hover:scale-105'
            }`}
            title={isFavorite ? '取消收藏' : '加入收藏'}
          >
            <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
          </button>

          {/* Selection checkbox */}
          <button
            onClick={(e) => { e.stopPropagation(); toggleComparison(plan.id); }}
            disabled={!canSelect}
            className={`p-1.5 rounded-lg transition-all ${
              isSelected
                ? 'bg-gradient-to-r from-[#ffd700] to-[#ffed4a] text-[#8b4513] shadow-lg scale-110'
                : 'bg-white/90 text-[var(--secondary)] hover:bg-white hover:scale-105'
            } ${!canSelect ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={isSelected ? '移出比對' : '加入比對'}
          >
            {isSelected ? (
              <CheckSquare className="w-5 h-5" />
            ) : (
              <Square className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div
        className="p-4 cursor-pointer"
        onClick={() => onViewDetail?.(plan)}
      >
        {/* Vendor & Title */}
        <div className="mb-2">
          <p className="text-xs text-[var(--muted)] mb-0.5">{plan.vendorName}</p>
          <h3 className="font-semibold line-clamp-2">{plan.title}</h3>
        </div>

        {/* Tags */}
        {plan.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {plan.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 text-xs bg-gradient-to-r from-[#c41e3a]/10 to-[#ffd700]/10 text-[#c41e3a] border border-[#c41e3a]/20 rounded-full"
              >
                {tag}
              </span>
            ))}
            {plan.tags.length > 3 && (
              <span className="px-2 py-0.5 text-xs text-[var(--muted)]">
                +{plan.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
          {/* Servings */}
          <div className="flex items-center gap-1.5 text-[var(--secondary)]">
            <Users className="w-4 h-4" />
            <span>
              {plan.servingsMin}
              {plan.servingsMax && plan.servingsMax !== plan.servingsMin
                ? `-${plan.servingsMax}`
                : ''}{' '}
              人份
            </span>
          </div>

          {/* Shipping with fee */}
          <div className="flex items-center gap-1.5 text-[var(--secondary)]">
            {getShippingIcon()}
            <span>
              {getShippingLabel()}
              {plan.shippingFee !== undefined && (
                <span className={plan.shippingFee === 0 ? 'ml-1 text-[var(--success)] font-medium' : 'ml-1'}>
                  {plan.shippingFee === 0 ? '免運' : `+$${plan.shippingFee}`}
                </span>
              )}
            </span>
          </div>

          {/* Storage */}
          <div className="flex items-center gap-1.5 text-[var(--secondary)]">
            {getStorageIcon()}
            <span>{getStorageLabel()}</span>
          </div>

          {/* Dish count */}
          {plan.dishes.length > 0 && (
            <div className="flex items-center gap-1.5 text-[var(--secondary)]">
              <span className="text-base">🍽️</span>
              <span>{plan.dishes.length} 道菜</span>
            </div>
          )}

          {/* Location with distance - only show if no detailed address */}
          {!displayAddress && (plan.region || plan.city) && (
            <div className="flex items-center gap-1.5 text-[var(--secondary)]">
              <MapPin className="w-4 h-4" />
              <span className="truncate">
                {plan.city || (plan.region && REGION_LABELS[plan.region])}
                {distance !== null && (
                  <span className="ml-1 text-[var(--primary)] font-medium">
                    ({distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`})
                  </span>
                )}
              </span>
            </div>
          )}

        </div>

        {/* 地址 - 可點擊開啟 Google Maps */}
        {displayAddress && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(displayAddress)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 text-xs text-[var(--secondary)] hover:text-[var(--primary)] mb-2 transition-colors"
          >
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate underline decoration-dotted">{displayAddress}</span>
            {distance !== null && (
              <span className="text-[var(--primary)] font-medium flex-shrink-0">
                {distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`}
              </span>
            )}
            <ExternalLink className="w-3 h-3 flex-shrink-0" />
          </a>
        )}

        {/* 電話 - 可點擊撥打 */}
        {pickupPhone && (
          <a
            href={`tel:${pickupPhone}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 text-xs text-[var(--secondary)] hover:text-[var(--primary)] mb-3 transition-colors"
          >
            <Phone className="w-3.5 h-3.5" />
            <span className="underline decoration-dotted">{pickupPhone}</span>
          </a>
        )}

        {/* Price */}
        <div className="flex items-end justify-between">
          <div>
            {hasDiscount && (
              <span className="text-sm text-[var(--muted)] line-through mr-2">
                ${plan.priceOriginal?.toLocaleString()}
              </span>
            )}
            <span className="text-xl font-bold bg-gradient-to-r from-[#c41e3a] to-[#ff6b6b] bg-clip-text text-transparent">
              ${plan.priceDiscount.toLocaleString()}
            </span>
            <span className="text-xs text-[var(--secondary)] ml-1 bg-[#ffd700]/20 px-1.5 py-0.5 rounded font-medium">
              約 ${pricePerPerson}/人
            </span>
          </div>

          {/* Edit mode actions */}
          {editMode === 'edit' && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onEdit?.(plan)}
                className="p-1.5 text-[var(--muted)] hover:text-[var(--primary)] transition-colors"
                title="編輯"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                onClick={handleDelete}
                className="p-1.5 text-[var(--muted)] hover:text-[var(--danger)] transition-colors"
                title="刪除"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
