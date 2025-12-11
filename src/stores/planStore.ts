import { create } from 'zustand';
import type { Plan, FilterState, SortOption, ViewMode, EditMode, UserLocation } from '@/types';
import { db, getAllPlans, addPlan, updatePlan, deletePlan, clearAllData } from '@/lib/db';

// 計算兩點之間的距離（公里）- Haversine formula
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // 地球半徑（公里）
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

interface PlanStore {
  // 資料
  plans: Plan[];
  isLoading: boolean;
  error: string | null;

  // 篩選與排序
  filters: FilterState;
  sortBy: SortOption;

  // 視圖狀態
  viewMode: ViewMode;
  editMode: EditMode;

  // 比對盤
  comparisonIds: string[];
  isCompareModalOpen: boolean;

  // 收藏
  favoriteIds: string[];

  // 瀏覽歷史
  historyIds: string[];

  // 筆記
  notes: Record<string, string>;

  // 用戶位置
  userLocation: UserLocation | null;
  isLoadingLocation: boolean;
  locationError: string | null;

  // 編輯中的方案
  editingPlanId: string | null;

  // Actions
  loadPlans: () => Promise<void>;
  addPlan: (plan: Omit<Plan, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updatePlan: (id: string, updates: Partial<Omit<Plan, 'id' | 'createdAt'>>) => Promise<void>;
  deletePlan: (id: string) => Promise<void>;

  setFilters: (filters: Partial<FilterState>) => void;
  resetFilters: () => void;
  setSortBy: (sortBy: SortOption) => void;

  setViewMode: (mode: ViewMode) => void;
  setEditMode: (mode: EditMode) => void;

  toggleComparison: (planId: string) => void;
  clearComparison: () => void;
  setCompareModalOpen: (open: boolean) => void;

  // 收藏功能
  toggleFavorite: (planId: string) => void;
  clearFavorites: () => void;

  // 瀏覽歷史功能
  addToHistory: (planId: string) => void;
  clearHistory: () => void;
  getHistoryPlans: () => Plan[];

  // 筆記功能
  setNote: (planId: string, note: string) => void;
  deleteNote: (planId: string) => void;
  getNote: (planId: string) => string | undefined;

  // 定位功能
  requestLocation: () => void;
  clearLocation: () => void;
  getDistanceToPlan: (plan: Plan) => number | null;

  // 匯出功能
  exportToCSV: () => void;

  setEditingPlanId: (id: string | null) => void;

  // 批量操作
  batchUpdateStatus: (ids: string[], status: Plan['status']) => Promise<void>;
  batchDelete: (ids: string[]) => Promise<void>;
  clearAllData: () => Promise<void>;
  reloadFromJson: () => Promise<void>;

  // 計算屬性方法
  getFilteredPlans: () => Plan[];
  getComparisonPlans: () => Plan[];
  getFavoritePlans: () => Plan[];
  getStatusCounts: () => { draft: number; published: number; needs_review: number };
}

const defaultFilters: FilterState = {
  shippingType: 'all',
  storageType: 'all',
  onlyPublished: true,
};

export const usePlanStore = create<PlanStore>((set, get) => ({
  // 初始狀態
  plans: [],
  isLoading: false,
  error: null,
  filters: defaultFilters,
  sortBy: 'price_asc',
  viewMode: 'list',
  editMode: 'browse',
  comparisonIds: [],
  isCompareModalOpen: false,
  favoriteIds: typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem('favoriteIds') || '[]')
    : [],
  historyIds: typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem('historyIds') || '[]')
    : [],
  notes: typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem('planNotes') || '{}')
    : {},
  userLocation: null,
  isLoadingLocation: false,
  locationError: null,
  editingPlanId: null,

  // Actions
  loadPlans: async () => {
    set({ isLoading: true, error: null });
    try {
      // 判斷是否為正式環境（GitHub Pages）
      const isProduction = typeof window !== 'undefined' &&
        (window.location.hostname.includes('github.io') ||
         process.env.NODE_ENV === 'production');

      let plans: Plan[];

      if (isProduction) {
        // 正式環境：從靜態 JSON 讀取
        const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
        const res = await fetch(`${basePath}/data/plans.json`);
        const data = await res.json();
        // 轉換日期字串為 Date 物件
        plans = data.map((p: Plan & { createdAt: string; updatedAt: string }) => ({
          ...p,
          createdAt: new Date(p.createdAt),
          updatedAt: new Date(p.updatedAt),
        }));
      } else {
        // 開發環境：從 IndexedDB 讀取
        plans = await getAllPlans();

        // 如果 IndexedDB 是空的，從 JSON 載入初始資料
        if (plans.length === 0) {
          try {
            const res = await fetch('/data/plans.json');
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              // 轉換日期並寫入 IndexedDB
              for (const p of data) {
                const plan = {
                  ...p,
                  createdAt: new Date(p.createdAt),
                  updatedAt: new Date(p.updatedAt),
                };
                await db.plans.put(plan);
              }
              plans = await getAllPlans();
              console.log(`已從 plans.json 載入 ${plans.length} 筆資料到 IndexedDB`);
            }
          } catch (e) {
            console.log('無法從 plans.json 載入初始資料:', e);
          }
        }
      }

      set({ plans, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  addPlan: async (planData) => {
    try {
      const id = await addPlan(planData);
      const plans = await getAllPlans();
      set({ plans });
      return id;
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  updatePlan: async (id, updates) => {
    try {
      await updatePlan(id, updates);
      const plans = await getAllPlans();
      set({ plans });
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  deletePlan: async (id) => {
    try {
      await deletePlan(id);
      const plans = await getAllPlans();
      // 同時從比對盤移除
      set((state) => ({
        plans,
        comparisonIds: state.comparisonIds.filter((cid) => cid !== id),
      }));
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  setFilters: (newFilters) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    }));
  },

  resetFilters: () => {
    set({ filters: defaultFilters });
  },

  setSortBy: (sortBy) => {
    set({ sortBy });
  },

  setViewMode: (viewMode) => {
    set({ viewMode });
  },

  setEditMode: (editMode) => {
    set({ editMode });
  },

  toggleComparison: (planId) => {
    set((state) => {
      const isSelected = state.comparisonIds.includes(planId);
      if (isSelected) {
        return { comparisonIds: state.comparisonIds.filter((id) => id !== planId) };
      }
      // 最多 4 個
      if (state.comparisonIds.length >= 4) {
        return state;
      }
      return { comparisonIds: [...state.comparisonIds, planId] };
    });
  },

  clearComparison: () => {
    set({ comparisonIds: [], isCompareModalOpen: false });
  },

  setCompareModalOpen: (open) => {
    set({ isCompareModalOpen: open });
  },

  setEditingPlanId: (id) => {
    set({ editingPlanId: id });
  },

  // 批量操作
  batchUpdateStatus: async (ids, status) => {
    try {
      for (const id of ids) {
        await updatePlan(id, { status });
      }
      const plans = await getAllPlans();
      set({ plans });
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  batchDelete: async (ids) => {
    try {
      for (const id of ids) {
        await deletePlan(id);
      }
      const plans = await getAllPlans();
      // 同時從比對盤和收藏移除
      set((state) => ({
        plans,
        comparisonIds: state.comparisonIds.filter((cid) => !ids.includes(cid)),
        favoriteIds: state.favoriteIds.filter((fid) => !ids.includes(fid)),
      }));
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  clearAllData: async () => {
    try {
      await clearAllData();
      set({
        plans: [],
        comparisonIds: [],
        favoriteIds: [],
        historyIds: [],
        notes: {},
      });
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  reloadFromJson: async () => {
    try {
      set({ isLoading: true });
      // 先清空 IndexedDB
      await clearAllData();

      // 從 JSON 重新載入
      const res = await fetch('/data/plans.json');
      const data = await res.json();

      if (Array.isArray(data) && data.length > 0) {
        // 轉換日期並寫入 IndexedDB
        for (const p of data) {
          const plan = {
            ...p,
            createdAt: new Date(p.createdAt),
            updatedAt: new Date(p.updatedAt),
          };
          await db.plans.put(plan);
        }
        const plans = await getAllPlans();
        set({
          plans,
          isLoading: false,
          comparisonIds: [],
        });
        console.log(`已從 plans.json 重新載入 ${plans.length} 筆資料`);
      } else {
        set({ plans: [], isLoading: false });
      }
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  // 收藏功能
  toggleFavorite: (planId) => {
    set((state) => {
      const isFavorite = state.favoriteIds.includes(planId);
      const newFavoriteIds = isFavorite
        ? state.favoriteIds.filter((id) => id !== planId)
        : [...state.favoriteIds, planId];

      // 儲存到 localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('favoriteIds', JSON.stringify(newFavoriteIds));
      }

      return { favoriteIds: newFavoriteIds };
    });
  },

  clearFavorites: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('favoriteIds');
    }
    set({ favoriteIds: [] });
  },

  // 瀏覽歷史功能
  addToHistory: (planId) => {
    set((state) => {
      // 移除舊的記錄（如果存在），然後加到最前面
      const filtered = state.historyIds.filter((id) => id !== planId);
      const newHistoryIds = [planId, ...filtered].slice(0, 20); // 最多保留 20 筆

      // 儲存到 localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('historyIds', JSON.stringify(newHistoryIds));
      }

      return { historyIds: newHistoryIds };
    });
  },

  clearHistory: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('historyIds');
    }
    set({ historyIds: [] });
  },

  getHistoryPlans: () => {
    const { plans, historyIds } = get();
    return historyIds
      .map((id) => plans.find((p) => p.id === id))
      .filter(Boolean) as Plan[];
  },

  // 筆記功能
  setNote: (planId, note) => {
    set((state) => {
      const newNotes = { ...state.notes };
      if (note.trim()) {
        newNotes[planId] = note;
      } else {
        delete newNotes[planId];
      }

      // 儲存到 localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('planNotes', JSON.stringify(newNotes));
      }

      return { notes: newNotes };
    });
  },

  deleteNote: (planId) => {
    set((state) => {
      const newNotes = { ...state.notes };
      delete newNotes[planId];

      if (typeof window !== 'undefined') {
        localStorage.setItem('planNotes', JSON.stringify(newNotes));
      }

      return { notes: newNotes };
    });
  },

  getNote: (planId) => {
    return get().notes[planId];
  },

  // 定位功能
  requestLocation: () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      set({ locationError: '您的瀏覽器不支援定位功能' });
      return;
    }

    set({ isLoadingLocation: true, locationError: null });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        set({
          userLocation: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
          },
          isLoadingLocation: false,
          locationError: null,
        });
      },
      (error) => {
        let errorMessage = '無法取得位置';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = '請允許存取您的位置';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = '無法取得位置資訊';
            break;
          case error.TIMEOUT:
            errorMessage = '定位逾時，請重試';
            break;
        }
        set({
          userLocation: null,
          isLoadingLocation: false,
          locationError: errorMessage,
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  },

  clearLocation: () => {
    set({ userLocation: null, locationError: null });
  },

  getDistanceToPlan: (plan) => {
    const { userLocation } = get();
    if (!userLocation) return null;

    // 使用方案的取貨點座標或城市預設座標
    let planLat: number | undefined;
    let planLng: number | undefined;

    // 優先使用取貨點座標
    if (plan.pickupPoints && plan.pickupPoints.length > 0) {
      const point = plan.pickupPoints[0];
      if (point.lat && point.lng) {
        planLat = point.lat;
        planLng = point.lng;
      }
    }

    // 如果沒有取貨點座標，使用城市預設座標
    if (!planLat || !planLng) {
      const cityCoords: Record<string, { lat: number; lng: number }> = {
        '台北市': { lat: 25.0330, lng: 121.5654 },
        '新北市': { lat: 25.0169, lng: 121.4628 },
        '基隆市': { lat: 25.1276, lng: 121.7392 },
        '桃園市': { lat: 24.9936, lng: 121.3010 },
        '新竹市': { lat: 24.8015, lng: 120.9718 },
        '新竹縣': { lat: 24.8387, lng: 121.0179 },
        '宜蘭縣': { lat: 24.7570, lng: 121.7533 },
        '苗栗縣': { lat: 24.5602, lng: 120.8214 },
        '台中市': { lat: 24.1477, lng: 120.6736 },
        '彰化縣': { lat: 24.0752, lng: 120.5161 },
        '南投縣': { lat: 23.9157, lng: 120.6869 },
        '雲林縣': { lat: 23.7092, lng: 120.4313 },
        '嘉義市': { lat: 23.4801, lng: 120.4491 },
        '嘉義縣': { lat: 23.4518, lng: 120.2555 },
        '台南市': { lat: 22.9998, lng: 120.2269 },
        '高雄市': { lat: 22.6273, lng: 120.3014 },
        '屏東縣': { lat: 22.6690, lng: 120.4884 },
        '花蓮縣': { lat: 23.9910, lng: 121.6011 },
        '台東縣': { lat: 22.7583, lng: 121.1444 },
        '澎湖縣': { lat: 23.5711, lng: 119.5793 },
        '金門縣': { lat: 24.4493, lng: 118.3767 },
        '連江縣': { lat: 26.1505, lng: 119.9499 },
      };

      if (plan.city && cityCoords[plan.city]) {
        planLat = cityCoords[plan.city].lat;
        planLng = cityCoords[plan.city].lng;
      }
    }

    if (!planLat || !planLng) return null;

    return calculateDistance(userLocation.lat, userLocation.lng, planLat, planLng);
  },

  // CSV 匯出功能
  exportToCSV: () => {
    const plans = get().getFilteredPlans();

    const headers = [
      '餐廳名稱',
      '方案名稱',
      '原價',
      '優惠價',
      '運費',
      '份量(最少)',
      '份量(最多)',
      '配送方式',
      '保存方式',
      '地區',
      '縣市',
      '可指定日期',
      '訂購截止',
      '到貨開始',
      '到貨結束',
      '標籤',
      '菜色',
    ];

    const shippingLabels: Record<string, string> = {
      delivery: '宅配',
      pickup: '自取',
      both: '宅配/自取',
    };

    const storageLabels: Record<string, string> = {
      frozen: '冷凍',
      chilled: '冷藏',
      room_temp: '常溫',
      unknown: '未知',
    };

    const rows = plans.map((plan) => [
      plan.vendorName,
      plan.title,
      plan.priceOriginal?.toString() || '',
      plan.priceDiscount.toString(),
      plan.shippingFee?.toString() || '0',
      plan.servingsMin.toString(),
      plan.servingsMax?.toString() || plan.servingsMin.toString(),
      shippingLabels[plan.shippingType] || plan.shippingType,
      storageLabels[plan.storageType] || plan.storageType,
      plan.region || '',
      plan.city || '',
      plan.canSelectDate ? '是' : '否',
      plan.orderDeadline || '',
      plan.fulfillStart || '',
      plan.fulfillEnd || '',
      plan.tags.join('、'),
      plan.dishes.join('、'),
    ]);

    // 建立 CSV 內容 (with BOM for Excel)
    const csvContent =
      '\uFEFF' +
      [headers, ...rows]
        .map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        )
        .join('\n');

    // 下載檔案
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `年菜比較_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  // 計算屬性方法
  getFilteredPlans: () => {
    const { plans, filters, sortBy } = get();

    let filtered = [...plans];

    // 狀態篩選
    if (filters.onlyPublished) {
      filtered = filtered.filter((p) => p.status === 'published');
    }

    // 搜尋
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.title.toLowerCase().includes(query) ||
          p.vendorName.toLowerCase().includes(query) ||
          p.tags.some((t) => t.toLowerCase().includes(query)) ||
          p.dishes.some((d) => d.toLowerCase().includes(query))
      );
    }

    // 價格篩選
    if (filters.priceMin !== undefined) {
      filtered = filtered.filter((p) => p.priceDiscount >= filters.priceMin!);
    }
    if (filters.priceMax !== undefined) {
      filtered = filtered.filter((p) => p.priceDiscount <= filters.priceMax!);
    }

    // 每人價格篩選
    if (filters.pricePerPersonMax !== undefined) {
      filtered = filtered.filter((p) => {
        const pricePerPerson = Math.round(p.priceDiscount / p.servingsMin);
        return pricePerPerson <= filters.pricePerPersonMax!;
      });
    }

    // 份量篩選
    if (filters.servingsMin !== undefined) {
      filtered = filtered.filter((p) => (p.servingsMax ?? p.servingsMin) >= filters.servingsMin!);
    }
    if (filters.servingsMax !== undefined) {
      filtered = filtered.filter((p) => p.servingsMin <= filters.servingsMax!);
    }

    // 配送方式（支援多選）
    if (filters.shippingTypes && filters.shippingTypes.length > 0) {
      // 多選模式：方案需符合任一選中的配送方式
      filtered = filtered.filter((p) => {
        // 取得方案的配送方式陣列
        const planShippingTypes = (p as { shippingTypes?: string[] }).shippingTypes ||
          (p.shippingType === 'both' ? ['delivery', 'pickup'] : [p.shippingType]);
        // 檢查是否有任一符合
        return filters.shippingTypes!.some((st) => planShippingTypes.includes(st));
      });
    } else if (filters.shippingType && filters.shippingType !== 'all') {
      // 向後相容：單選模式
      filtered = filtered.filter(
        (p) => p.shippingType === filters.shippingType || p.shippingType === 'both'
      );
    }

    // 儲存方式（支援多選）
    if (filters.storageTypes && filters.storageTypes.length > 0) {
      // 多選模式：方案需符合任一選中的保存方式
      filtered = filtered.filter((p) => {
        // 取得方案的保存方式陣列
        const planStorageTypes = (p as { storageTypes?: string[] }).storageTypes ||
          (p.storageType ? [p.storageType] : ['frozen']);
        // 檢查是否有任一符合
        return filters.storageTypes!.some((st) => planStorageTypes.includes(st));
      });
    } else if (filters.storageType && filters.storageType !== 'all') {
      // 向後相容：單選模式
      filtered = filtered.filter((p) => p.storageType === filters.storageType);
    }

    // 運費篩選
    if (filters.shippingFee === 'free') {
      filtered = filtered.filter((p) => p.shippingFee === 0 || p.tags?.includes('免運'));
    }

    // 地區篩選
    if (filters.region && filters.region !== 'all') {
      filtered = filtered.filter(
        (p) => p.region === filters.region || p.region === 'nationwide'
      );
    }

    // 城市篩選
    if (filters.city && filters.city !== 'all') {
      filtered = filtered.filter((p) => p.city === filters.city);
    }

    // 收藏篩選
    if (filters.showFavoritesOnly) {
      const { favoriteIds } = get();
      filtered = filtered.filter((p) => favoriteIds.includes(p.id));
    }

    // 最近瀏覽篩選
    if (filters.showHistoryOnly) {
      const { historyIds } = get();
      filtered = filtered.filter((p) => historyIds.includes(p.id));
    }

    // 可指定到貨日
    if (filters.canSelectDate !== undefined) {
      filtered = filtered.filter((p) => p.canSelectDate === filters.canSelectDate);
    }

    // 標籤篩選（支援 AND/OR 邏輯）
    if (filters.tags && filters.tags.length > 0) {
      const tagLogic = filters.tagLogic || 'OR';
      if (tagLogic === 'AND') {
        // AND：必須包含所有選中的標籤
        filtered = filtered.filter((p) => filters.tags!.every((tag) => p.tags.includes(tag)));
      } else {
        // OR：包含任一選中的標籤
        filtered = filtered.filter((p) => filters.tags!.some((tag) => p.tags.includes(tag)));
      }
    }

    // 截止日篩選（必須晚於今天）
    if (filters.mustBeBeforeDeadline) {
      const today = new Date().toISOString().split('T')[0];
      filtered = filtered.filter((p) => !p.orderDeadline || p.orderDeadline > today);
    }

    // 排除關鍵字篩選（不吃牛、不吃海鮮等）
    if (filters.excludeKeywords && filters.excludeKeywords.length > 0) {
      filtered = filtered.filter((p) => {
        // 檢查菜色和標籤中是否包含排除關鍵字
        const allText = [...p.dishes, ...p.tags, p.title, p.description || ''].join(' ');
        return !filters.excludeKeywords!.some((keyword) => allText.includes(keyword));
      });
    }

    // 用餐日期篩選
    if (filters.targetDate) {
      filtered = filtered.filter((p) => {
        if (!p.fulfillStart && !p.fulfillEnd) return true;
        const target = filters.targetDate!;
        const start = p.fulfillStart || '1900-01-01';
        const end = p.fulfillEnd || '2100-12-31';
        return target >= start && target <= end;
      });
    }

    // ====== 新增分類篩選 ======
    // 廠商類型
    if (filters.vendorType && filters.vendorType !== 'all') {
      filtered = filtered.filter((p) => p.vendorType === filters.vendorType);
    }

    // 產品類型
    if (filters.productType && filters.productType !== 'all') {
      filtered = filtered.filter((p) => p.productType === filters.productType);
    }

    // 料理風格
    if (filters.cuisineStyle && filters.cuisineStyle !== 'all') {
      filtered = filtered.filter((p) => p.cuisineStyle === filters.cuisineStyle);
    }

    // 價格等級
    if (filters.priceLevel && filters.priceLevel !== 'all') {
      filtered = filtered.filter((p) => p.priceLevel === filters.priceLevel);
    }

    // 家庭規模
    if (filters.familySize && filters.familySize !== 'all') {
      filtered = filtered.filter((p) => p.familySize === filters.familySize);
    }

    // 排序
    switch (sortBy) {
      case 'price_asc':
        filtered.sort((a, b) => a.priceDiscount - b.priceDiscount);
        break;
      case 'price_desc':
        filtered.sort((a, b) => b.priceDiscount - a.priceDiscount);
        break;
      case 'price_per_person_asc':
        filtered.sort((a, b) => {
          const aPerPerson = a.priceDiscount / a.servingsMin;
          const bPerPerson = b.priceDiscount / b.servingsMin;
          return aPerPerson - bPerPerson;
        });
        break;
      case 'servings_asc':
        filtered.sort((a, b) => a.servingsMin - b.servingsMin);
        break;
      case 'servings_desc':
        filtered.sort((a, b) => b.servingsMin - a.servingsMin);
        break;
      case 'deadline_asc':
        filtered.sort((a, b) => {
          if (!a.orderDeadline) return 1;
          if (!b.orderDeadline) return -1;
          return a.orderDeadline.localeCompare(b.orderDeadline);
        });
        break;
      case 'fulfill_asc':
        filtered.sort((a, b) => {
          if (!a.fulfillStart) return 1;
          if (!b.fulfillStart) return -1;
          return a.fulfillStart.localeCompare(b.fulfillStart);
        });
        break;
      case 'updated_desc':
        filtered.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        break;
      case 'vendor_asc':
        filtered.sort((a, b) => a.vendorName.localeCompare(b.vendorName, 'zh-TW'));
        break;
      case 'distance_asc':
        const { userLocation, getDistanceToPlan } = get();
        if (userLocation) {
          filtered.sort((a, b) => {
            const distA = getDistanceToPlan(a);
            const distB = getDistanceToPlan(b);
            if (distA === null) return 1;
            if (distB === null) return -1;
            return distA - distB;
          });
        }
        break;
    }

    return filtered;
  },

  getComparisonPlans: () => {
    const { plans, comparisonIds } = get();
    return comparisonIds.map((id) => plans.find((p) => p.id === id)).filter(Boolean) as Plan[];
  },

  getFavoritePlans: () => {
    const { plans, favoriteIds } = get();
    return favoriteIds.map((id) => plans.find((p) => p.id === id)).filter(Boolean) as Plan[];
  },

  getStatusCounts: () => {
    const { plans } = get();
    return {
      draft: plans.filter((p) => p.status === 'draft').length,
      published: plans.filter((p) => p.status === 'published').length,
      needs_review: plans.filter((p) => p.status === 'needs_review').length,
    };
  },
}));
