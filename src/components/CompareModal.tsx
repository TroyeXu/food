'use client';

import { useRef } from 'react';
import { X, Truck, Store, Snowflake, Thermometer, Calendar, Clock, Users, Check, Minus, MapPin, Printer, Share2, Trophy, Award } from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { usePlanStore } from '@/stores/planStore';
import { REGION_LABELS } from '@/types';
import type { Plan } from '@/types';

export default function CompareModal() {
  const { isCompareModalOpen, setCompareModalOpen, getComparisonPlans, comparisonIds } = usePlanStore();
  const printRef = useRef<HTMLDivElement>(null);

  const plans = getComparisonPlans();

  if (!isCompareModalOpen) {
    return null;
  }

  const getShippingLabel = (type: string) => {
    switch (type) {
      case 'delivery':
        return '宅配';
      case 'pickup':
        return '自取';
      case 'both':
        return '宅配/自取';
      default:
        return '-';
    }
  };

  const getStorageLabel = (type: string) => {
    switch (type) {
      case 'frozen':
        return '冷凍';
      case 'chilled':
        return '冷藏';
      case 'room_temp':
        return '常溫';
      default:
        return '-';
    }
  };

  // 計算各項最佳值
  const minPrice = Math.min(...plans.map((p) => p.priceDiscount));
  const minPricePerPerson = Math.min(
    ...plans.map((p) => Math.round(p.priceDiscount / p.servingsMin))
  );
  const maxServings = Math.max(...plans.map((p) => p.servingsMax || p.servingsMin));
  const minShippingFee = Math.min(...plans.map((p) => p.shippingFee ?? Infinity));
  const maxDiscount = Math.max(
    ...plans.map((p) => (p.priceOriginal ? p.priceOriginal - p.priceDiscount : 0))
  );
  const maxDishCount = Math.max(...plans.map((p) => p.dishes.length));

  // 計算每個方案的優勢數量
  const getAdvantages = (plan: Plan) => {
    const advantages: string[] = [];
    if (plan.priceDiscount === minPrice) advantages.push('最低價');
    if (Math.round(plan.priceDiscount / plan.servingsMin) === minPricePerPerson) advantages.push('最划算');
    if ((plan.servingsMax || plan.servingsMin) === maxServings && maxServings > 0) advantages.push('最大份量');
    if (plan.shippingFee === 0) advantages.push('免運費');
    if (plan.canSelectDate) advantages.push('可指定日期');
    if (plan.dishes.length === maxDishCount && maxDishCount > 0) advantages.push('菜色最多');
    if (plan.priceOriginal && plan.priceOriginal - plan.priceDiscount === maxDiscount && maxDiscount > 0) {
      advantages.push('折扣最多');
    }
    return advantages;
  };

  // 列印功能
  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>年菜比較表</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
            th { background-color: #f5f5f5; }
            .highlight { background-color: #e8f5e9; font-weight: bold; }
            .best-badge { display: inline-block; background: #4caf50; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin: 2px; }
            h1 { font-size: 18px; margin-bottom: 10px; }
            .date { color: #666; font-size: 12px; }
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <h1>年菜比較表</h1>
          <p class="date">產生時間：${new Date().toLocaleString('zh-TW')}</p>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // 分享功能
  const handleShare = async () => {
    const shareData = {
      title: '年菜比較',
      text: `我正在比較 ${plans.length} 個年菜方案：${plans.map(p => p.title).join('、')}`,
      url: `${window.location.origin}?compare=${comparisonIds.join(',')}`,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // 使用者取消分享
      }
    } else {
      // 複製連結到剪貼簿
      try {
        await navigator.clipboard.writeText(shareData.url);
        alert('比較連結已複製到剪貼簿！');
      } catch (err) {
        alert('無法複製連結');
      }
    }
  };

  const CompareRow = ({
    label,
    getValue,
    highlight,
    highlightClass = 'bg-green-50',
  }: {
    label: string;
    getValue: (plan: Plan) => React.ReactNode;
    highlight?: (plan: Plan) => boolean;
    highlightClass?: string;
  }) => (
    <tr className="border-b border-[var(--border)]">
      <td className="py-3 px-4 text-sm font-medium text-[var(--secondary)] bg-[var(--background)] whitespace-nowrap">
        {label}
      </td>
      {plans.map((plan) => {
        const isHighlighted = highlight?.(plan);
        return (
          <td
            key={plan.id}
            className={`py-3 px-4 text-sm relative ${
              isHighlighted ? `${highlightClass} font-semibold` : ''
            }`}
          >
            {isHighlighted && (
              <Trophy className="w-4 h-4 text-yellow-500 absolute top-2 right-2" />
            )}
            {getValue(plan)}
          </td>
        );
      })}
    </tr>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => setCompareModalOpen(false)}
      />

      {/* Modal */}
      <div className="relative bg-[var(--card-bg)] rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold">方案比較</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-[var(--background)] border border-[var(--border)] text-[var(--secondary)] hover:border-[var(--primary)] transition-colors"
              title="列印比較表"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">列印</span>
            </button>
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-[var(--background)] border border-[var(--border)] text-[var(--secondary)] hover:border-[var(--primary)] transition-colors"
              title="分享比較結果"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">分享</span>
            </button>
            <button
              onClick={() => setCompareModalOpen(false)}
              className="p-2 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-auto max-h-[calc(90vh-80px)]" ref={printRef}>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="py-3 px-4 text-left text-sm font-medium text-[var(--secondary)] bg-[var(--background)]">
                  項目
                </th>
                {plans.map((plan) => {
                  const advantages = getAdvantages(plan);
                  return (
                    <th key={plan.id} className="py-3 px-4 text-left min-w-[200px]">
                      <div className="flex items-start gap-3">
                        {plan.imageUrl && (
                          <img
                            src={plan.imageUrl}
                            alt={plan.title}
                            className="w-16 h-16 rounded-lg object-cover shrink-0"
                          />
                        )}
                        <div>
                          <p className="text-xs text-[var(--muted)]">{plan.vendorName}</p>
                          <p className="font-semibold line-clamp-2">{plan.title}</p>
                          {advantages.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {advantages.slice(0, 3).map((adv) => (
                                <span
                                  key={adv}
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded"
                                >
                                  <Award className="w-3 h-3" />
                                  {adv}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {/* Price */}
              <CompareRow
                label="價格"
                getValue={(plan) => (
                  <span className="text-lg font-bold text-[var(--primary)]">
                    ${plan.priceDiscount.toLocaleString()}
                  </span>
                )}
                highlight={(plan) => plan.priceDiscount === minPrice}
              />

              {/* Original Price & Discount */}
              <CompareRow
                label="原價/折扣"
                getValue={(plan) =>
                  plan.priceOriginal ? (
                    <div>
                      <span className="text-[var(--muted)] line-through">
                        ${plan.priceOriginal.toLocaleString()}
                      </span>
                      <span className="ml-2 text-red-500 text-sm">
                        -${(plan.priceOriginal - plan.priceDiscount).toLocaleString()}
                      </span>
                    </div>
                  ) : (
                    '-'
                  )
                }
                highlight={(plan) =>
                  plan.priceOriginal !== undefined &&
                  plan.priceOriginal - plan.priceDiscount === maxDiscount &&
                  maxDiscount > 0
                }
                highlightClass="bg-red-50"
              />

              {/* Shipping Fee */}
              <CompareRow
                label="運費"
                getValue={(plan) =>
                  plan.shippingFee !== undefined
                    ? plan.shippingFee === 0
                      ? <span className="text-green-600 font-medium">免運</span>
                      : `$${plan.shippingFee}`
                    : '-'
                }
                highlight={(plan) => plan.shippingFee === 0}
              />

              {/* Servings */}
              <CompareRow
                label="份量"
                getValue={(plan) => (
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4 text-[var(--muted)]" />
                    {plan.servingsMin}
                    {plan.servingsMax && plan.servingsMax !== plan.servingsMin
                      ? `-${plan.servingsMax}`
                      : ''}{' '}
                    人份
                  </span>
                )}
                highlight={(plan) =>
                  (plan.servingsMax || plan.servingsMin) === maxServings && maxServings > 0
                }
                highlightClass="bg-blue-50"
              />

              {/* Price Per Person */}
              <CompareRow
                label="單人價"
                getValue={(plan) => {
                  const perPerson = Math.round(plan.priceDiscount / plan.servingsMin);
                  return <span className="font-medium">${perPerson}</span>;
                }}
                highlight={(plan) =>
                  Math.round(plan.priceDiscount / plan.servingsMin) === minPricePerPerson
                }
              />

              {/* Shipping Type */}
              <CompareRow
                label="供應方式"
                getValue={(plan) => (
                  <span className="flex items-center gap-1">
                    {plan.shippingType === 'delivery' || plan.shippingType === 'both' ? (
                      <Truck className="w-4 h-4 text-[var(--muted)]" />
                    ) : null}
                    {plan.shippingType === 'pickup' || plan.shippingType === 'both' ? (
                      <Store className="w-4 h-4 text-[var(--muted)]" />
                    ) : null}
                    {getShippingLabel(plan.shippingType)}
                  </span>
                )}
                highlight={(plan) => plan.shippingType === 'both'}
                highlightClass="bg-purple-50"
              />

              {/* Storage Type */}
              <CompareRow
                label="保存方式"
                getValue={(plan) => (
                  <span className="flex items-center gap-1">
                    {plan.storageType === 'frozen' && <Snowflake className="w-4 h-4 text-blue-500" />}
                    {plan.storageType === 'chilled' && (
                      <Thermometer className="w-4 h-4 text-cyan-500" />
                    )}
                    {getStorageLabel(plan.storageType)}
                  </span>
                )}
              />

              {/* Location */}
              <CompareRow
                label="地區"
                getValue={(plan) => (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-[var(--muted)]" />
                    {plan.city || (plan.region && REGION_LABELS[plan.region]) || '-'}
                  </span>
                )}
              />

              {/* Order Deadline */}
              <CompareRow
                label="訂購截止"
                getValue={(plan) => {
                  if (!plan.orderDeadline) return '-';
                  const days = differenceInDays(parseISO(plan.orderDeadline), new Date());
                  return (
                    <span className={days <= 3 ? 'text-red-500 font-medium' : ''}>
                      {format(parseISO(plan.orderDeadline), 'M/d (EEE)', { locale: zhTW })}
                      {days >= 0 && (
                        <span className="text-xs ml-1">
                          ({days === 0 ? '今天' : `剩 ${days} 天`})
                        </span>
                      )}
                    </span>
                  );
                }}
              />

              {/* Fulfill Date */}
              <CompareRow
                label="到貨/取貨"
                getValue={(plan) => {
                  if (!plan.fulfillStart && !plan.fulfillEnd) return '-';
                  return (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4 text-[var(--muted)]" />
                      {plan.fulfillStart && format(parseISO(plan.fulfillStart), 'M/d', { locale: zhTW })}
                      {plan.fulfillStart && plan.fulfillEnd && ' - '}
                      {plan.fulfillEnd && format(parseISO(plan.fulfillEnd), 'M/d', { locale: zhTW })}
                    </span>
                  );
                }}
              />

              {/* Can Select Date */}
              <CompareRow
                label="可指定日期"
                getValue={(plan) =>
                  plan.canSelectDate ? (
                    <span className="flex items-center gap-1 text-green-600 font-medium">
                      <Check className="w-4 h-4" />是
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[var(--muted)]">
                      <Minus className="w-4 h-4" />否
                    </span>
                  )
                }
                highlight={(plan) => plan.canSelectDate === true}
              />

              {/* Tags */}
              <CompareRow
                label="標籤"
                getValue={(plan) => (
                  <div className="flex flex-wrap gap-1">
                    {plan.tags.length > 0
                      ? plan.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 text-xs bg-[var(--background)] text-[var(--secondary)] rounded-full"
                          >
                            {tag}
                          </span>
                        ))
                      : '-'}
                  </div>
                )}
              />

              {/* Dishes */}
              <CompareRow
                label="菜色"
                getValue={(plan) => (
                  <div className="text-sm max-h-32 overflow-y-auto">
                    {plan.dishes.length > 0 ? (
                      <>
                        <span className="text-xs text-[var(--muted)]">
                          共 {plan.dishes.length} 道
                        </span>
                        <ul className="list-disc list-inside space-y-0.5 mt-1">
                          {plan.dishes.map((dish, i) => (
                            <li key={i} className="text-[var(--secondary)]">
                              {dish}
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      '-'
                    )}
                  </div>
                )}
                highlight={(plan) => plan.dishes.length === maxDishCount && maxDishCount > 0}
                highlightClass="bg-orange-50"
              />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
