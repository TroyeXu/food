'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  Download,
  CheckCircle,
  AlertCircle,
  FileWarning,
  ArrowLeft,
  CheckSquare,
  Square,
  X,
  Rocket,
  Bot,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Copy,
  AlertTriangle,
  Tag,
  Tags,
  History,
  GripVertical,
  Clock,
  FileSpreadsheet,
  BarChart3,
  ClipboardList,
  DollarSign,
  MapPin,
  Truck,
  Calendar,
  CopyPlus,
  Filter,
  PieChart,
  Sparkles,
  Image,
  Link2,
  FileX,
  Merge,
  ShieldCheck,
  Eye,
  Loader,
  Upload,
  FileUp,
  FileDown,
  Database,
  Timer,
  Trash,
  MessageSquare,
  ClipboardCheck,
  Activity,
  StickyNote,
  Save,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  LineChart,
  GitCompare,
  ShoppingCart,
  Bell,
  Zap,
  Globe,
  Webhook,
  PackageX,
  Scale,
  Brain,
} from 'lucide-react';
import { usePlanStore } from '@/stores/planStore';
import EditPanel from '@/components/EditPanel';
import type { Plan } from '@/types';
import { REGION_LABELS } from '@/types';

// 排序欄位類型
type SortField = 'vendorName' | 'priceDiscount' | 'servingsMin' | 'region' | 'orderDeadline' | 'status' | 'completeness';
type SortDirection = 'asc' | 'desc';

// 必填欄位檢查
const REQUIRED_FIELDS: (keyof Plan)[] = ['vendorName', 'title', 'priceDiscount', 'servingsMin', 'shippingType', 'storageType'];

// 常用標籤
const COMMON_TAGS = ['台式', '粵式', '日式', '海鮮', '素食', '佛跳牆', '圍爐套餐', '飯店級', '免運', '宅配', '自取', '冷凍', '冷藏'];

// 變更歷史類型
interface ChangeRecord {
  id: string;
  planId: string;
  planTitle: string;
  action: 'create' | 'update' | 'delete' | 'publish' | 'unpublish';
  changes?: string;
  timestamp: Date;
}

export default function AdminPage() {
  const { plans, loadPlans, deletePlan, updatePlan, batchUpdateStatus, batchDelete, clearAllData, reloadFromJson } = usePlanStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft' | 'needs_review'>('all');
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [isNewPlan, setIsNewPlan] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  // 排序狀態
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // 標籤管理
  const [editingTagsPlanId, setEditingTagsPlanId] = useState<string | null>(null);
  const [newTagInput, setNewTagInput] = useState('');

  // 批量標籤編輯
  const [showBatchTagDialog, setShowBatchTagDialog] = useState(false);
  const [batchTagInput, setBatchTagInput] = useState('');
  const [batchTagMode, setBatchTagMode] = useState<'add' | 'remove'>('add');

  // 變更歷史
  const [changeHistory, setChangeHistory] = useState<ChangeRecord[]>([]);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);

  // 拖曳排序
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [planOrder, setPlanOrder] = useState<string[]>([]);

  // 資料驗證報告
  const [showValidationReport, setShowValidationReport] = useState(false);

  // 統計儀表板
  const [showStatsPanel, setShowStatsPanel] = useState(false);

  // 批量欄位編輯
  const [showBatchFieldDialog, setShowBatchFieldDialog] = useState(false);
  const [batchFieldType, setBatchFieldType] = useState<'price' | 'region' | 'shippingType' | 'storageType' | 'deadline'>('price');
  const [batchFieldValue, setBatchFieldValue] = useState<string | number>('');
  const [batchPriceMode, setBatchPriceMode] = useState<'set' | 'adjust' | 'percent'>('set');

  // 方案複製
  const [duplicatingPlan, setDuplicatingPlan] = useState<Plan | null>(null);

  // 資料品質面板
  const [showQualityPanel, setShowQualityPanel] = useState(false);

  // 智慧標籤建議
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [tagSuggestionsForPlan, setTagSuggestionsForPlan] = useState<Plan | null>(null);
  const [isGeneratingTags, setIsGeneratingTags] = useState(false);
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);

  // 圖片驗證
  const [imageValidation, setImageValidation] = useState<Record<string, 'valid' | 'invalid' | 'checking'>>({});
  const [isValidatingImages, setIsValidatingImages] = useState(false);

  // 重複方案偵測
  const [showDuplicatesPanel, setShowDuplicatesPanel] = useState(false);

  // B1: 匯入匯出
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showBackupDialog, setShowBackupDialog] = useState(false);
  const [importData, setImportData] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  // B2: 排程自動化 (過期清理)
  const [showAutoCleanDialog, setShowAutoCleanDialog] = useState(false);
  const [autoCleanSettings, setAutoCleanSettings] = useState({
    enabled: false,
    daysBeforeExpiry: 0,
    action: 'unpublish' as 'unpublish' | 'delete',
  });

  // B3: 進階編輯
  const [showBulkImageDialog, setShowBulkImageDialog] = useState(false);
  const [bulkImageUrls, setBulkImageUrls] = useState('');

  // B4: 協作功能
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [activityLog, setActivityLog] = useState<{ id: string; action: string; target: string; detail: string; timestamp: Date }[]>([]);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [pendingReviewPlan, setPendingReviewPlan] = useState<Plan | null>(null);
  const [planNotes, setPlanNotes] = useState<Record<string, string>>({});
  const [showNotesDialog, setShowNotesDialog] = useState(false);
  const [editingNotePlanId, setEditingNotePlanId] = useState<string | null>(null);

  // D1: AI 自動分類
  const [showAIClassifyDialog, setShowAIClassifyDialog] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);
  const [classifyResults, setClassifyResults] = useState<Record<string, { category: string; confidence: number; keywords: string[] }>>({});

  // D2: 價格歷史圖表
  const [showPriceHistoryDialog, setShowPriceHistoryDialog] = useState(false);
  const [selectedPlanForHistory, setSelectedPlanForHistory] = useState<Plan | null>(null);
  const [priceHistory, setPriceHistory] = useState<{ date: string; price: number }[]>([]);

  // D3: 競品比較
  const [showCompareDialog, setShowCompareDialog] = useState(false);
  const [comparePlans, setComparePlans] = useState<Plan[]>([]);

  // D4: 缺貨預警
  const [showStockAlertDialog, setShowStockAlertDialog] = useState(false);
  const [stockAlerts, setStockAlerts] = useState<{ planId: string; planTitle: string; status: string; lastChecked: Date }[]>([]);

  useEffect(() => {
    const init = async () => {
      await loadPlans();
      setIsInitialized(true);
    };
    init();
  }, [loadPlans]);

  // 不再自動填充假資料，讓使用者可以從空白開始匯入真實資料
  // useEffect(() => {
  //   const checkAndSeed = async () => {
  //     if (isInitialized && plans.length === 0) {
  //       await seedMockData(addPlan);
  //       await loadPlans();
  //     }
  //   };
  //   checkAndSeed();
  // }, [isInitialized, plans.length, addPlan, loadPlans]);

  // 重複 URL 偵測
  const duplicateUrls = useMemo(() => {
    const urlMap = new Map<string, string[]>();
    plans.forEach(plan => {
      if (plan.sourceUrl) {
        const url = plan.sourceUrl.toLowerCase().trim();
        if (!urlMap.has(url)) {
          urlMap.set(url, []);
        }
        urlMap.get(url)!.push(plan.id);
      }
    });
    // 只保留重複的
    const duplicates = new Map<string, string[]>();
    urlMap.forEach((ids, url) => {
      if (ids.length > 1) {
        duplicates.set(url, ids);
      }
    });
    return duplicates;
  }, [plans]);

  // 檢查單一方案是否有重複 URL
  const hasDuplicateUrl = (plan: Plan) => {
    if (!plan.sourceUrl) return false;
    const url = plan.sourceUrl.toLowerCase().trim();
    return duplicateUrls.has(url);
  };

  // 計算資料完整度
  const getCompleteness = (plan: Plan): { score: number; missing: string[] } => {
    const missing: string[] = [];
    const fieldLabels: Record<string, string> = {
      vendorName: '餐廳名稱',
      title: '方案名稱',
      priceDiscount: '售價',
      servingsMin: '份量',
      shippingType: '供應方式',
      storageType: '保存方式',
    };

    REQUIRED_FIELDS.forEach(field => {
      const value = plan[field];
      if (value === undefined || value === null || value === '' || (typeof value === 'number' && value === 0 && field !== 'priceDiscount')) {
        missing.push(fieldLabels[field] || field);
      }
    });

    // 額外檢查
    if (!plan.tags || plan.tags.length === 0) missing.push('標籤');
    if (!plan.dishes || plan.dishes.length === 0) missing.push('菜色');

    const totalFields = REQUIRED_FIELDS.length + 2;
    const score = Math.round(((totalFields - missing.length) / totalFields) * 100);
    return { score, missing };
  };

  // 過濾和排序
  const filteredPlans = useMemo(() => {
    let result = plans.filter((plan) => {
      const matchesSearch =
        plan.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        plan.vendorName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || plan.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    // 排序
    if (sortField) {
      result = [...result].sort((a, b) => {
        let aVal: any;
        let bVal: any;

        switch (sortField) {
          case 'vendorName':
            aVal = a.vendorName;
            bVal = b.vendorName;
            break;
          case 'priceDiscount':
            aVal = a.priceDiscount;
            bVal = b.priceDiscount;
            break;
          case 'servingsMin':
            aVal = a.servingsMin;
            bVal = b.servingsMin;
            break;
          case 'region':
            aVal = a.region || '';
            bVal = b.region || '';
            break;
          case 'orderDeadline':
            aVal = a.orderDeadline || '';
            bVal = b.orderDeadline || '';
            break;
          case 'status':
            const statusOrder = { published: 0, needs_review: 1, draft: 2 };
            aVal = statusOrder[a.status];
            bVal = statusOrder[b.status];
            break;
          case 'completeness':
            aVal = getCompleteness(a).score;
            bVal = getCompleteness(b).score;
            break;
          default:
            return 0;
        }

        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortDirection === 'asc'
            ? aVal.localeCompare(bVal, 'zh-TW')
            : bVal.localeCompare(aVal, 'zh-TW');
        }
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      });
    }

    return result;
  }, [plans, searchQuery, statusFilter, sortField, sortDirection]);

  // 排序處理
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // 取得排序圖示
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="w-3 h-3 text-[var(--primary)]" />
      : <ArrowDown className="w-3 h-3 text-[var(--primary)]" />;
  };

  // 標籤操作
  const handleAddTag = async (planId: string, tag: string) => {
    const plan = plans.find(p => p.id === planId);
    if (!plan || !tag.trim()) return;
    if (plan.tags.includes(tag.trim())) return;
    await updatePlan(planId, { tags: [...plan.tags, tag.trim()] });
    setNewTagInput('');
  };

  const handleRemoveTag = async (planId: string, tag: string) => {
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;
    await updatePlan(planId, { tags: plan.tags.filter(t => t !== tag) });
  };

  // 批量標籤操作
  const handleBatchTagAdd = async (tag: string) => {
    if (!tag.trim() || selectedIds.length === 0) return;
    setIsBatchProcessing(true);
    try {
      for (const id of selectedIds) {
        const plan = plans.find(p => p.id === id);
        if (plan && !plan.tags.includes(tag.trim())) {
          await updatePlan(id, { tags: [...plan.tags, tag.trim()] });
        }
      }
      addChangeRecord('update', `批量新增標籤: ${tag}`);
    } finally {
      setIsBatchProcessing(false);
      setBatchTagInput('');
    }
  };

  const handleBatchTagRemove = async (tag: string) => {
    if (!tag.trim() || selectedIds.length === 0) return;
    setIsBatchProcessing(true);
    try {
      for (const id of selectedIds) {
        const plan = plans.find(p => p.id === id);
        if (plan && plan.tags.includes(tag.trim())) {
          await updatePlan(id, { tags: plan.tags.filter(t => t !== tag.trim()) });
        }
      }
      addChangeRecord('update', `批量移除標籤: ${tag}`);
    } finally {
      setIsBatchProcessing(false);
      setBatchTagInput('');
    }
  };

  // 取得選取項目的共同標籤
  const getSelectedPlansTags = useMemo(() => {
    if (selectedIds.length === 0) return { common: [], all: [] };
    const selectedPlans = plans.filter(p => selectedIds.includes(p.id));
    const allTags = new Set<string>();
    selectedPlans.forEach(p => p.tags.forEach(t => allTags.add(t)));

    // 共同標籤 (所有選取項目都有的)
    const common = [...allTags].filter(tag =>
      selectedPlans.every(p => p.tags.includes(tag))
    );

    return { common, all: [...allTags] };
  }, [selectedIds, plans]);

  // 統計數據計算
  const statistics = useMemo(() => {
    if (plans.length === 0) return null;

    const prices = plans.map(p => p.priceDiscount).filter(p => p > 0);
    const servings = plans.map(p => p.servingsMin).filter(s => s > 0);

    // 價格區間統計
    const priceRanges = {
      '0-3000': plans.filter(p => p.priceDiscount > 0 && p.priceDiscount <= 3000).length,
      '3001-5000': plans.filter(p => p.priceDiscount > 3000 && p.priceDiscount <= 5000).length,
      '5001-8000': plans.filter(p => p.priceDiscount > 5000 && p.priceDiscount <= 8000).length,
      '8001-12000': plans.filter(p => p.priceDiscount > 8000 && p.priceDiscount <= 12000).length,
      '12001+': plans.filter(p => p.priceDiscount > 12000).length,
    };

    // 份量統計
    const servingRanges = {
      '2-4人': plans.filter(p => p.servingsMin >= 2 && p.servingsMin <= 4).length,
      '5-6人': plans.filter(p => p.servingsMin >= 5 && p.servingsMin <= 6).length,
      '7-10人': plans.filter(p => p.servingsMin >= 7 && p.servingsMin <= 10).length,
      '10人+': plans.filter(p => p.servingsMin > 10).length,
    };

    // 地區統計
    const regionStats: Record<string, number> = {};
    plans.forEach(p => {
      const region = p.region || 'unknown';
      regionStats[region] = (regionStats[region] || 0) + 1;
    });

    // 供應方式統計
    const shippingStats = {
      delivery: plans.filter(p => p.shippingType === 'delivery').length,
      pickup: plans.filter(p => p.shippingType === 'pickup').length,
      both: plans.filter(p => p.shippingType === 'both').length,
    };

    // 保存方式統計
    const storageStats = {
      frozen: plans.filter(p => p.storageType === 'frozen').length,
      chilled: plans.filter(p => p.storageType === 'chilled').length,
      room_temp: plans.filter(p => p.storageType === 'room_temp').length,
    };

    // 標籤統計 (Top 10)
    const tagCounts: Record<string, number> = {};
    plans.forEach(p => p.tags.forEach(t => {
      tagCounts[t] = (tagCounts[t] || 0) + 1;
    }));
    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    // 完整度統計
    const completenessRanges = {
      '100%': plans.filter(p => getCompleteness(p).score === 100).length,
      '80-99%': plans.filter(p => getCompleteness(p).score >= 80 && getCompleteness(p).score < 100).length,
      '50-79%': plans.filter(p => getCompleteness(p).score >= 50 && getCompleteness(p).score < 80).length,
      '<50%': plans.filter(p => getCompleteness(p).score < 50).length,
    };

    return {
      avgPrice: prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0,
      minPrice: prices.length > 0 ? Math.min(...prices) : 0,
      maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
      avgServings: servings.length > 0 ? Math.round(servings.reduce((a, b) => a + b, 0) / servings.length * 10) / 10 : 0,
      priceRanges,
      servingRanges,
      regionStats,
      shippingStats,
      storageStats,
      topTags,
      completenessRanges,
    };
  }, [plans]);

  // 驗證問題列表
  const validationIssues = useMemo(() => {
    return plans
      .map(p => ({
        plan: p,
        ...getCompleteness(p),
      }))
      .filter(item => item.score < 100)
      .sort((a, b) => a.score - b.score);
  }, [plans]);

  // 計算字串相似度 (Jaccard similarity)
  const calculateSimilarity = (str1: string, str2: string): number => {
    const set1 = new Set(str1.toLowerCase().split(''));
    const set2 = new Set(str2.toLowerCase().split(''));
    const intersection = [...set1].filter(x => set2.has(x)).length;
    const union = new Set([...set1, ...set2]).size;
    return union > 0 ? intersection / union : 0;
  };

  // 相似/重複方案偵測
  const duplicatePlans = useMemo(() => {
    const groups: { plans: Plan[]; reason: string }[] = [];
    const processed = new Set<string>();

    plans.forEach((plan, i) => {
      if (processed.has(plan.id)) return;

      const similar: Plan[] = [plan];

      plans.slice(i + 1).forEach((other) => {
        if (processed.has(other.id)) return;

        // 檢查 URL 重複
        if (plan.sourceUrl && other.sourceUrl &&
            plan.sourceUrl.toLowerCase().trim() === other.sourceUrl.toLowerCase().trim()) {
          similar.push(other);
          processed.add(other.id);
          return;
        }

        // 檢查廠商+標題相似度
        const vendorMatch = plan.vendorName.toLowerCase() === other.vendorName.toLowerCase();
        const titleSimilarity = calculateSimilarity(plan.title, other.title);

        if (vendorMatch && titleSimilarity > 0.7) {
          similar.push(other);
          processed.add(other.id);
        }
      });

      if (similar.length > 1) {
        processed.add(plan.id);
        const hasUrlDuplicate = similar.some((p, idx) =>
          similar.some((q, jdx) => idx !== jdx && p.sourceUrl && q.sourceUrl &&
            p.sourceUrl.toLowerCase() === q.sourceUrl.toLowerCase())
        );
        groups.push({
          plans: similar,
          reason: hasUrlDuplicate ? '相同網址' : '相似內容',
        });
      }
    });

    return groups;
  }, [plans]);

  // 根據菜色內容生成標籤建議
  const generateTagSuggestions = useCallback((plan: Plan): string[] => {
    const suggestions: string[] = [];
    const content = [
      plan.title,
      plan.vendorName,
      ...(plan.dishes || []),
      plan.description || '',
    ].join(' ').toLowerCase();

    // 菜系標籤
    const cuisineMap: Record<string, string[]> = {
      '台式': ['滷肉', '控肉', '佛跳牆', '筍絲', '魷魚螺肉蒜', '三杯', '紅燒', '醬油'],
      '粵式': ['燒臘', '叉燒', '燒鵝', '油雞', '港式', '廣式'],
      '日式': ['和牛', '日本', '鰻魚', '生魚片', '刺身', '壽司', '日式'],
      '西式': ['牛排', '龍蝦', '法式', '義式', '西式'],
      '川式': ['麻辣', '川味', '辣子', '水煮'],
      '海鮮': ['龍蝦', '鮑魚', '海參', '干貝', '烏魚子', '蟹', '蝦', '海鮮'],
      '素食': ['素食', '蔬食', '素', '齋'],
    };

    Object.entries(cuisineMap).forEach(([tag, keywords]) => {
      if (keywords.some(kw => content.includes(kw)) && !plan.tags.includes(tag)) {
        suggestions.push(tag);
      }
    });

    // 特色標籤
    const featureMap: Record<string, string[]> = {
      '佛跳牆': ['佛跳牆'],
      '飯店級': ['飯店', '五星', '星級', '餐廳'],
      '米其林': ['米其林', 'michelin'],
      '免運': ['免運', '免運費'],
      '早鳥優惠': ['早鳥', '預購優惠'],
      '限量': ['限量', '限定'],
    };

    Object.entries(featureMap).forEach(([tag, keywords]) => {
      if (keywords.some(kw => content.includes(kw)) && !plan.tags.includes(tag)) {
        suggestions.push(tag);
      }
    });

    // 供應方式標籤
    if (plan.shippingType === 'delivery' && !plan.tags.includes('宅配')) {
      suggestions.push('宅配');
    }
    if (plan.shippingType === 'pickup' && !plan.tags.includes('自取')) {
      suggestions.push('自取');
    }

    // 保存方式標籤
    if (plan.storageType === 'frozen' && !plan.tags.includes('冷凍')) {
      suggestions.push('冷凍');
    }
    if (plan.storageType === 'chilled' && !plan.tags.includes('冷藏')) {
      suggestions.push('冷藏');
    }

    return [...new Set(suggestions)].slice(0, 8);
  }, []);

  // AI 標籤建議 (使用 API)
  const handleAISuggestTags = async (plan: Plan) => {
    setTagSuggestionsForPlan(plan);
    setShowTagSuggestions(true);
    setIsGeneratingTags(true);

    // 先用本地規則快速生成
    const localSuggestions = generateTagSuggestions(plan);
    setSuggestedTags(localSuggestions);
    setIsGeneratingTags(false);
  };

  // 套用建議標籤
  const handleApplySuggestedTag = async (tag: string) => {
    if (!tagSuggestionsForPlan) return;
    if (!tagSuggestionsForPlan.tags.includes(tag)) {
      await updatePlan(tagSuggestionsForPlan.id, {
        tags: [...tagSuggestionsForPlan.tags, tag]
      });
      // 更新本地狀態
      setTagSuggestionsForPlan(prev => prev ? {
        ...prev,
        tags: [...prev.tags, tag]
      } : null);
    }
    // 從建議中移除已套用的標籤
    setSuggestedTags(prev => prev.filter(t => t !== tag));
  };

  // 圖片驗證
  const validateImage = async (url: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = document.createElement('img');
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
      // 設定超時
      setTimeout(() => resolve(false), 5000);
    });
  };

  // 批量驗證所有圖片
  const handleValidateAllImages = async () => {
    setIsValidatingImages(true);
    const results: Record<string, 'valid' | 'invalid' | 'checking'> = {};

    for (const plan of plans) {
      if (plan.imageUrl) {
        results[plan.id] = 'checking';
        setImageValidation({ ...results });

        const isValid = await validateImage(plan.imageUrl);
        results[plan.id] = isValid ? 'valid' : 'invalid';
        setImageValidation({ ...results });
      }
    }

    setIsValidatingImages(false);
  };

  // 資料品質摘要
  const qualitySummary = useMemo(() => {
    const invalidImages = Object.values(imageValidation).filter(v => v === 'invalid').length;
    const lowCompleteness = plans.filter(p => getCompleteness(p).score < 80).length;
    const noTags = plans.filter(p => p.tags.length === 0).length;
    const noDishes = plans.filter(p => !p.dishes || p.dishes.length === 0).length;
    const noImage = plans.filter(p => !p.imageUrl).length;
    const duplicateCount = duplicatePlans.reduce((sum, g) => sum + g.plans.length, 0);

    return {
      invalidImages,
      lowCompleteness,
      noTags,
      noDishes,
      noImage,
      duplicateCount,
      duplicateGroups: duplicatePlans.length,
      total: plans.length,
    };
  }, [plans, imageValidation, duplicatePlans]);

  // 變更歷史記錄
  const addChangeRecord = (action: ChangeRecord['action'], changes?: string) => {
    const record: ChangeRecord = {
      id: Date.now().toString(),
      planId: selectedIds.length === 1 ? selectedIds[0] : 'batch',
      planTitle: selectedIds.length === 1
        ? plans.find(p => p.id === selectedIds[0])?.title || '未知'
        : `${selectedIds.length} 個方案`,
      action,
      changes,
      timestamp: new Date(),
    };
    setChangeHistory(prev => [record, ...prev].slice(0, 50)); // 保留最近 50 筆
  };

  // 載入變更歷史 (從 localStorage)
  useEffect(() => {
    const saved = localStorage.getItem('admin-change-history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setChangeHistory(parsed.map((r: ChangeRecord) => ({
          ...r,
          timestamp: new Date(r.timestamp)
        })));
      } catch {}
    }
  }, []);

  // 儲存變更歷史
  useEffect(() => {
    if (changeHistory.length > 0) {
      localStorage.setItem('admin-change-history', JSON.stringify(changeHistory));
    }
  }, [changeHistory]);

  // ===== B1: 匯入匯出功能 =====
  // 載入備註
  useEffect(() => {
    const savedNotes = localStorage.getItem('admin-plan-notes');
    if (savedNotes) {
      try {
        setPlanNotes(JSON.parse(savedNotes));
      } catch {}
    }
    // 載入操作日誌
    const savedLog = localStorage.getItem('admin-activity-log');
    if (savedLog) {
      try {
        const parsed = JSON.parse(savedLog);
        setActivityLog(parsed.map((l: any) => ({ ...l, timestamp: new Date(l.timestamp) })));
      } catch {}
    }
    // 載入自動清理設定
    const savedClean = localStorage.getItem('admin-auto-clean');
    if (savedClean) {
      try {
        setAutoCleanSettings(JSON.parse(savedClean));
      } catch {}
    }
  }, []);

  // 儲存備註
  useEffect(() => {
    if (Object.keys(planNotes).length > 0) {
      localStorage.setItem('admin-plan-notes', JSON.stringify(planNotes));
    }
  }, [planNotes]);

  // 儲存操作日誌
  useEffect(() => {
    if (activityLog.length > 0) {
      localStorage.setItem('admin-activity-log', JSON.stringify(activityLog));
    }
  }, [activityLog]);

  // 新增操作日誌
  const addActivityLog = (action: string, target: string, detail: string) => {
    const log = {
      id: Date.now().toString(),
      action,
      target,
      detail,
      timestamp: new Date(),
    };
    setActivityLog(prev => [log, ...prev].slice(0, 100));
  };

  // 匯出範本
  const exportTemplate = () => {
    const template = {
      format: 'csv',
      fields: ['vendorName', 'title', 'priceOriginal', 'priceDiscount', 'servingsMin', 'servingsMax', 'shippingType', 'storageType', 'region', 'tags', 'dishes', 'orderDeadline', 'pickupDate', 'sourceUrl', 'imageUrl', 'description'],
      example: {
        vendorName: '餐廳名稱',
        title: '方案名稱',
        priceOriginal: 6800,
        priceDiscount: 5980,
        servingsMin: 4,
        servingsMax: 6,
        shippingType: 'delivery',
        storageType: 'frozen',
        region: 'north',
        tags: '台式,海鮮,佛跳牆',
        dishes: '佛跳牆,紅燒蹄膀,清蒸鱸魚',
        orderDeadline: '2025-01-20',
        pickupDate: '2025-01-28',
        sourceUrl: 'https://example.com/plan',
        imageUrl: 'https://example.com/image.jpg',
        description: '方案描述',
      },
    };
    const headers = template.fields.join(',');
    const exampleRow = template.fields.map(f => template.example[f as keyof typeof template.example] || '').join(',');
    const content = `${headers}\n${exampleRow}`;
    const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // 匯出所有資料 (備份)
  const exportBackup = () => {
    const backup = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      plans: plans.map(p => ({
        ...p,
        createdAt: p.createdAt?.toISOString?.() || p.createdAt,
        updatedAt: p.updatedAt?.toISOString?.() || p.updatedAt,
      })),
      notes: planNotes,
      changeHistory,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addActivityLog('備份', '全部資料', `匯出 ${plans.length} 個方案`);
  };

  // 匯出 CSV
  const exportCSV = () => {
    const headers = ['vendorName', 'title', 'priceOriginal', 'priceDiscount', 'servingsMin', 'servingsMax', 'shippingType', 'storageType', 'region', 'tags', 'dishes', 'orderDeadline', 'pickupDate', 'sourceUrl', 'imageUrl', 'status'];
    const rows = plans.map(p => [
      p.vendorName,
      p.title,
      p.priceOriginal || '',
      p.priceDiscount,
      p.servingsMin,
      p.servingsMax || '',
      p.shippingType,
      p.storageType,
      p.region || '',
      (p.tags || []).join(';'),
      (p.dishes || []).join(';'),
      p.orderDeadline || '',
      p.fulfillStart || '',
      p.sourceUrl || '',
      p.imageUrl || '',
      p.status,
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const content = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plans-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addActivityLog('匯出', 'CSV', `匯出 ${plans.length} 個方案`);
  };

  // 解析 CSV 並匯入
  const handleImportCSV = async () => {
    if (!importData.trim()) return;
    setIsImporting(true);
    setImportErrors([]);
    const errors: string[] = [];
    let successCount = 0;

    try {
      const lines = importData.trim().split('\n');
      if (lines.length < 2) {
        errors.push('CSV 格式錯誤：至少需要標題行和一行資料');
        setImportErrors(errors);
        setIsImporting(false);
        return;
      }

      const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());

      for (let i = 1; i < lines.length; i++) {
        try {
          const values = lines[i].match(/("([^"]|"")*"|[^,]*)/g)?.map(v => v.replace(/^"|"$/g, '').replace(/""/g, '"').trim()) || [];
          const row: Record<string, string> = {};
          headers.forEach((h, idx) => { row[h] = values[idx] || ''; });

          if (!row.vendorName || !row.title) {
            errors.push(`第 ${i + 1} 行：缺少餐廳名稱或方案名稱`);
            continue;
          }

          const { addPlan } = usePlanStore.getState();
          await addPlan({
            vendorId: '',
            vendorName: row.vendorName,
            title: row.title,
            priceOriginal: parseInt(row.priceOriginal) || undefined,
            priceDiscount: parseInt(row.priceDiscount) || 0,
            servingsMin: parseInt(row.servingsMin) || 4,
            servingsMax: parseInt(row.servingsMax) || undefined,
            shippingType: (row.shippingType as 'delivery' | 'pickup' | 'both') || 'delivery',
            storageType: (row.storageType as 'frozen' | 'chilled' | 'room_temp') || 'frozen',
            region: (row.region as any) || undefined,
            tags: row.tags ? row.tags.split(';').map(t => t.trim()).filter(Boolean) : [],
            dishes: row.dishes ? row.dishes.split(';').map(d => d.trim()).filter(Boolean) : [],
            orderDeadline: row.orderDeadline || undefined,
            fulfillStart: row.fulfillStart || undefined,
            sourceUrl: row.sourceUrl || undefined,
            imageUrl: row.imageUrl || undefined,
            description: row.description || undefined,
            status: 'draft',
          });
          successCount++;
        } catch (e) {
          errors.push(`第 ${i + 1} 行：${e}`);
        }
      }

      await loadPlans();
      addActivityLog('匯入', 'CSV', `成功匯入 ${successCount} 個方案`);

      if (errors.length === 0) {
        setShowImportDialog(false);
        setImportData('');
      }
    } catch (e) {
      errors.push(`解析錯誤：${e}`);
    }

    setImportErrors(errors);
    setIsImporting(false);
  };

  // 還原備份
  const handleRestoreBackup = async (file: File) => {
    try {
      const content = await file.text();
      const backup = JSON.parse(content);

      if (!backup.plans || !Array.isArray(backup.plans)) {
        throw new Error('無效的備份檔案格式');
      }

      if (!window.confirm(`確定要還原備份嗎？這將清除目前的 ${plans.length} 個方案，並匯入 ${backup.plans.length} 個方案。`)) {
        return;
      }

      // 清除現有資料
      await clearAllData();

      // 匯入備份資料
      const { addPlan } = usePlanStore.getState();
      for (const plan of backup.plans) {
        await addPlan({
          ...plan,
          createdAt: plan.createdAt ? new Date(plan.createdAt) : new Date(),
          updatedAt: plan.updatedAt ? new Date(plan.updatedAt) : new Date(),
        });
      }

      // 還原備註
      if (backup.notes) {
        setPlanNotes(backup.notes);
      }

      await loadPlans();
      addActivityLog('還原', '備份', `還原 ${backup.plans.length} 個方案`);
      setShowBackupDialog(false);
    } catch (e) {
      alert(`還原失敗：${e}`);
    }
  };

  // ===== B2: 過期清理 =====
  const saveAutoCleanSettings = (settings: typeof autoCleanSettings) => {
    setAutoCleanSettings(settings);
    localStorage.setItem('admin-auto-clean', JSON.stringify(settings));
  };

  const handleAutoClean = async () => {
    const today = new Date();
    const expiredPlans = plans.filter(p => {
      if (!p.orderDeadline) return false;
      const deadline = new Date(p.orderDeadline);
      const diff = Math.floor((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return diff <= autoCleanSettings.daysBeforeExpiry;
    });

    if (expiredPlans.length === 0) {
      alert('沒有找到過期或即將過期的方案');
      return;
    }

    if (!window.confirm(`找到 ${expiredPlans.length} 個過期/即將過期的方案，確定要${autoCleanSettings.action === 'delete' ? '刪除' : '下架'}嗎？`)) {
      return;
    }

    for (const plan of expiredPlans) {
      if (autoCleanSettings.action === 'delete') {
        await deletePlan(plan.id);
      } else {
        await updatePlan(plan.id, { status: 'draft' });
      }
    }

    await loadPlans();
    addActivityLog('自動清理', `${expiredPlans.length} 個方案`, autoCleanSettings.action === 'delete' ? '已刪除' : '已下架');
  };

  // ===== B4: 備註系統 =====
  const savePlanNote = (planId: string, note: string) => {
    setPlanNotes(prev => ({ ...prev, [planId]: note }));
    addActivityLog('備註', plans.find(p => p.id === planId)?.title || planId, note.slice(0, 50));
  };

  // ===== D1: AI 自動分類 =====
  const dishCategories = [
    { id: 'seafood', name: '海鮮類', keywords: ['龍蝦', '鮑魚', '海參', '干貝', '蝦', '蟹', '魚翅', '烏魚子', '魚', '海鮮'] },
    { id: 'meat', name: '肉類', keywords: ['豬', '雞', '鴨', '牛', '羊', '東坡肉', '蹄膀', '火腿', '臘肉', '香腸'] },
    { id: 'vegetable', name: '蔬食類', keywords: ['素', '蔬菜', '佛跳牆素', '養生', '蔬食'] },
    { id: 'soup', name: '湯品類', keywords: ['湯', '羹', '燉', '煲', '佛跳牆'] },
    { id: 'dessert', name: '甜點類', keywords: ['糕', '甜', '年糕', '發糕', '蘿蔔糕', '芋頭糕'] },
    { id: 'combo', name: '組合套餐', keywords: ['套餐', '組合', '全席', '桌菜', '圍爐'] },
  ];

  const classifyPlan = (plan: Plan): { category: string; confidence: number; keywords: string[] } => {
    const text = `${plan.title} ${plan.description || ''} ${plan.tags?.join(' ') || ''}`.toLowerCase();
    const matchedCategories: { id: string; name: string; matches: string[] }[] = [];

    for (const cat of dishCategories) {
      const matches = cat.keywords.filter(kw => text.includes(kw.toLowerCase()));
      if (matches.length > 0) {
        matchedCategories.push({ id: cat.id, name: cat.name, matches });
      }
    }

    if (matchedCategories.length === 0) {
      return { category: '未分類', confidence: 0, keywords: [] };
    }

    // 選擇匹配最多關鍵字的分類
    matchedCategories.sort((a, b) => b.matches.length - a.matches.length);
    const best = matchedCategories[0];
    const confidence = Math.min(100, best.matches.length * 25);

    return { category: best.name, confidence, keywords: best.matches };
  };

  const handleAIClassify = async () => {
    setIsClassifying(true);
    const results: Record<string, { category: string; confidence: number; keywords: string[] }> = {};

    // 模擬 AI 分類處理
    for (const plan of plans) {
      results[plan.id] = classifyPlan(plan);
      await new Promise(r => setTimeout(r, 50)); // 模擬處理時間
    }

    setClassifyResults(results);
    setIsClassifying(false);
  };

  const applyClassification = async (planId: string, category: string) => {
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;

    const newTags = [...new Set([...(plan.tags || []), category])];
    await updatePlan(planId, { tags: newTags });
    addActivityLog('分類', plan.title, `套用分類: ${category}`);
  };

  // ===== D2: 價格歷史 =====
  const loadPriceHistory = (plan: Plan) => {
    // 從 localStorage 讀取價格歷史，或生成模擬資料
    const stored = localStorage.getItem(`price-history-${plan.id}`);
    if (stored) {
      setPriceHistory(JSON.parse(stored));
    } else {
      // 生成過去 30 天的模擬價格歷史
      const history: { date: string; price: number }[] = [];
      const basePrice = plan.priceDiscount || plan.priceOriginal || 0;
      const today = new Date();

      for (let i = 30; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const variation = (Math.random() - 0.5) * 0.1 * basePrice;
        history.push({
          date: date.toISOString().split('T')[0],
          price: Math.round(basePrice + variation),
        });
      }
      // 最後一天使用當前價格
      if (history.length > 0) {
        history[history.length - 1].price = basePrice;
      }
      setPriceHistory(history);
    }
  };

  // ===== D3: 競品比較 =====
  const findSimilarPlans = (plan: Plan): Plan[] => {
    // 根據價格區間和標籤找相似方案
    const priceRange = 0.3; // 30% 價格差異內
    const basePrice = plan.priceDiscount || plan.priceOriginal || 0;

    return plans.filter(p => {
      if (p.id === plan.id) return false;
      const price = p.priceDiscount || p.priceOriginal || 0;
      const priceDiff = Math.abs(price - basePrice) / basePrice;
      if (priceDiff > priceRange) return false;

      // 檢查標籤相似度
      const commonTags = (plan.tags || []).filter(t => (p.tags || []).includes(t));
      return commonTags.length > 0 || p.vendorName !== plan.vendorName;
    }).slice(0, 5);
  };

  const openCompareDialog = (plan: Plan) => {
    const similar = findSimilarPlans(plan);
    setComparePlans([plan, ...similar]);
    setShowCompareDialog(true);
  };

  // ===== D4: 缺貨預警 =====
  const checkStockStatus = () => {
    const alerts: { planId: string; planTitle: string; status: string; lastChecked: Date }[] = [];

    for (const plan of plans) {
      // 檢查標題或描述中是否有缺貨相關字眼
      const text = `${plan.title} ${plan.description || ''}`.toLowerCase();
      const outOfStockKeywords = ['售罄', '完售', '缺貨', '已售完', '暫停供應', '預購額滿'];

      for (const kw of outOfStockKeywords) {
        if (text.includes(kw)) {
          alerts.push({
            planId: plan.id,
            planTitle: plan.title,
            status: kw,
            lastChecked: new Date(),
          });
          break;
        }
      }
    }

    setStockAlerts(alerts);
    localStorage.setItem('stock-alerts', JSON.stringify(alerts));
  };

  // 鍵盤快捷鍵
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Esc 關閉編輯面板或對話框
      if (e.key === 'Escape') {
        if (showBatchTagDialog) {
          setShowBatchTagDialog(false);
        } else if (editingPlan || isNewPlan) {
          setEditingPlan(null);
          setIsNewPlan(false);
        } else if (selectedIds.length > 0) {
          setSelectedIds([]);
        }
      }

      // Ctrl/Cmd + A 全選
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !editingPlan && !isNewPlan) {
        e.preventDefault();
        if (selectedIds.length === filteredPlans.length) {
          setSelectedIds([]);
        } else {
          setSelectedIds(filteredPlans.map(p => p.id));
        }
      }

      // Ctrl/Cmd + N 新增
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        setEditingPlan(null);
        setIsNewPlan(true);
      }

      // Delete 刪除選取
      if (e.key === 'Delete' && selectedIds.length > 0 && !editingPlan && !isNewPlan) {
        handleBatchDelete();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showBatchTagDialog, editingPlan, isNewPlan, selectedIds, filteredPlans]);

  const counts = {
    all: plans.length,
    published: plans.filter(p => p.status === 'published').length,
    draft: plans.filter(p => p.status === 'draft').length,
    needs_review: plans.filter(p => p.status === 'needs_review').length,
  };

  const handleDelete = async (plan: Plan) => {
    if (window.confirm(`確定要刪除「${plan.title}」嗎？`)) {
      await deletePlan(plan.id);
    }
  };

  // 批量選取
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredPlans.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredPlans.map((p) => p.id));
    }
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  // 批量操作 (含上架驗證)
  const handleBatchPublish = async () => {
    // 上架前驗證：檢查資料完整度
    const invalidPlans = selectedIds
      .map(id => plans.find(p => p.id === id))
      .filter(p => p && getCompleteness(p).score < 80);

    if (invalidPlans.length > 0) {
      const names = invalidPlans.map(p => p?.title).join('、');
      const proceed = window.confirm(
        `以下 ${invalidPlans.length} 個方案資料完整度不足 80%，無法上架：\n\n${names}\n\n是否只上架其他符合條件的方案？`
      );
      if (!proceed) return;

      // 只上架符合條件的
      const validIds = selectedIds.filter(id => {
        const plan = plans.find(p => p.id === id);
        return plan && getCompleteness(plan).score >= 80;
      });

      if (validIds.length === 0) {
        alert('沒有符合條件的方案可上架');
        return;
      }

      setIsBatchProcessing(true);
      try {
        await batchUpdateStatus(validIds, 'published');
        addChangeRecord('publish', `上架 ${validIds.length} 個方案`);
        setSelectedIds([]);
      } finally {
        setIsBatchProcessing(false);
      }
      return;
    }

    if (!window.confirm(`確定要上架 ${selectedIds.length} 個方案嗎？`)) return;
    setIsBatchProcessing(true);
    try {
      await batchUpdateStatus(selectedIds, 'published');
      addChangeRecord('publish', `上架 ${selectedIds.length} 個方案`);
      setSelectedIds([]);
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleBatchUnpublish = async () => {
    if (!window.confirm(`確定要將 ${selectedIds.length} 個方案設為草稿嗎？`)) return;
    setIsBatchProcessing(true);
    try {
      await batchUpdateStatus(selectedIds, 'draft');
      setSelectedIds([]);
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleBatchDelete = async () => {
    if (!window.confirm(`確定要刪除 ${selectedIds.length} 個方案嗎？此操作無法復原！`)) return;
    setIsBatchProcessing(true);
    try {
      await batchDelete(selectedIds);
      setSelectedIds([]);
    } finally {
      setIsBatchProcessing(false);
    }
  };

  // B3: 批量圖片更新
  const handleBulkImageUpdate = async () => {
    const urls = bulkImageUrls.split('\n').map(u => u.trim()).filter(Boolean);
    if (urls.length === 0) {
      alert('請輸入至少一個圖片網址');
      return;
    }

    setIsBatchProcessing(true);
    try {
      const selectedPlansList = selectedIds.map(id => plans.find(p => p.id === id)).filter(Boolean) as Plan[];

      for (let i = 0; i < selectedPlansList.length; i++) {
        const plan = selectedPlansList[i];
        // 循環分配圖片 URL
        const imageUrl = urls[i % urls.length];
        await updatePlan(plan.id, { imageUrl });
      }

      addActivityLog('批量更新', '圖片', `批量更新 ${selectedPlansList.length} 個方案的圖片`);
      alert(`成功更新 ${selectedPlansList.length} 個方案的圖片`);
      setShowBulkImageDialog(false);
      setBulkImageUrls('');
      setSelectedIds([]);
    } catch (error) {
      console.error('批量圖片更新失敗:', error);
      alert('批量更新失敗');
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleClearAllData = async () => {
    if (!window.confirm('確定要清除所有資料嗎？此操作無法復原！')) return;
    if (!window.confirm('再次確認：這會刪除所有年菜方案資料，確定要繼續嗎？')) return;
    try {
      await clearAllData();
      setSelectedIds([]);
    } catch (error) {
      console.error('清除資料失敗:', error);
    }
  };

  const handleReloadFromJson = async () => {
    if (!window.confirm('確定要從 JSON 檔案重新載入資料嗎？這會覆蓋目前的資料！')) return;
    try {
      await reloadFromJson();
      setSelectedIds([]);
      alert('資料已重新載入！');
    } catch (error) {
      console.error('重新載入失敗:', error);
      alert('重新載入失敗：' + (error as Error).message);
    }
  };

  // 批量欄位編輯
  const handleBatchFieldUpdate = async () => {
    if (selectedIds.length === 0 || batchFieldValue === '') return;
    setIsBatchProcessing(true);
    try {
      for (const id of selectedIds) {
        const plan = plans.find(p => p.id === id);
        if (!plan) continue;

        let updateData: Partial<Plan> = {};

        switch (batchFieldType) {
          case 'price':
            let newPrice = plan.priceDiscount;
            if (batchPriceMode === 'set') {
              newPrice = Number(batchFieldValue);
            } else if (batchPriceMode === 'adjust') {
              newPrice = plan.priceDiscount + Number(batchFieldValue);
            } else if (batchPriceMode === 'percent') {
              newPrice = Math.round(plan.priceDiscount * (1 + Number(batchFieldValue) / 100));
            }
            updateData.priceDiscount = Math.max(0, newPrice);
            break;
          case 'region':
            updateData.region = batchFieldValue as Plan['region'];
            break;
          case 'shippingType':
            updateData.shippingType = batchFieldValue as Plan['shippingType'];
            break;
          case 'storageType':
            updateData.storageType = batchFieldValue as Plan['storageType'];
            break;
          case 'deadline':
            updateData.orderDeadline = batchFieldValue as string;
            break;
        }

        await updatePlan(id, updateData);
      }
      addChangeRecord('update', `批量修改 ${batchFieldType}: ${selectedIds.length} 個方案`);
      setShowBatchFieldDialog(false);
      setBatchFieldValue('');
    } finally {
      setIsBatchProcessing(false);
    }
  };

  // 複製方案
  const handleDuplicatePlan = async (plan: Plan) => {
    try {
      const { addPlan } = usePlanStore.getState();
      const { id, createdAt, updatedAt, ...planData } = plan;
      await addPlan({
        ...planData,
        title: `${plan.title} (複製)`,
        status: 'draft',
      });
      await loadPlans();
      addChangeRecord('create', `複製方案: ${plan.title}`);
    } catch (error) {
      console.error('複製失敗:', error);
    }
  };

  const handleExportToPublic = async () => {
    const data = plans.filter(p => p.status === 'published');
    if (data.length === 0) {
      alert('沒有已上架的資料可匯出');
      return;
    }

    try {
      const res = await fetch('/api/export-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await res.json();
      if (result.success) {
        alert(`成功匯出 ${data.length} 筆資料！\n\n現在可以 commit 並 push 到 GitHub 部署。`);
      } else {
        alert('匯出失敗：' + result.error);
      }
    } catch (error) {
      alert('匯出失敗：' + String(error));
    }
  };

  const handleExport = (format: 'csv' | 'json') => {
    const data = plans.filter(p => p.status === 'published');

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `年菜資料_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const headers = ['餐廳', '方案名稱', '售價', '原價', '份量', '供應方式', '保存方式', '地區', '縣市', '截止日', '到貨區間', '可指定日期', '標籤', '來源網址'];
      const rows = data.map(p => [
        p.vendorName,
        p.title,
        p.priceDiscount,
        p.priceOriginal || '',
        `${p.servingsMin}${p.servingsMax ? `-${p.servingsMax}` : ''}人`,
        p.shippingType === 'delivery' ? '宅配' : p.shippingType === 'pickup' ? '自取' : '皆可',
        p.storageType === 'frozen' ? '冷凍' : p.storageType === 'chilled' ? '冷藏' : '其他',
        p.region ? REGION_LABELS[p.region] : '',
        p.city || '',
        p.orderDeadline || '',
        `${p.fulfillStart || ''}-${p.fulfillEnd || ''}`,
        p.canSelectDate ? '是' : '否',
        p.tags.join('、'),
        p.sourceUrl || '',
      ]);

      const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `年菜資料_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const getStatusBadge = (status: Plan['status']) => {
    switch (status) {
      case 'published':
        return (
          <span className="flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
            <CheckCircle className="w-3 h-3" />
            已上架
          </span>
        );
      case 'draft':
        return (
          <span className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
            <AlertCircle className="w-3 h-3" />
            草稿
          </span>
        );
      case 'needs_review':
        return (
          <span className="flex items-center gap-1 px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded-full">
            <FileWarning className="w-3 h-3" />
            待校正
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[var(--card-bg)] border-b border-[var(--border)] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a
              href="/"
              className="flex items-center gap-2 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              返回前台
            </a>
            <h1 className="text-xl font-bold">年菜資料管理</h1>
          </div>
          <div className="flex items-center gap-3">
            {/* 統計儀表板 */}
            <button
              onClick={() => setShowStatsPanel(!showStatsPanel)}
              className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors ${
                showStatsPanel
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-[var(--border)] hover:bg-[var(--background)]'
              }`}
              title="統計儀表板"
            >
              <BarChart3 className="w-4 h-4" />
            </button>
            {/* 資料驗證報告 */}
            <button
              onClick={() => setShowValidationReport(true)}
              className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors ${
                validationIssues.length > 0
                  ? 'border-yellow-300 text-yellow-700 hover:bg-yellow-50'
                  : 'border-[var(--border)] hover:bg-[var(--background)]'
              }`}
              title="資料驗證報告"
            >
              <ClipboardList className="w-4 h-4" />
              {validationIssues.length > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full">
                  {validationIssues.length}
                </span>
              )}
            </button>
            {/* 資料品質 */}
            <button
              onClick={() => setShowQualityPanel(!showQualityPanel)}
              className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors ${
                showQualityPanel
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : qualitySummary.duplicateGroups > 0 || qualitySummary.invalidImages > 0
                    ? 'border-orange-300 text-orange-700 hover:bg-orange-50'
                    : 'border-[var(--border)] hover:bg-[var(--background)]'
              }`}
              title="資料品質檢查"
            >
              <ShieldCheck className="w-4 h-4" />
              {(qualitySummary.duplicateGroups > 0 || qualitySummary.noTags > 0) && (
                <span className="px-1.5 py-0.5 text-xs bg-orange-100 text-orange-700 rounded-full">
                  {qualitySummary.duplicateGroups + qualitySummary.noTags}
                </span>
              )}
            </button>
            {/* 變更歷史 */}
            <button
              onClick={() => setShowHistoryPanel(!showHistoryPanel)}
              className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors ${
                showHistoryPanel
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-[var(--border)] hover:bg-[var(--background)]'
              }`}
              title="變更歷史"
            >
              <History className="w-4 h-4" />
              {changeHistory.length > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                  {changeHistory.length}
                </span>
              )}
            </button>
            <button
              onClick={handleReloadFromJson}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              重新載入
            </button>
            <button
              onClick={handleClearAllData}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              清除所有資料
            </button>
            <button
              onClick={handleExportToPublic}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:opacity-90 transition-colors"
            >
              <Rocket className="w-4 h-4" />
              發布到網站
            </button>

            {/* B1: 匯入匯出 */}
            <div className="flex items-center gap-1 border-l border-gray-300 pl-3 ml-1">
              <button
                onClick={() => setShowImportDialog(true)}
                className="flex items-center gap-1 px-2 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                title="匯入 CSV"
              >
                <Upload className="w-4 h-4" />
              </button>
              <button
                onClick={exportCSV}
                className="flex items-center gap-1 px-2 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                title="匯出 CSV"
              >
                <FileDown className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowBackupDialog(true)}
                className="flex items-center gap-1 px-2 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                title="備份/還原"
              >
                <Database className="w-4 h-4" />
              </button>
              <button
                onClick={exportTemplate}
                className="flex items-center gap-1 px-2 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                title="下載範本"
              >
                <FileUp className="w-4 h-4" />
              </button>
            </div>

            {/* B2: 排程自動化 */}
            <button
              onClick={() => setShowAutoCleanDialog(true)}
              className="flex items-center gap-1 px-2 py-2 text-sm border border-orange-300 text-orange-600 rounded-lg hover:bg-orange-50 transition-colors"
              title="自動清理設定"
            >
              <Timer className="w-4 h-4" />
            </button>

            {/* B4: 協作功能 */}
            <button
              onClick={() => setShowActivityLog(true)}
              className="flex items-center gap-1 px-2 py-2 text-sm border border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
              title="操作日誌"
            >
              <Activity className="w-4 h-4" />
            </button>

            {/* D 系列: 資料增強 */}
            <div className="flex items-center gap-1 border-l border-gray-300 pl-3 ml-1">
              <button
                onClick={() => {
                  setShowAIClassifyDialog(true);
                  handleAIClassify();
                }}
                className="flex items-center gap-1 px-2 py-2 text-sm border border-purple-300 text-purple-600 rounded-lg hover:bg-purple-50 transition-colors"
                title="AI 自動分類"
              >
                <Brain className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  checkStockStatus();
                  setShowStockAlertDialog(true);
                }}
                className="flex items-center gap-1 px-2 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                title="缺貨預警"
              >
                <PackageX className="w-4 h-4" />
              </button>
            </div>

            <a
              href="/admin/scraper"
              className="flex items-center gap-2 px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Bot className="w-4 h-4" />
              爬蟲控管
            </a>
            <button
              onClick={() => {
                setEditingPlan(null);
                setIsNewPlan(true);
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-[var(--success)] text-white rounded-lg hover:opacity-90 transition-colors"
              title="新增方案 (Ctrl+N)"
            >
              <Plus className="w-4 h-4" />
              新增方案
            </button>
          </div>
        </div>
      </header>

      <div className="p-6">
        {/* Stats */}
        <div className="grid grid-cols-6 gap-4 mb-6">
          <div className="bg-[var(--card-bg)] rounded-xl p-4 border border-[var(--border)]">
            <p className="text-sm text-[var(--muted)]">全部方案</p>
            <p className="text-2xl font-bold">{counts.all}</p>
          </div>
          <div className="bg-[var(--card-bg)] rounded-xl p-4 border border-[var(--border)]">
            <p className="text-sm text-green-600">已上架</p>
            <p className="text-2xl font-bold text-green-600">{counts.published}</p>
          </div>
          <div className="bg-[var(--card-bg)] rounded-xl p-4 border border-[var(--border)]">
            <p className="text-sm text-yellow-600">待校正</p>
            <p className="text-2xl font-bold text-yellow-600">{counts.needs_review}</p>
          </div>
          <div className="bg-[var(--card-bg)] rounded-xl p-4 border border-[var(--border)]">
            <p className="text-sm text-[var(--muted)]">草稿</p>
            <p className="text-2xl font-bold text-[var(--muted)]">{counts.draft}</p>
          </div>
          {/* 重複項目統計 */}
          <div className={`rounded-xl p-4 border ${duplicateUrls.size > 0 ? 'bg-orange-50 border-orange-200' : 'bg-[var(--card-bg)] border-[var(--border)]'}`}>
            <p className="text-sm text-orange-600 flex items-center gap-1">
              <Copy className="w-4 h-4" />
              重複網址
            </p>
            <p className={`text-2xl font-bold ${duplicateUrls.size > 0 ? 'text-orange-600' : 'text-[var(--muted)]'}`}>
              {duplicateUrls.size}
            </p>
          </div>
          {/* 低完整度統計 */}
          <div className={`rounded-xl p-4 border ${plans.filter(p => getCompleteness(p).score < 80).length > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-[var(--card-bg)] border-[var(--border)]'}`}>
            <p className="text-sm text-yellow-600 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" />
              待補資料
            </p>
            <p className={`text-2xl font-bold ${plans.filter(p => getCompleteness(p).score < 80).length > 0 ? 'text-yellow-600' : 'text-[var(--muted)]'}`}>
              {plans.filter(p => getCompleteness(p).score < 80).length}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
            <input
              type="text"
              placeholder="搜尋餐廳或方案名稱..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
          <div className="flex items-center gap-2">
            {(['all', 'published', 'needs_review', 'draft'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                  statusFilter === status
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-[var(--background)] border border-[var(--border)] hover:border-[var(--primary)]'
                }`}
              >
                {status === 'all' ? '全部' : status === 'published' ? '已上架' : status === 'needs_review' ? '待校正' : '草稿'}
                <span className="ml-1 opacity-70">({counts[status]})</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => handleExport('csv')}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-[var(--border)] rounded-lg hover:bg-[var(--background)] transition-colors"
            >
              <Download className="w-4 h-4" />
              匯出 CSV
            </button>
            <button
              onClick={() => handleExport('json')}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-[var(--border)] rounded-lg hover:bg-[var(--background)] transition-colors"
            >
              <Download className="w-4 h-4" />
              匯出 JSON
            </button>
          </div>
        </div>

        {/* Batch Actions Bar */}
        {selectedIds.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-4 p-4 bg-[var(--primary)]/10 border border-[var(--primary)]/30 rounded-xl">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-[var(--primary)]" />
              <span className="font-medium">已選取 {selectedIds.length} 個方案</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 ml-auto">
              {/* 批量標籤編輯 */}
              <button
                onClick={() => setShowBatchTagDialog(true)}
                disabled={isBatchProcessing}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-colors"
              >
                <Tags className="w-4 h-4" />
                批量標籤
              </button>
              {/* B3: 批量圖片設定 */}
              <button
                onClick={() => setShowBulkImageDialog(true)}
                disabled={isBatchProcessing}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-cyan-600 text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-colors"
              >
                <Image className="w-4 h-4" />
                批量圖片
              </button>
              {/* 批量欄位編輯 */}
              <button
                onClick={() => setShowBatchFieldDialog(true)}
                disabled={isBatchProcessing}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-colors"
              >
                <Edit3 className="w-4 h-4" />
                批量修改
              </button>
              <button
                onClick={handleBatchPublish}
                disabled={isBatchProcessing}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-[var(--success)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                批量上架
              </button>
              <button
                onClick={handleBatchUnpublish}
                disabled={isBatchProcessing}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-500 text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-colors"
              >
                <AlertCircle className="w-4 h-4" />
                設為草稿
              </button>
              <button
                onClick={handleBatchDelete}
                disabled={isBatchProcessing}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-[var(--danger)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                批量刪除
              </button>
              <button
                onClick={clearSelection}
                className="p-2 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                title="取消選取 (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--background)]">
                <th className="px-4 py-3 text-left w-12">
                  <button
                    onClick={toggleSelectAll}
                    className="p-1 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                  >
                    {selectedIds.length === filteredPlans.length && filteredPlans.length > 0 ? (
                      <CheckSquare className="w-5 h-5 text-[var(--primary)]" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => handleSort('vendorName')}
                    className="flex items-center gap-1 text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                  >
                    方案 {getSortIcon('vendorName')}
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => handleSort('priceDiscount')}
                    className="flex items-center gap-1 text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                  >
                    價格 {getSortIcon('priceDiscount')}
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => handleSort('servingsMin')}
                    className="flex items-center gap-1 text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                  >
                    份量 {getSortIcon('servingsMin')}
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => handleSort('completeness')}
                    className="flex items-center gap-1 text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                  >
                    完整度 {getSortIcon('completeness')}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-[var(--muted)]">標籤</th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => handleSort('status')}
                    className="flex items-center gap-1 text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                  >
                    狀態 {getSortIcon('status')}
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-[var(--muted)]">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlans.map((plan) => {
                const completeness = getCompleteness(plan);
                const isDuplicate = hasDuplicateUrl(plan);
                const isEditingTags = editingTagsPlanId === plan.id;

                return (
                <tr
                  key={plan.id}
                  className={`border-b border-[var(--border)] hover:bg-[var(--background)]/50 ${
                    selectedIds.includes(plan.id) ? 'bg-[var(--primary)]/5' : ''
                  } ${isDuplicate ? 'bg-orange-50/50' : ''}`}
                >
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleSelect(plan.id)}
                      className="p-1 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                    >
                      {selectedIds.includes(plan.id) ? (
                        <CheckSquare className="w-5 h-5 text-[var(--primary)]" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {plan.imageUrl ? (
                        <img
                          src={plan.imageUrl}
                          alt={plan.title}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-[var(--background)] flex items-center justify-center text-[var(--muted)] text-xs">
                          無圖
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-1">
                          <p className="text-xs text-[var(--muted)]">{plan.vendorName}</p>
                          {/* 重複 URL 警示 */}
                          {isDuplicate && (
                            <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] bg-orange-100 text-orange-700 rounded" title="此來源網址與其他方案重複">
                              <Copy className="w-3 h-3" />
                              重複
                            </span>
                          )}
                        </div>
                        <p className="font-medium">{plan.title}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-[var(--primary)]">
                      ${plan.priceDiscount.toLocaleString()}
                    </span>
                    {plan.priceOriginal && (
                      <span className="text-xs text-[var(--muted)] line-through ml-1">
                        ${plan.priceOriginal.toLocaleString()}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {plan.servingsMin}{plan.servingsMax ? `-${plan.servingsMax}` : ''} 人
                  </td>
                  {/* 資料完整度 */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            completeness.score >= 80 ? 'bg-green-500' :
                            completeness.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${completeness.score}%` }}
                        />
                      </div>
                      <span className={`text-xs font-medium ${
                        completeness.score >= 80 ? 'text-green-600' :
                        completeness.score >= 50 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {completeness.score}%
                      </span>
                      {completeness.missing.length > 0 && (
                        <span
                          className="cursor-help"
                          title={`缺少: ${completeness.missing.join(', ')}`}
                        >
                          <AlertTriangle className="w-4 h-4 text-yellow-500" />
                        </span>
                      )}
                    </div>
                  </td>
                  {/* 標籤管理 */}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1 max-w-[200px]">
                      {plan.tags.slice(0, isEditingTags ? plan.tags.length : 3).map((tag) => (
                        <span
                          key={tag}
                          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs rounded ${
                            isEditingTags
                              ? 'bg-[var(--primary)] text-white'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {tag}
                          {isEditingTags && (
                            <button
                              onClick={() => handleRemoveTag(plan.id, tag)}
                              className="hover:text-red-200"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </span>
                      ))}
                      {!isEditingTags && plan.tags.length > 3 && (
                        <span className="text-xs text-[var(--muted)]">+{plan.tags.length - 3}</span>
                      )}
                      {/* 編輯標籤按鈕 */}
                      <button
                        onClick={() => {
                          setEditingTagsPlanId(isEditingTags ? null : plan.id);
                          setNewTagInput('');
                        }}
                        className={`p-1 rounded transition-colors ${
                          isEditingTags
                            ? 'bg-[var(--primary)] text-white'
                            : 'text-[var(--muted)] hover:text-[var(--primary)] hover:bg-gray-100'
                        }`}
                        title={isEditingTags ? '完成' : '編輯標籤'}
                      >
                        <Tag className="w-3 h-3" />
                      </button>
                    </div>
                    {/* 展開的標籤編輯區 */}
                    {isEditingTags && (
                      <div className="mt-2 space-y-2">
                        <div className="flex gap-1">
                          <input
                            type="text"
                            value={newTagInput}
                            onChange={(e) => setNewTagInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleAddTag(plan.id, newTagInput);
                              }
                            }}
                            placeholder="輸入標籤..."
                            className="flex-1 px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                          />
                          <button
                            onClick={() => handleAddTag(plan.id, newTagInput)}
                            className="px-2 py-1 text-xs bg-[var(--primary)] text-white rounded hover:opacity-90"
                          >
                            加入
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {COMMON_TAGS.filter(t => !plan.tags.includes(t)).slice(0, 6).map((tag) => (
                            <button
                              key={tag}
                              onClick={() => handleAddTag(plan.id, tag)}
                              className="px-1.5 py-0.5 text-[10px] bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                            >
                              + {tag}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {getStatusBadge(plan.status)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => {
                          setEditingPlan(plan);
                          setIsNewPlan(false);
                        }}
                        className="p-2 text-[var(--muted)] hover:text-[var(--primary)] transition-colors"
                        title="編輯"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDuplicatePlan(plan)}
                        className="p-2 text-[var(--muted)] hover:text-indigo-600 transition-colors"
                        title="複製方案"
                      >
                        <CopyPlus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingNotePlanId(plan.id);
                          setShowNotesDialog(true);
                        }}
                        className={`p-2 transition-colors ${planNotes[plan.id] ? 'text-yellow-500 hover:text-yellow-600' : 'text-[var(--muted)] hover:text-yellow-500'}`}
                        title={planNotes[plan.id] ? `備註: ${planNotes[plan.id].substring(0, 30)}...` : '新增備註'}
                      >
                        <StickyNote className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedPlanForHistory(plan);
                          loadPriceHistory(plan);
                          setShowPriceHistoryDialog(true);
                        }}
                        className="p-2 text-[var(--muted)] hover:text-green-600 transition-colors"
                        title="價格歷史"
                      >
                        <LineChart className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openCompareDialog(plan)}
                        className="p-2 text-[var(--muted)] hover:text-blue-600 transition-colors"
                        title="競品比較"
                      >
                        <Scale className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(plan)}
                        className="p-2 text-[var(--muted)] hover:text-[var(--danger)] transition-colors"
                        title="刪除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>

          {filteredPlans.length === 0 && (
            <div className="text-center py-12 text-[var(--muted)]">
              沒有符合條件的資料
            </div>
          )}
        </div>
      </div>

      {/* Edit Panel */}
      {(editingPlan || isNewPlan) && (
        <EditPanel
          plan={editingPlan}
          onClose={() => {
            setEditingPlan(null);
            setIsNewPlan(false);
            loadPlans();
          }}
          isNew={isNewPlan}
        />
      )}

      {/* 批量標籤編輯對話框 */}
      {showBatchTagDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Tags className="w-5 h-5 text-purple-600" />
                批量標籤編輯
              </h3>
              <button
                onClick={() => setShowBatchTagDialog(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              已選取 {selectedIds.length} 個方案
            </p>

            {/* 模式切換 */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setBatchTagMode('add')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  batchTagMode === 'add'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                新增標籤
              </button>
              <button
                onClick={() => setBatchTagMode('remove')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  batchTagMode === 'remove'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                移除標籤
              </button>
            </div>

            {/* 標籤輸入 */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={batchTagInput}
                onChange={(e) => setBatchTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && batchTagInput.trim()) {
                    if (batchTagMode === 'add') {
                      handleBatchTagAdd(batchTagInput);
                    } else {
                      handleBatchTagRemove(batchTagInput);
                    }
                  }
                }}
                placeholder="輸入標籤名稱..."
                className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                autoFocus
              />
              <button
                onClick={() => {
                  if (batchTagMode === 'add') {
                    handleBatchTagAdd(batchTagInput);
                  } else {
                    handleBatchTagRemove(batchTagInput);
                  }
                }}
                disabled={!batchTagInput.trim() || isBatchProcessing}
                className={`px-4 py-2 rounded-lg text-white font-medium disabled:opacity-50 ${
                  batchTagMode === 'add' ? 'bg-green-600' : 'bg-red-600'
                }`}
              >
                {batchTagMode === 'add' ? '新增' : '移除'}
              </button>
            </div>

            {/* 常用標籤快捷 */}
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-2">
                {batchTagMode === 'add' ? '快速新增:' : '快速移除:'}
              </p>
              <div className="flex flex-wrap gap-1">
                {(batchTagMode === 'add'
                  ? COMMON_TAGS.filter(t => !getSelectedPlansTags.common.includes(t))
                  : getSelectedPlansTags.all
                ).slice(0, 12).map((tag) => (
                  <button
                    key={tag}
                    onClick={() => {
                      if (batchTagMode === 'add') {
                        handleBatchTagAdd(tag);
                      } else {
                        handleBatchTagRemove(tag);
                      }
                    }}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      batchTagMode === 'add'
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                    }`}
                  >
                    {batchTagMode === 'add' ? '+' : '−'} {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* 目前共同標籤 */}
            {getSelectedPlansTags.common.length > 0 && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-2">所有選取項目共有的標籤:</p>
                <div className="flex flex-wrap gap-1">
                  {getSelectedPlansTags.common.map((tag) => (
                    <span key={tag} className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowBatchTagDialog(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                完成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 變更歷史面板 */}
      {showHistoryPanel && (
        <div className="fixed top-16 right-4 w-80 max-h-[70vh] bg-white rounded-xl shadow-xl border border-gray-200 z-40 overflow-hidden">
          <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2">
              <History className="w-4 h-4" />
              變更歷史
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (window.confirm('確定要清除所有歷史記錄嗎？')) {
                    setChangeHistory([]);
                    localStorage.removeItem('admin-change-history');
                  }
                }}
                className="text-xs text-gray-500 hover:text-red-600"
              >
                清除
              </button>
              <button
                onClick={() => setShowHistoryPanel(false)}
                className="p-1 hover:bg-gray-200 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="overflow-y-auto max-h-[calc(70vh-60px)]">
            {changeHistory.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">尚無變更記錄</p>
              </div>
            ) : (
              <div className="divide-y">
                {changeHistory.map((record) => (
                  <div key={record.id} className="p-3 hover:bg-gray-50">
                    <div className="flex items-start gap-2">
                      <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                        record.action === 'publish' ? 'bg-green-500' :
                        record.action === 'unpublish' ? 'bg-gray-400' :
                        record.action === 'delete' ? 'bg-red-500' :
                        record.action === 'create' ? 'bg-blue-500' : 'bg-yellow-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{record.planTitle}</p>
                        <p className="text-xs text-gray-500">
                          {record.action === 'publish' && '上架'}
                          {record.action === 'unpublish' && '下架'}
                          {record.action === 'delete' && '刪除'}
                          {record.action === 'create' && '新增'}
                          {record.action === 'update' && '更新'}
                          {record.changes && ` - ${record.changes}`}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {record.timestamp.toLocaleString('zh-TW')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 鍵盤快捷鍵提示 */}
      <div className="fixed bottom-4 left-4 text-xs text-gray-400 space-y-1">
        <p>Ctrl+A: 全選 | Ctrl+N: 新增 | Esc: 取消 | Del: 刪除</p>
      </div>

      {/* 資料驗證報告對話框 */}
      {showValidationReport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] overflow-hidden">
            <div className="p-4 border-b bg-yellow-50 flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-yellow-600" />
                資料驗證報告
                <span className="text-sm font-normal text-gray-500">
                  ({validationIssues.length} 個待處理)
                </span>
              </h3>
              <button onClick={() => setShowValidationReport(false)} className="p-1 hover:bg-yellow-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[calc(85vh-120px)]">
              {validationIssues.length === 0 ? (
                <div className="p-12 text-center text-gray-400">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
                  <p className="font-medium text-green-600">所有資料皆已完整！</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left">方案</th>
                      <th className="px-4 py-2 text-left w-24">完整度</th>
                      <th className="px-4 py-2 text-left">缺少欄位</th>
                      <th className="px-4 py-2 text-right w-20">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {validationIssues.map((item) => (
                      <tr key={item.plan.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="text-xs text-gray-500">{item.plan.vendorName}</p>
                          <p className="font-medium truncate max-w-[200px]">{item.plan.title}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-12 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  item.score >= 80 ? 'bg-green-500' :
                                  item.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${item.score}%` }}
                              />
                            </div>
                            <span className={`text-xs font-medium ${
                              item.score >= 80 ? 'text-green-600' :
                              item.score >= 50 ? 'text-yellow-600' : 'text-red-600'
                            }`}>{item.score}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {item.missing.map((field) => (
                              <span key={field} className="px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded">
                                {field}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => {
                              setEditingPlan(item.plan);
                              setIsNewPlan(false);
                              setShowValidationReport(false);
                            }}
                            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            編輯
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-end">
              <button
                onClick={() => setShowValidationReport(false)}
                className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 統計儀表板面板 */}
      {showStatsPanel && statistics && (
        <div className="fixed top-16 right-4 w-96 max-h-[85vh] bg-white rounded-xl shadow-xl border border-gray-200 z-40 overflow-hidden">
          <div className="p-4 border-b bg-indigo-50 flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
              統計儀表板
            </h3>
            <button onClick={() => setShowStatsPanel(false)} className="p-1 hover:bg-indigo-100 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="overflow-y-auto max-h-[calc(85vh-60px)] p-4 space-y-4">
            {/* 價格統計 */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                <DollarSign className="w-4 h-4" /> 價格統計
              </h4>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xs text-gray-500">平均</p>
                  <p className="font-bold text-green-600">${statistics.avgPrice.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">最低</p>
                  <p className="font-bold text-blue-600">${statistics.minPrice.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">最高</p>
                  <p className="font-bold text-red-600">${statistics.maxPrice.toLocaleString()}</p>
                </div>
              </div>
              <div className="mt-3 space-y-1">
                {Object.entries(statistics.priceRanges).map(([range, count]) => (
                  <div key={range} className="flex items-center gap-2 text-xs">
                    <span className="w-20 text-gray-600">${range}</span>
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full"
                        style={{ width: `${plans.length > 0 ? (count / plans.length) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-gray-600">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 份量統計 */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-2">份量分布</h4>
              <div className="grid grid-cols-4 gap-2 text-center">
                {Object.entries(statistics.servingRanges).map(([range, count]) => (
                  <div key={range} className="p-2 bg-white rounded border">
                    <p className="text-xs text-gray-500">{range}</p>
                    <p className="font-bold text-indigo-600">{count}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 供應方式統計 */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                <Truck className="w-4 h-4" /> 供應方式
              </h4>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-blue-50 rounded">
                  <p className="text-xs text-gray-500">宅配</p>
                  <p className="font-bold text-blue-600">{statistics.shippingStats.delivery}</p>
                </div>
                <div className="p-2 bg-green-50 rounded">
                  <p className="text-xs text-gray-500">自取</p>
                  <p className="font-bold text-green-600">{statistics.shippingStats.pickup}</p>
                </div>
                <div className="p-2 bg-purple-50 rounded">
                  <p className="text-xs text-gray-500">皆可</p>
                  <p className="font-bold text-purple-600">{statistics.shippingStats.both}</p>
                </div>
              </div>
            </div>

            {/* 完整度統計 */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-2">資料完整度</h4>
              <div className="grid grid-cols-4 gap-2 text-center">
                {Object.entries(statistics.completenessRanges).map(([range, count]) => (
                  <div key={range} className={`p-2 rounded ${
                    range === '100%' ? 'bg-green-50' :
                    range === '80-99%' ? 'bg-blue-50' :
                    range === '50-79%' ? 'bg-yellow-50' : 'bg-red-50'
                  }`}>
                    <p className="text-xs text-gray-500">{range}</p>
                    <p className={`font-bold ${
                      range === '100%' ? 'text-green-600' :
                      range === '80-99%' ? 'text-blue-600' :
                      range === '50-79%' ? 'text-yellow-600' : 'text-red-600'
                    }`}>{count}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 熱門標籤 */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-2">熱門標籤 Top 10</h4>
              <div className="space-y-1">
                {statistics.topTags.map(([tag, count], idx) => (
                  <div key={tag} className="flex items-center gap-2 text-xs">
                    <span className="w-4 text-gray-400">{idx + 1}</span>
                    <span className="flex-1 truncate">{tag}</span>
                    <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full"
                        style={{ width: `${plans.length > 0 ? (count / plans.length) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="w-6 text-right text-gray-600">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 批量欄位編輯對話框 */}
      {showBatchFieldDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-600" />
                批量欄位編輯
              </h3>
              <button onClick={() => setShowBatchFieldDialog(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">已選取 {selectedIds.length} 個方案</p>

            {/* 欄位類型選擇 */}
            <div className="flex flex-wrap gap-2 mb-4">
              {[
                { key: 'price', label: '價格', icon: <DollarSign className="w-3 h-3" /> },
                { key: 'region', label: '地區', icon: <MapPin className="w-3 h-3" /> },
                { key: 'shippingType', label: '供應方式', icon: <Truck className="w-3 h-3" /> },
                { key: 'storageType', label: '保存方式', icon: <Filter className="w-3 h-3" /> },
                { key: 'deadline', label: '截止日', icon: <Calendar className="w-3 h-3" /> },
              ].map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => {
                    setBatchFieldType(key as any);
                    setBatchFieldValue('');
                  }}
                  className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    batchFieldType === key
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  {icon} {label}
                </button>
              ))}
            </div>

            {/* 價格模式選擇 */}
            {batchFieldType === 'price' && (
              <div className="flex gap-2 mb-4">
                {[
                  { key: 'set', label: '設定為' },
                  { key: 'adjust', label: '調整 (+/-)' },
                  { key: 'percent', label: '百分比 (%)' },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setBatchPriceMode(key as any)}
                    className={`flex-1 py-2 text-sm rounded-lg transition-colors ${
                      batchPriceMode === key
                        ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                        : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* 輸入欄位 */}
            <div className="mb-4">
              {batchFieldType === 'price' && (
                <input
                  type="number"
                  value={batchFieldValue}
                  onChange={(e) => setBatchFieldValue(e.target.value)}
                  placeholder={
                    batchPriceMode === 'set' ? '輸入新價格' :
                    batchPriceMode === 'adjust' ? '輸入調整金額 (可為負數)' :
                    '輸入百分比 (如 -10 為打九折)'
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              )}
              {batchFieldType === 'region' && (
                <select
                  value={batchFieldValue as string}
                  onChange={(e) => setBatchFieldValue(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">選擇地區</option>
                  {Object.entries(REGION_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              )}
              {batchFieldType === 'shippingType' && (
                <select
                  value={batchFieldValue as string}
                  onChange={(e) => setBatchFieldValue(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">選擇供應方式</option>
                  <option value="delivery">宅配</option>
                  <option value="pickup">自取</option>
                  <option value="both">皆可</option>
                </select>
              )}
              {batchFieldType === 'storageType' && (
                <select
                  value={batchFieldValue as string}
                  onChange={(e) => setBatchFieldValue(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">選擇保存方式</option>
                  <option value="frozen">冷凍</option>
                  <option value="chilled">冷藏</option>
                  <option value="room_temp">常溫</option>
                </select>
              )}
              {batchFieldType === 'deadline' && (
                <input
                  type="date"
                  value={batchFieldValue as string}
                  onChange={(e) => setBatchFieldValue(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowBatchFieldDialog(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={handleBatchFieldUpdate}
                disabled={batchFieldValue === '' || isBatchProcessing}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                套用到 {selectedIds.length} 個方案
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 資料品質面板 */}
      {showQualityPanel && (
        <div className="fixed top-16 right-4 w-96 max-h-[85vh] bg-white rounded-xl shadow-xl border border-gray-200 z-40 overflow-hidden">
          <div className="p-4 border-b bg-emerald-50 flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              資料品質檢查
            </h3>
            <button onClick={() => setShowQualityPanel(false)} className="p-1 hover:bg-emerald-100 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="overflow-y-auto max-h-[calc(85vh-60px)] p-4 space-y-4">
            {/* 總覽 */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 bg-gray-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-gray-700">{qualitySummary.total}</p>
                <p className="text-xs text-gray-500">總方案數</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-600">
                  {plans.filter(p => getCompleteness(p).score === 100).length}
                </p>
                <p className="text-xs text-gray-500">完整資料</p>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-yellow-600">{qualitySummary.lowCompleteness}</p>
                <p className="text-xs text-gray-500">待完善</p>
              </div>
            </div>

            {/* 問題列表 */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">問題項目</h4>

              {/* 重複方案 */}
              <button
                onClick={() => setShowDuplicatesPanel(true)}
                className={`w-full p-3 rounded-lg text-left flex items-center justify-between transition-colors ${
                  qualitySummary.duplicateGroups > 0
                    ? 'bg-red-50 hover:bg-red-100'
                    : 'bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Merge className={`w-4 h-4 ${qualitySummary.duplicateGroups > 0 ? 'text-red-600' : 'text-gray-400'}`} />
                  <span className="text-sm">重複/相似方案</span>
                </div>
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  qualitySummary.duplicateGroups > 0
                    ? 'bg-red-200 text-red-700'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {qualitySummary.duplicateGroups} 組
                </span>
              </button>

              {/* 無標籤 */}
              <div className={`p-3 rounded-lg flex items-center justify-between ${
                qualitySummary.noTags > 0 ? 'bg-orange-50' : 'bg-gray-50'
              }`}>
                <div className="flex items-center gap-2">
                  <Tag className={`w-4 h-4 ${qualitySummary.noTags > 0 ? 'text-orange-600' : 'text-gray-400'}`} />
                  <span className="text-sm">無標籤</span>
                </div>
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  qualitySummary.noTags > 0 ? 'bg-orange-200 text-orange-700' : 'bg-gray-200 text-gray-600'
                }`}>
                  {qualitySummary.noTags}
                </span>
              </div>

              {/* 無菜色 */}
              <div className={`p-3 rounded-lg flex items-center justify-between ${
                qualitySummary.noDishes > 0 ? 'bg-orange-50' : 'bg-gray-50'
              }`}>
                <div className="flex items-center gap-2">
                  <FileX className={`w-4 h-4 ${qualitySummary.noDishes > 0 ? 'text-orange-600' : 'text-gray-400'}`} />
                  <span className="text-sm">無菜色內容</span>
                </div>
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  qualitySummary.noDishes > 0 ? 'bg-orange-200 text-orange-700' : 'bg-gray-200 text-gray-600'
                }`}>
                  {qualitySummary.noDishes}
                </span>
              </div>

              {/* 無圖片 */}
              <div className={`p-3 rounded-lg flex items-center justify-between ${
                qualitySummary.noImage > 0 ? 'bg-yellow-50' : 'bg-gray-50'
              }`}>
                <div className="flex items-center gap-2">
                  <Image className={`w-4 h-4 ${qualitySummary.noImage > 0 ? 'text-yellow-600' : 'text-gray-400'}`} />
                  <span className="text-sm">無圖片</span>
                </div>
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  qualitySummary.noImage > 0 ? 'bg-yellow-200 text-yellow-700' : 'bg-gray-200 text-gray-600'
                }`}>
                  {qualitySummary.noImage}
                </span>
              </div>

              {/* 無效圖片 */}
              <div className={`p-3 rounded-lg flex items-center justify-between ${
                qualitySummary.invalidImages > 0 ? 'bg-red-50' : 'bg-gray-50'
              }`}>
                <div className="flex items-center gap-2">
                  <FileWarning className={`w-4 h-4 ${qualitySummary.invalidImages > 0 ? 'text-red-600' : 'text-gray-400'}`} />
                  <span className="text-sm">無效圖片</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-xs rounded-full ${
                    qualitySummary.invalidImages > 0 ? 'bg-red-200 text-red-700' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {qualitySummary.invalidImages}
                  </span>
                  <button
                    onClick={handleValidateAllImages}
                    disabled={isValidatingImages}
                    className="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded disabled:opacity-50"
                  >
                    {isValidatingImages ? <Loader className="w-3 h-3 animate-spin" /> : '驗證'}
                  </button>
                </div>
              </div>
            </div>

            {/* 智慧標籤建議 */}
            <div className="p-3 bg-purple-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                智慧標籤建議
              </h4>
              <p className="text-xs text-gray-500 mb-2">
                根據菜色內容自動建議標籤，點擊方案使用此功能
              </p>
              <div className="flex flex-wrap gap-1">
                {plans.filter(p => p.tags.length === 0).slice(0, 5).map(plan => (
                  <button
                    key={plan.id}
                    onClick={() => handleAISuggestTags(plan)}
                    className="px-2 py-1 text-xs bg-white border rounded hover:bg-purple-100"
                  >
                    {plan.vendorName}
                  </button>
                ))}
                {plans.filter(p => p.tags.length === 0).length > 5 && (
                  <span className="px-2 py-1 text-xs text-gray-400">
                    +{plans.filter(p => p.tags.length === 0).length - 5} 個
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 重複方案面板 */}
      {showDuplicatesPanel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[85vh] overflow-hidden">
            <div className="p-4 border-b bg-red-50 flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Merge className="w-5 h-5 text-red-600" />
                重複/相似方案
                <span className="text-sm font-normal text-gray-500">
                  ({duplicatePlans.length} 組)
                </span>
              </h3>
              <button onClick={() => setShowDuplicatesPanel(false)} className="p-1 hover:bg-red-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[calc(85vh-120px)] p-4">
              {duplicatePlans.length === 0 ? (
                <div className="p-12 text-center text-gray-400">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
                  <p className="font-medium text-green-600">沒有發現重複或相似的方案！</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {duplicatePlans.map((group, idx) => (
                    <div key={idx} className="border rounded-lg overflow-hidden">
                      <div className="p-3 bg-gray-50 flex items-center justify-between">
                        <span className="text-sm font-medium flex items-center gap-2">
                          <span className={`px-2 py-0.5 text-xs rounded ${
                            group.reason === '相同網址' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {group.reason}
                          </span>
                          {group.plans.length} 個相似方案
                        </span>
                      </div>
                      <div className="divide-y">
                        {group.plans.map((plan) => (
                          <div key={plan.id} className="p-3 flex items-center justify-between hover:bg-gray-50">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-gray-500">{plan.vendorName}</p>
                              <p className="font-medium truncate">{plan.title}</p>
                              <p className="text-xs text-gray-400 truncate">{plan.sourceUrl}</p>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                              <span className="text-sm font-medium text-green-600">
                                ${plan.priceDiscount?.toLocaleString()}
                              </span>
                              <button
                                onClick={() => {
                                  setEditingPlan(plan);
                                  setIsNewPlan(false);
                                  setShowDuplicatesPanel(false);
                                }}
                                className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                              >
                                編輯
                              </button>
                              <button
                                onClick={() => handleDelete(plan)}
                                className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                              >
                                刪除
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-end">
              <button
                onClick={() => setShowDuplicatesPanel(false)}
                className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 智慧標籤建議對話框 */}
      {showTagSuggestions && tagSuggestionsForPlan && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                智慧標籤建議
              </h3>
              <button
                onClick={() => {
                  setShowTagSuggestions(false);
                  setTagSuggestionsForPlan(null);
                  setSuggestedTags([]);
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-500">{tagSuggestionsForPlan.vendorName}</p>
              <p className="font-medium">{tagSuggestionsForPlan.title}</p>
            </div>

            {/* 現有標籤 */}
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-2">現有標籤</p>
              <div className="flex flex-wrap gap-1">
                {tagSuggestionsForPlan.tags.length > 0 ? (
                  tagSuggestionsForPlan.tags.map(tag => (
                    <span key={tag} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-gray-400">尚無標籤</span>
                )}
              </div>
            </div>

            {/* 建議標籤 */}
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-2">建議標籤 (點擊套用)</p>
              {isGeneratingTags ? (
                <div className="flex items-center gap-2 text-gray-400">
                  <Loader className="w-4 h-4 animate-spin" />
                  <span className="text-sm">分析中...</span>
                </div>
              ) : suggestedTags.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {suggestedTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => handleApplySuggestedTag(tag)}
                      className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-gray-400">無建議標籤</span>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowTagSuggestions(false);
                  setTagSuggestionsForPlan(null);
                  setSuggestedTags([]);
                }}
                className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                完成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* B1: 匯入 CSV 對話框 */}
      {showImportDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Upload className="w-5 h-5 text-green-600" />
                匯入 CSV 資料
              </h3>
              <button
                onClick={() => {
                  setShowImportDialog(false);
                  setImportData('');
                  setImportErrors([]);
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-500 mb-2">
                請上傳 CSV 檔案或貼上 CSV 內容。格式請參考範本。
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                      setImportData(e.target?.result as string);
                    };
                    reader.readAsText(file);
                  }
                }}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-green-50 file:text-green-700 hover:file:bg-green-100 mb-2"
              />
              <textarea
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                placeholder="或直接貼上 CSV 內容..."
                className="w-full h-40 p-3 border rounded-lg font-mono text-xs"
              />
            </div>

            {importErrors.length > 0 && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-medium text-red-700 mb-1">匯入錯誤：</p>
                <ul className="text-xs text-red-600 list-disc list-inside">
                  {importErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={exportTemplate}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                下載範本
              </button>
              <button
                onClick={() => {
                  setShowImportDialog(false);
                  setImportData('');
                  setImportErrors([]);
                }}
                className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                取消
              </button>
              <button
                onClick={handleImportCSV}
                disabled={!importData.trim() || isImporting}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {isImporting ? '匯入中...' : '開始匯入'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* B1: 備份/還原對話框 */}
      {showBackupDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-600" />
                資料備份與還原
              </h3>
              <button
                onClick={() => setShowBackupDialog(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">備份資料</h4>
                <p className="text-sm text-blue-700 mb-3">
                  匯出所有方案資料為 JSON 格式，可用於備份或遷移。
                </p>
                <button
                  onClick={() => {
                    exportBackup();
                    setShowBackupDialog(false);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Save className="w-4 h-4" />
                  下載備份檔
                </button>
              </div>

              <div className="p-4 bg-orange-50 rounded-lg">
                <h4 className="font-medium text-orange-900 mb-2">還原資料</h4>
                <p className="text-sm text-orange-700 mb-3">
                  從備份檔還原資料。注意：這將覆蓋現有資料！
                </p>
                <input
                  type="file"
                  accept=".json"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (e) => {
                        try {
                          const data = JSON.parse(e.target?.result as string);
                          handleRestoreBackup(data);
                          setShowBackupDialog(false);
                        } catch {
                          alert('無法解析備份檔案');
                        }
                      };
                      reader.readAsText(file);
                    }
                  }}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-orange-100 file:text-orange-700 hover:file:bg-orange-200"
                />
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowBackupDialog(false)}
                className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}

      {/* B2: 自動清理設定對話框 */}
      {showAutoCleanDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Timer className="w-5 h-5 text-orange-600" />
                自動清理設定
              </h3>
              <button
                onClick={() => setShowAutoCleanDialog(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="autoCleanEnabled"
                  checked={autoCleanSettings.enabled}
                  onChange={(e) => setAutoCleanSettings(prev => ({ ...prev, enabled: e.target.checked }))}
                  className="w-4 h-4 text-orange-600 rounded"
                />
                <label htmlFor="autoCleanEnabled" className="text-sm font-medium">
                  啟用自動清理
                </label>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    過期天數閾值
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={autoCleanSettings.daysBeforeExpiry}
                      onChange={(e) => setAutoCleanSettings(prev => ({ ...prev, daysBeforeExpiry: parseInt(e.target.value) || 0 }))}
                      className="w-20 px-3 py-2 border rounded-lg"
                      min="0"
                    />
                    <span className="text-sm text-gray-500">天前過期的方案</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    處理方式
                  </label>
                  <select
                    value={autoCleanSettings.action}
                    onChange={(e) => setAutoCleanSettings(prev => ({ ...prev, action: e.target.value as 'unpublish' | 'delete' }))}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="unpublish">下架 (保留資料)</option>
                    <option value="delete">刪除 (永久移除)</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-700">
                  提示：設定 0 天表示處理所有已過期的方案。正數表示提前幾天處理。
                </p>
              </div>
            </div>

            <div className="flex justify-between mt-4">
              <button
                onClick={handleAutoClean}
                className="flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200"
              >
                <RefreshCw className="w-4 h-4" />
                立即執行
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAutoCleanDialog(false)}
                  className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    saveAutoCleanSettings(autoCleanSettings);
                    setShowAutoCleanDialog(false);
                  }}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                >
                  儲存設定
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* B4: 操作日誌面板 */}
      {showActivityLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-600" />
                操作日誌
              </h3>
              <button
                onClick={() => setShowActivityLog(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4">
              {activityLog.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>尚無操作記錄</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activityLog.map((log, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className={`p-2 rounded-full ${
                        log.action === 'create' ? 'bg-green-100 text-green-600' :
                        log.action === 'update' ? 'bg-blue-100 text-blue-600' :
                        log.action === 'delete' ? 'bg-red-100 text-red-600' :
                        log.action === 'import' ? 'bg-purple-100 text-purple-600' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {log.action === 'create' && <Plus className="w-4 h-4" />}
                        {log.action === 'update' && <Edit3 className="w-4 h-4" />}
                        {log.action === 'delete' && <Trash className="w-4 h-4" />}
                        {log.action === 'import' && <Upload className="w-4 h-4" />}
                        {log.action === 'export' && <FileDown className="w-4 h-4" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{log.action}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(log.timestamp).toLocaleString('zh-TW')}
                        </p>
                        {log.detail && (
                          <p className="text-xs text-gray-400 mt-1">{log.detail}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-between p-4 border-t">
              <button
                onClick={() => {
                  if (confirm('確定要清除所有日誌嗎？')) {
                    setActivityLog([]);
                    localStorage.removeItem('ny-admin-activity-log');
                  }
                }}
                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
              >
                清除日誌
              </button>
              <button
                onClick={() => setShowActivityLog(false)}
                className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}

      {/* B4: 方案備註對話框 */}
      {showNotesDialog && editingNotePlanId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <StickyNote className="w-5 h-5 text-yellow-500" />
                方案備註
              </h3>
              <button
                onClick={() => {
                  setShowNotesDialog(false);
                  setEditingNotePlanId(null);
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-500 mb-2">
                {plans.find(p => p.id === editingNotePlanId)?.title || '未知方案'}
              </p>
              <textarea
                value={planNotes[editingNotePlanId] || ''}
                onChange={(e) => setPlanNotes(prev => ({ ...prev, [editingNotePlanId]: e.target.value }))}
                placeholder="在此輸入備註..."
                className="w-full h-32 p-3 border rounded-lg resize-none"
              />
            </div>

            <div className="flex justify-end gap-2">
              {planNotes[editingNotePlanId] && (
                <button
                  onClick={() => {
                    const newNotes = { ...planNotes };
                    delete newNotes[editingNotePlanId];
                    setPlanNotes(newNotes);
                    setShowNotesDialog(false);
                    setEditingNotePlanId(null);
                  }}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  刪除備註
                </button>
              )}
              <button
                onClick={() => {
                  setShowNotesDialog(false);
                  setEditingNotePlanId(null);
                }}
                className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                取消
              </button>
              <button
                onClick={() => {
                  savePlanNote(editingNotePlanId, planNotes[editingNotePlanId] || '');
                  setShowNotesDialog(false);
                  setEditingNotePlanId(null);
                }}
                className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
              >
                儲存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* B3: 批量圖片對話框 */}
      {showBulkImageDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Image className="w-5 h-5 text-cyan-600" />
                批量設定圖片
              </h3>
              <button
                onClick={() => {
                  setShowBulkImageDialog(false);
                  setBulkImageUrls('');
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-500 mb-2">
                已選取 {selectedIds.length} 個方案。輸入圖片網址 (每行一個)，會循環分配給選取的方案。
              </p>
              <textarea
                value={bulkImageUrls}
                onChange={(e) => setBulkImageUrls(e.target.value)}
                placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg&#10;..."
                className="w-full h-40 p-3 border rounded-lg font-mono text-xs"
              />
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
              <p className="text-sm text-blue-700">
                提示：如果圖片數量少於方案數量，會循環使用圖片。
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowBulkImageDialog(false);
                  setBulkImageUrls('');
                }}
                className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                取消
              </button>
              <button
                onClick={handleBulkImageUpdate}
                disabled={!bulkImageUrls.trim() || isBatchProcessing}
                className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50"
              >
                {isBatchProcessing ? '處理中...' : '套用圖片'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* D1: AI 自動分類對話框 */}
      {showAIClassifyDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-600" />
                AI 自動分類
              </h3>
              <button
                onClick={() => setShowAIClassifyDialog(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4">
              {isClassifying ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader className="w-8 h-8 animate-spin text-purple-600 mb-4" />
                  <p className="text-gray-500">正在分析 {plans.length} 個方案...</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {plans.map(plan => {
                    const result = classifyResults[plan.id];
                    if (!result) return null;
                    return (
                      <div key={plan.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{plan.title}</p>
                          <p className="text-xs text-gray-500">{plan.vendorName}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 text-xs rounded ${result.confidence > 50 ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                            {result.category}
                          </span>
                          <span className="text-xs text-gray-400">{result.confidence}%</span>
                          {result.keywords.length > 0 && (
                            <span className="text-xs text-gray-400">
                              ({result.keywords.slice(0, 3).join(', ')})
                            </span>
                          )}
                          {result.category !== '未分類' && !plan.tags?.includes(result.category) && (
                            <button
                              onClick={() => applyClassification(plan.id, result.category)}
                              className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700"
                            >
                              套用
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-between p-4 border-t">
              <button
                onClick={handleAIClassify}
                disabled={isClassifying}
                className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4" />
                重新分析
              </button>
              <button
                onClick={() => setShowAIClassifyDialog(false)}
                className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}

      {/* D2: 價格歷史對話框 */}
      {showPriceHistoryDialog && selectedPlanForHistory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <LineChart className="w-5 h-5 text-green-600" />
                價格歷史趨勢
              </h3>
              <button
                onClick={() => {
                  setShowPriceHistoryDialog(false);
                  setSelectedPlanForHistory(null);
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              <p className="font-medium">{selectedPlanForHistory.title}</p>
              <p className="text-sm text-gray-500">{selectedPlanForHistory.vendorName}</p>
            </div>

            {/* 簡易價格圖表 */}
            <div className="h-48 bg-gray-50 rounded-lg p-4 mb-4">
              <div className="flex items-end justify-between h-full gap-1">
                {priceHistory.slice(-14).map((item, index) => {
                  const maxPrice = Math.max(...priceHistory.map(p => p.price));
                  const minPrice = Math.min(...priceHistory.map(p => p.price));
                  const range = maxPrice - minPrice || 1;
                  const height = ((item.price - minPrice) / range) * 100;
                  const isLast = index === priceHistory.slice(-14).length - 1;
                  return (
                    <div key={item.date} className="flex-1 flex flex-col items-center">
                      <div
                        className={`w-full rounded-t ${isLast ? 'bg-green-500' : 'bg-green-300'}`}
                        style={{ height: `${Math.max(height, 5)}%` }}
                        title={`${item.date}: $${item.price.toLocaleString()}`}
                      />
                      <span className="text-[8px] text-gray-400 mt-1">{item.date.slice(-5)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">最低價</p>
                <p className="text-lg font-bold text-green-600">
                  ${Math.min(...priceHistory.map(p => p.price)).toLocaleString()}
                </p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">最高價</p>
                <p className="text-lg font-bold text-red-600">
                  ${Math.max(...priceHistory.map(p => p.price)).toLocaleString()}
                </p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">目前價</p>
                <p className="text-lg font-bold">
                  ${(selectedPlanForHistory.priceDiscount || selectedPlanForHistory.priceOriginal || 0).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => {
                  setShowPriceHistoryDialog(false);
                  setSelectedPlanForHistory(null);
                }}
                className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}

      {/* D3: 競品比較對話框 */}
      {showCompareDialog && comparePlans.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Scale className="w-5 h-5 text-blue-600" />
                競品比較 (共 {comparePlans.length} 個方案)
              </h3>
              <button
                onClick={() => setShowCompareDialog(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="p-3 text-left font-medium">方案名稱</th>
                      <th className="p-3 text-left font-medium">廠商</th>
                      <th className="p-3 text-right font-medium">原價</th>
                      <th className="p-3 text-right font-medium">特價</th>
                      <th className="p-3 text-right font-medium">折扣</th>
                      <th className="p-3 text-center font-medium">人數</th>
                      <th className="p-3 text-left font-medium">標籤</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparePlans.map((plan, index) => {
                      const discount = plan.priceOriginal && plan.priceDiscount
                        ? Math.round((1 - plan.priceDiscount / plan.priceOriginal) * 100)
                        : 0;
                      return (
                        <tr key={plan.id} className={index === 0 ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              {index === 0 && <span className="text-xs bg-blue-600 text-white px-1 rounded">主</span>}
                              <span className="truncate max-w-[200px]">{plan.title}</span>
                            </div>
                          </td>
                          <td className="p-3 text-gray-600">{plan.vendorName}</td>
                          <td className="p-3 text-right text-gray-400 line-through">
                            ${plan.priceOriginal?.toLocaleString() || '-'}
                          </td>
                          <td className="p-3 text-right font-bold text-green-600">
                            ${plan.priceDiscount?.toLocaleString() || '-'}
                          </td>
                          <td className="p-3 text-right">
                            {discount > 0 && <span className="text-red-600">-{discount}%</span>}
                          </td>
                          <td className="p-3 text-center">{plan.servingsMin || '-'}</td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1">
                              {(plan.tags || []).slice(0, 3).map(tag => (
                                <span key={tag} className="px-1 py-0.5 text-xs bg-gray-100 rounded">{tag}</span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end p-4 border-t">
              <button
                onClick={() => setShowCompareDialog(false)}
                className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}

      {/* D4: 缺貨預警對話框 */}
      {showStockAlertDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <PackageX className="w-5 h-5 text-red-600" />
                缺貨預警
              </h3>
              <button
                onClick={() => setShowStockAlertDialog(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {stockAlerts.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-400" />
                <p>目前沒有缺貨方案</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-auto">
                {stockAlerts.map((alert, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <PackageX className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{alert.planTitle}</p>
                      <p className="text-xs text-red-600">狀態: {alert.status}</p>
                    </div>
                    <button
                      onClick={() => {
                        const plan = plans.find(p => p.id === alert.planId);
                        if (plan) {
                          setEditingPlan(plan);
                          setIsNewPlan(false);
                          setShowStockAlertDialog(false);
                        }
                      }}
                      className="text-xs px-2 py-1 bg-white border border-red-300 text-red-600 rounded hover:bg-red-50"
                    >
                      編輯
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between mt-4 pt-4 border-t">
              <button
                onClick={checkStockStatus}
                className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
              >
                <RefreshCw className="w-4 h-4" />
                重新檢查
              </button>
              <button
                onClick={() => setShowStockAlertDialog(false)}
                className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
