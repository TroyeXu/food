'use client';

import {
  Truck,
  Store,
  Snowflake,
  Thermometer,
  Users,
  CheckSquare,
  Square,
  Heart,
  MapPin,
  Phone,
} from 'lucide-react';
import type { Plan } from '@/types';
import { usePlanStore } from '@/stores/planStore';

interface PlanListItemProps {
  plan: Plan;
  onEdit?: (plan: Plan) => void;
  onViewDetail?: (plan: Plan) => void;
}

export default function PlanListItem({ plan, onViewDetail }: PlanListItemProps) {
  const { comparisonIds, toggleComparison, favoriteIds, toggleFavorite, userLocation, getDistanceToPlan } = usePlanStore();

  const distance = userLocation ? getDistanceToPlan(plan) : null;
  const isSelected = comparisonIds.includes(plan.id);
  const canSelect = comparisonIds.length < 4 || isSelected;
  const isFavorite = favoriteIds.includes(plan.id);

  const pickupPhone = plan.pickupPoints?.[0]?.phone;
  const displayAddress = plan.address || plan.pickupPoints?.[0]?.address;

  const pricePerPerson = Math.round(plan.priceDiscount / plan.servingsMin);
  const hasDiscount = plan.priceOriginal && plan.priceOriginal > plan.priceDiscount;

  const getShippingInfo = () => {
    const type = plan.shippingType === 'delivery' ? '宅配' : plan.shippingType === 'pickup' ? '自取' : '宅配/自取';
    const fee = plan.shippingFee === 0 ? '免運' : plan.shippingFee ? `運費$${plan.shippingFee}` : '';
    return fee ? `${type} ${fee}` : type;
  };

  const getStorageInfo = () => {
    return plan.storageType === 'frozen' ? '冷凍' : plan.storageType === 'chilled' ? '冷藏' : '常溫';
  };

  return (
    <div
      className={`flex items-center gap-2 sm:gap-3 bg-[var(--card-bg)] rounded-lg border p-2 sm:p-3 transition-all hover:shadow-md cursor-pointer w-full max-w-full overflow-hidden ${
        isSelected ? 'border-[#ffd700] bg-[#ffd700]/5' : 'border-[var(--border)]'
      }`}
      onClick={() => onViewDetail?.(plan)}
    >
      {/* 圖片 */}
      <div className="w-14 h-14 sm:w-20 sm:h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
        {plan.imageUrl ? (
          <img src={plan.imageUrl} alt={plan.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[var(--muted)] text-xs">無圖</div>
        )}
      </div>

      {/* 主要資訊 */}
      <div className="flex-1 min-w-0">
        {/* 標題行 */}
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-[var(--muted)] truncate">{plan.vendorName}</p>
            <h3 className="font-medium text-sm leading-tight line-clamp-1">{plan.title}</h3>
          </div>
        </div>

        {/* 資訊行 */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[10px] sm:text-xs text-[var(--secondary)]">
          <span className="flex items-center gap-0.5">
            <Users className="w-3 h-3" />
            {plan.servingsMin}{plan.servingsMax && plan.servingsMax !== plan.servingsMin ? `-${plan.servingsMax}` : ''}人
          </span>
          <span className="flex items-center gap-0.5">
            {plan.shippingType === 'delivery' ? <Truck className="w-3 h-3" /> : <Store className="w-3 h-3" />}
            {getShippingInfo()}
          </span>
          <span className="flex items-center gap-0.5">
            {plan.storageType === 'frozen' ? <Snowflake className="w-3 h-3 text-blue-500" /> : <Thermometer className="w-3 h-3 text-cyan-500" />}
            {getStorageInfo()}
          </span>
          {plan.dishes.length > 0 && <span>{plan.dishes.length}道菜</span>}
        </div>

        {/* 地址/電話行 */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[10px] text-[var(--muted)] overflow-hidden">
          {displayAddress && (
            <span className="flex items-center gap-0.5 min-w-0 max-w-full">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate max-w-[120px] sm:max-w-[180px]">{displayAddress}</span>
              {distance !== null && (
                <span className="text-[var(--primary)] font-medium ml-0.5 flex-shrink-0">
                  {distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`}
                </span>
              )}
            </span>
          )}
          {pickupPhone && (
            <a
              href={`tel:${pickupPhone}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-0.5 hover:text-[var(--primary)]"
            >
              <Phone className="w-3 h-3" />
              {pickupPhone}
            </a>
          )}
        </div>

        {/* 標籤 */}
        {plan.tags.length > 0 && (
          <div className="flex gap-1 mt-1">
            {plan.tags.slice(0, 2).map((tag) => (
              <span key={tag} className="px-1.5 py-0.5 text-[9px] bg-[#c41e3a]/10 text-[#c41e3a] rounded">
                {tag}
              </span>
            ))}
            {plan.tags.length > 2 && (
              <span className="text-[9px] text-[var(--muted)]">+{plan.tags.length - 2}</span>
            )}
          </div>
        )}
      </div>

      {/* 價格 + 操作按鈕 */}
      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0 pl-1 sm:pl-2 border-l border-[var(--border)]">
        {/* 價格 */}
        <div className="flex flex-col items-end">
          {hasDiscount && (
            <span className="text-[9px] sm:text-[10px] text-[var(--muted)] line-through">${plan.priceOriginal?.toLocaleString()}</span>
          )}
          <span className="text-sm sm:text-lg font-bold text-[#c41e3a]">${plan.priceDiscount.toLocaleString()}</span>
          <span className="text-[8px] sm:text-[9px] text-[var(--secondary)] bg-[#ffd700]/20 px-1 rounded">
            ${pricePerPerson}/人
          </span>
        </div>

        {/* 操作按鈕 */}
        <div className="flex flex-col gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); toggleFavorite(plan.id); }}
            className={`p-1.5 rounded-lg transition-all ${
              isFavorite
                ? 'bg-red-50 text-red-500'
                : 'bg-gray-50 text-gray-400 hover:text-red-400 hover:bg-red-50'
            }`}
            title={isFavorite ? '取消收藏' : '加入收藏'}
          >
            <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); toggleComparison(plan.id); }}
            disabled={!canSelect}
            className={`p-1.5 rounded-lg transition-all ${
              isSelected
                ? 'bg-[#ffd700]/20 text-[#ffd700]'
                : 'bg-gray-50 text-gray-400 hover:text-[#ffd700] hover:bg-[#ffd700]/10'
            } ${!canSelect ? 'opacity-30 cursor-not-allowed' : ''}`}
            title={isSelected ? '移出比對' : '加入比對'}
          >
            {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
