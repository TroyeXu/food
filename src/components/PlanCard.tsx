'use client';

import { useState } from 'react';
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
  Clock,
  ShoppingCart,
  ImageOff,
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
  const [imageError, setImageError] = useState(false);
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

  // 計算訂購截止日距今天數
  const getDeadlineInfo = () => {
    if (!plan.orderDeadline) return null;
    const deadline = new Date(plan.orderDeadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    deadline.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { text: '已截止', color: 'text-gray-400', urgent: false };
    if (diffDays === 0) return { text: '今天截止', color: 'text-red-600', urgent: true };
    if (diffDays <= 3) return { text: `剩 ${diffDays} 天`, color: 'text-red-500', urgent: true };
    if (diffDays <= 7) return { text: `剩 ${diffDays} 天`, color: 'text-orange-500', urgent: false };
    return { text: `${deadline.getMonth() + 1}/${deadline.getDate()} 前`, color: 'text-gray-500', urgent: false };
  };

  const deadlineInfo = getDeadlineInfo();

  // 根據 vendorType 取得預設圖示和背景
  const getDefaultImage = () => {
    const vendorType = plan.vendorType || 'other';
    const configs: Record<string, { emoji: string; bgClass: string; label: string }> = {
      hotel: { emoji: '🏨', bgClass: 'from-purple-100 to-pink-100', label: '飯店年菜' },
      restaurant: { emoji: '🍽️', bgClass: 'from-orange-100 to-red-100', label: '餐廳年菜' },
      brand: { emoji: '🎁', bgClass: 'from-blue-100 to-cyan-100', label: '品牌年菜' },
      vegetarian: { emoji: '🥬', bgClass: 'from-green-100 to-lime-100', label: '素食年菜' },
      convenience: { emoji: '🏪', bgClass: 'from-yellow-100 to-orange-100', label: '超商年菜' },
      hypermarket: { emoji: '🛒', bgClass: 'from-indigo-100 to-purple-100', label: '量販年菜' },
      other: { emoji: '🧧', bgClass: 'from-red-50 to-orange-50', label: '精選年菜' },
    };
    return configs[vendorType] || configs.other;
  };

  const defaultImage = getDefaultImage();

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

  // 取得配送方式（支援新舊欄位）
  const shippingTypes = (plan as { shippingTypes?: string[] }).shippingTypes ||
    (plan.shippingType === 'both' ? ['delivery', 'pickup'] : [plan.shippingType]);

  const getShippingIcon = () => {
    const icons = [];
    if (shippingTypes.includes('delivery')) {
      icons.push(<Truck key="delivery" className="w-4 h-4" />);
    }
    if (shippingTypes.includes('pickup')) {
      icons.push(<Store key="pickup" className="w-4 h-4" />);
    }
    if (shippingTypes.includes('convenience')) {
      icons.push(<Store key="convenience" className="w-4 h-4 text-green-500" />);
    }
    return icons.length > 0 ? <>{icons}</> : <Truck className="w-4 h-4" />;
  };

  const getShippingLabel = () => {
    const labels = [];
    if (shippingTypes.includes('delivery')) labels.push('宅配');
    if (shippingTypes.includes('pickup')) labels.push('自取');
    if (shippingTypes.includes('convenience')) labels.push('超取');
    return labels.length > 0 ? labels.join('/') : '宅配';
  };

  // 取得保存方式（支援新舊欄位）
  const storageTypes = (plan as { storageTypes?: string[] }).storageTypes ||
    (plan.storageType ? [plan.storageType] : []);

  const getStorageIcon = () => {
    if (storageTypes.includes('frozen')) {
      return <Snowflake className="w-4 h-4 text-blue-500" />;
    }
    if (storageTypes.includes('chilled')) {
      return <Thermometer className="w-4 h-4 text-cyan-500" />;
    }
    if (storageTypes.includes('room_temp')) {
      return <Thermometer className="w-4 h-4 text-orange-500" />;
    }
    return null;
  };

  const getStorageLabel = () => {
    const labels = [];
    if (storageTypes.includes('frozen')) labels.push('冷凍');
    if (storageTypes.includes('chilled')) labels.push('冷藏');
    if (storageTypes.includes('room_temp')) labels.push('常溫');
    return labels.length > 0 ? labels.join('/') : '';
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
      <div className={`relative h-40 bg-gradient-to-br ${defaultImage.bgClass} rounded-t-xl overflow-hidden`}>
        {plan.imageUrl && !imageError ? (
          <img
            src={plan.imageUrl}
            alt={plan.title}
            className="w-full h-full object-cover"
            onError={() => {
              setImageError(true);
            }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center relative">
            {/* 裝飾性背景圖案 */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-2 left-2 text-4xl">🧧</div>
              <div className="absolute bottom-2 right-2 text-4xl">🎊</div>
              <div className="absolute top-2 right-8 text-2xl">✨</div>
              <div className="absolute bottom-8 left-4 text-2xl">🎉</div>
            </div>
            {imageError ? (
              <>
                <ImageOff className="w-8 h-8 text-gray-400 mb-2 relative z-10" />
                <span className="text-sm font-medium text-gray-600 relative z-10">{plan.vendorName}</span>
                <span className="text-xs text-gray-400 mt-1 relative z-10">圖片載入失敗</span>
              </>
            ) : (
              <>
                <span className="text-5xl mb-2 relative z-10">{defaultImage.emoji}</span>
                <span className="text-sm font-medium text-gray-600 relative z-10">{plan.vendorName}</span>
                <span className="text-xs text-gray-400 mt-1 relative z-10">{defaultImage.label}</span>
              </>
            )}
          </div>
        )}

        {/* Status badge */}
        {editMode === 'edit' && (
          <div className="absolute top-2 left-2">{getStatusBadge()}</div>
        )}

        {/* Deadline badge - 左上角顯示截止日期 */}
        {deadlineInfo && deadlineInfo.urgent && editMode !== 'edit' && (
          <div className={`absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-white/95 shadow-md ${deadlineInfo.color}`}>
            <Clock className="w-3 h-3" />
            {deadlineInfo.text}
          </div>
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

          {/* 訂購按鈕或編輯按鈕 */}
          {editMode === 'edit' ? (
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
          ) : plan.sourceUrl ? (
            <a
              href={plan.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-[#c41e3a] to-[#ff6b6b] text-white text-xs font-medium rounded-lg hover:opacity-90 transition-opacity shadow-md"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              訂購
            </a>
          ) : null}
        </div>

        {/* 非緊急的截止日期顯示在底部 */}
        {deadlineInfo && !deadlineInfo.urgent && (
          <div className={`mt-2 flex items-center gap-1 text-xs ${deadlineInfo.color}`}>
            <Clock className="w-3 h-3" />
            <span>訂購截止：{deadlineInfo.text}</span>
          </div>
        )}

      </div>
    </div>
  );
}
