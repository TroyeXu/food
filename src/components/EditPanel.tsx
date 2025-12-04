'use client';

import { useState, useEffect } from 'react';
import { X, Save, Check, AlertCircle, FileWarning, Trash2, Plus, Minus } from 'lucide-react';
import type { Plan, ShippingType, StorageType, PlanStatus, TaiwanRegion, TaiwanCity } from '@/types';
import { REGION_LABELS, REGION_CITIES } from '@/types';
import { usePlanStore } from '@/stores/planStore';

const ALL_CITIES: TaiwanCity[] = [
  '台北市', '新北市', '基隆市', '桃園市', '新竹市', '新竹縣', '宜蘭縣',
  '苗栗縣', '台中市', '彰化縣', '南投縣', '雲林縣',
  '嘉義市', '嘉義縣', '台南市', '高雄市', '屏東縣',
  '花蓮縣', '台東縣',
  '澎湖縣', '金門縣', '連江縣',
];

interface EditPanelProps {
  plan: Plan | null;
  onClose: () => void;
  isNew?: boolean;
}

const EMPTY_PLAN: Omit<Plan, 'id' | 'createdAt' | 'updatedAt'> = {
  vendorId: '',
  vendorName: '',
  title: '',
  priceDiscount: 0,
  shippingType: 'delivery',
  storageType: 'frozen',
  servingsMin: 4,
  tags: [],
  dishes: [],
  status: 'draft',
};

const TAG_SUGGESTIONS = [
  '台式',
  '粵式',
  '日式',
  '西式',
  '海鮮',
  '蔬食',
  '素食',
  '佛跳牆',
  '烏魚子',
  '含酒',
  '不含酒',
  '無甲殼類',
  '有機',
];

export default function EditPanel({ plan, onClose, isNew = false }: EditPanelProps) {
  const { addPlan, updatePlan } = usePlanStore();

  const [formData, setFormData] = useState<Omit<Plan, 'id' | 'createdAt' | 'updatedAt'>>(
    plan ? { ...plan } : { ...EMPTY_PLAN }
  );
  const [newDish, setNewDish] = useState('');
  const [newTag, setNewTag] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (plan) {
      setFormData({ ...plan });
    } else {
      setFormData({ ...EMPTY_PLAN });
    }
  }, [plan]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.vendorName.trim()) {
      newErrors.vendorName = '請輸入餐廳/品牌名稱';
    }
    if (!formData.title.trim()) {
      newErrors.title = '請輸入方案名稱';
    }
    if (formData.priceDiscount <= 0) {
      newErrors.priceDiscount = '請輸入有效價格';
    }
    if (formData.servingsMin <= 0) {
      newErrors.servingsMin = '請輸入有效份量';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const canPublish = (): boolean => {
    return !!(
      formData.vendorName.trim() &&
      formData.title.trim() &&
      formData.priceDiscount > 0 &&
      formData.servingsMin > 0 &&
      (formData.orderDeadline || formData.fulfillStart || formData.fulfillEnd)
    );
  };

  const handleSave = async (newStatus?: PlanStatus) => {
    if (!validate()) return;

    setIsSaving(true);
    try {
      const dataToSave = {
        ...formData,
        status: newStatus || formData.status,
        vendorId: formData.vendorId || crypto.randomUUID(),
      };

      if (isNew || !plan) {
        await addPlan(dataToSave);
      } else {
        await updatePlan(plan.id, dataToSave);
      }
      onClose();
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddDish = () => {
    if (newDish.trim()) {
      setFormData((prev) => ({
        ...prev,
        dishes: [...prev.dishes, newDish.trim()],
      }));
      setNewDish('');
    }
  };

  const handleRemoveDish = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      dishes: prev.dishes.filter((_, i) => i !== index),
    }));
  };

  const handleToggleTag = (tag: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter((t) => t !== tag)
        : [...prev.tags, tag],
    }));
  };

  const handleAddCustomTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()],
      }));
      setNewTag('');
    }
  };

  if (!plan && !isNew) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="relative ml-auto w-full max-w-2xl bg-[var(--card-bg)] h-full overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-[var(--card-bg)] border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold">
            {isNew ? '新增年菜方案' : '編輯方案'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <section>
            <h3 className="text-sm font-medium mb-3 text-[var(--secondary)]">基本資訊</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  餐廳/品牌名稱 <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="text"
                  value={formData.vendorName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, vendorName: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-lg border bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${
                    errors.vendorName ? 'border-[var(--danger)]' : 'border-[var(--border)]'
                  }`}
                  placeholder="例：飯店名稱、餐廳名稱"
                />
                {errors.vendorName && (
                  <p className="text-xs text-[var(--danger)] mt-1">{errors.vendorName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  方案名稱 <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-lg border bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${
                    errors.title ? 'border-[var(--danger)]' : 'border-[var(--border)]'
                  }`}
                  placeholder="例：豪華年菜組、經典團圓宴"
                />
                {errors.title && (
                  <p className="text-xs text-[var(--danger)] mt-1">{errors.title}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">方案描述</label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  placeholder="方案的簡短描述..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">圖片網址</label>
                <input
                  type="url"
                  value={formData.imageUrl || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, imageUrl: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">來源網址</label>
                <input
                  type="url"
                  value={formData.sourceUrl || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, sourceUrl: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  placeholder="https://..."
                />
              </div>
            </div>
          </section>

          {/* Price */}
          <section>
            <h3 className="text-sm font-medium mb-3 text-[var(--secondary)]">價格</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  售價 <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="number"
                  value={formData.priceDiscount || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, priceDiscount: Number(e.target.value) }))
                  }
                  className={`w-full px-3 py-2 rounded-lg border bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${
                    errors.priceDiscount ? 'border-[var(--danger)]' : 'border-[var(--border)]'
                  }`}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">原價</label>
                <input
                  type="number"
                  value={formData.priceOriginal || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      priceOriginal: e.target.value ? Number(e.target.value) : undefined,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">運費</label>
                <input
                  type="number"
                  value={formData.shippingFee ?? ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      shippingFee: e.target.value ? Number(e.target.value) : undefined,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  placeholder="0 = 免運"
                />
              </div>
            </div>
          </section>

          {/* Servings */}
          <section>
            <h3 className="text-sm font-medium mb-3 text-[var(--secondary)]">份量</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  最少人數 <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="number"
                  value={formData.servingsMin || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, servingsMin: Number(e.target.value) }))
                  }
                  className={`w-full px-3 py-2 rounded-lg border bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${
                    errors.servingsMin ? 'border-[var(--danger)]' : 'border-[var(--border)]'
                  }`}
                  placeholder="4"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">最多人數</label>
                <input
                  type="number"
                  value={formData.servingsMax || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      servingsMax: e.target.value ? Number(e.target.value) : undefined,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  placeholder="6"
                />
              </div>
            </div>
          </section>

          {/* Location */}
          <section>
            <h3 className="text-sm font-medium mb-3 text-[var(--secondary)]">地點</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">地區</label>
                <select
                  value={formData.region || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      region: (e.target.value || undefined) as TaiwanRegion | undefined,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                >
                  <option value="">請選擇</option>
                  <option value="north">北部</option>
                  <option value="central">中部</option>
                  <option value="south">南部</option>
                  <option value="east">東部</option>
                  <option value="islands">離島</option>
                  <option value="nationwide">全台配送</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">縣市</label>
                <select
                  value={formData.city || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      city: (e.target.value || undefined) as TaiwanCity | undefined,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                >
                  <option value="">請選擇</option>
                  {ALL_CITIES.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium mb-1">詳細地址</label>
              <input
                type="text"
                value={formData.address || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                placeholder="餐廳或取貨點地址"
              />
            </div>
          </section>

          {/* Shipping & Storage */}
          <section>
            <h3 className="text-sm font-medium mb-3 text-[var(--secondary)]">配送與保存</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">供應方式</label>
                <select
                  value={formData.shippingType}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      shippingType: e.target.value as ShippingType,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                >
                  <option value="delivery">宅配</option>
                  <option value="pickup">自取</option>
                  <option value="both">宅配/自取皆可</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">保存方式</label>
                <select
                  value={formData.storageType}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      storageType: e.target.value as StorageType,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                >
                  <option value="frozen">冷凍</option>
                  <option value="chilled">冷藏</option>
                  <option value="room_temp">常溫</option>
                  <option value="unknown">未知</option>
                </select>
              </div>
            </div>
          </section>

          {/* Dates */}
          <section>
            <h3 className="text-sm font-medium mb-3 text-[var(--secondary)]">日期</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">訂購截止日</label>
                <input
                  type="date"
                  value={formData.orderDeadline || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      orderDeadline: e.target.value || undefined,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">到貨/取貨開始</label>
                  <input
                    type="date"
                    value={formData.fulfillStart || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        fulfillStart: e.target.value || undefined,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">到貨/取貨結束</label>
                  <input
                    type="date"
                    value={formData.fulfillEnd || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        fulfillEnd: e.target.value || undefined,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.canSelectDate || false}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, canSelectDate: e.target.checked }))
                  }
                  className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                />
                <span className="text-sm">可指定到貨日</span>
              </label>
            </div>
          </section>

          {/* Tags */}
          <section>
            <h3 className="text-sm font-medium mb-3 text-[var(--secondary)]">標籤</h3>
            <div className="flex flex-wrap gap-2 mb-3">
              {TAG_SUGGESTIONS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleToggleTag(tag)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                    formData.tags.includes(tag)
                      ? 'bg-[var(--primary)] text-white'
                      : 'bg-[var(--background)] border border-[var(--border)] hover:border-[var(--primary)]'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustomTag())}
                className="flex-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                placeholder="自訂標籤..."
              />
              <button
                type="button"
                onClick={handleAddCustomTag}
                className="px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] hover:border-[var(--primary)] transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </section>

          {/* Dishes */}
          <section>
            <h3 className="text-sm font-medium mb-3 text-[var(--secondary)]">菜色列表</h3>
            {formData.dishes.length > 0 && (
              <ul className="space-y-2 mb-3">
                {formData.dishes.map((dish, index) => (
                  <li
                    key={index}
                    className="flex items-center justify-between px-3 py-2 bg-[var(--background)] rounded-lg"
                  >
                    <span className="text-sm">{dish}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveDish(index)}
                      className="p-1 text-[var(--muted)] hover:text-[var(--danger)] transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={newDish}
                onChange={(e) => setNewDish(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddDish())}
                className="flex-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                placeholder="輸入菜名..."
              />
              <button
                type="button"
                onClick={handleAddDish}
                className="px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] hover:border-[var(--primary)] transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-between px-6 py-4 bg-[var(--card-bg)] border-t border-[var(--border)]">
          <div className="text-sm text-[var(--muted)]">
            {!canPublish() && (
              <span className="flex items-center gap-1 text-[var(--warning)]">
                <AlertCircle className="w-4 h-4" />
                缺少必要欄位，無法上架
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSave('draft')}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--background)] transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              儲存草稿
            </button>
            <button
              onClick={() => handleSave('needs_review')}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[var(--warning)] text-[var(--warning)] text-sm hover:bg-yellow-50 transition-colors disabled:opacity-50"
            >
              <FileWarning className="w-4 h-4" />
              標記待補
            </button>
            <button
              onClick={() => handleSave('published')}
              disabled={isSaving || !canPublish()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4" />
              通過上架
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
