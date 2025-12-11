'use client';

import { useState, useEffect, useRef, Fragment, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  Chip,
  Alert,
  LinearProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Collapse,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  ToggleButtonGroup,
  ToggleButton,
  Snackbar,
  Tabs,
  Tab,
} from '@mui/material';
import {
  ArrowLeft,
  Play,
  Trash2,
  Loader,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  StopCircle,
  Copy,
  Database,
  Zap,
  Download,
  Filter,
  FileText,
  Code,
  Image,
  ScanText,
  CheckSquare,
  Square,
  Eye,
  Sparkles,
  Upload,
  Edit3,
  RotateCcw,
  Save,
  FolderOpen,
  Calendar,
  GitCompare,
  Bookmark,
  Timer,
  PlayCircle,
  PauseCircle,
  BarChart3,
  Building2,
  AlertTriangle,
  ArrowLeftRight,
  Settings2,
  TrendingUp,
  TrendingDown,
  Bell,
  BellRing,
  Activity,
  LineChart,
  Radio,
  CircleDot,
  History,
  Globe,
  ListOrdered,
  RotateCw,
  FileDown,
  Layers,
  Gauge,
  FileJson,
  FileText as FileTextIcon,
  FileSpreadsheet,
  PieChart,
  BarChart2,
  Webhook,
  Server,
  Shield,
  Network,
  Diff,
  CalendarClock,
  SendHorizonal,
  Plus,
  X,
} from 'lucide-react';
import {
  createScraperJob,
  updateScraperJob,
  getAllScraperJobs,
  getScraperStats,
  deleteScraperJob,
  clearAllScraperJobs,
} from '@/lib/db';
import { usePlanStore } from '@/stores/planStore';
import type { ScraperJob, ScraperJobStatus, ScraperLogEntry, Plan, PriceHistory, PriceChangeEvent, MonitorTask, Notification } from '@/types';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';

const statusConfig: Record<ScraperJobStatus, { label: string; color: 'default' | 'primary' | 'success' | 'error' | 'warning'; icon: React.ReactNode }> = {
  pending: { label: '等待中', color: 'default', icon: <Clock size={14} /> },
  running: { label: '執行中', color: 'primary', icon: <Loader size={14} className="animate-spin" /> },
  success: { label: '成功', color: 'success', icon: <CheckCircle size={14} /> },
  failed: { label: '失敗', color: 'error', icon: <XCircle size={14} /> },
  cancelled: { label: '已取消', color: 'warning', icon: <Clock size={14} /> },
};

type ScraperServiceType = 'jina' | 'firecrawl' | 'local' | 'crawl4ai' | 'scrapegraph';

const scraperServices: Record<ScraperServiceType, { name: string; description: string; speed: string }> = {
  jina: { name: 'Jina AI', description: '免費穩定', speed: '快' },
  firecrawl: { name: 'Firecrawl', description: '需 API Key', speed: '快' },
  local: { name: 'Playwright', description: '本地瀏覽器', speed: '中' },
  crawl4ai: { name: 'Crawl4AI', description: 'Python', speed: '中' },
  scrapegraph: { name: 'ScrapeGraphAI', description: 'AI 驅動', speed: '慢' },
};

export default function ScraperPage() {
  const router = useRouter();
  const { addPlan, loadPlans, plans } = usePlanStore();
  const logsEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 輸入模式
  const [inputMode, setInputMode] = useState<'single' | 'batch'>('single');

  // 爬蟲服務（從 localStorage 讀取）
  const [selectedService, setSelectedService] = useState<ScraperServiceType>('jina');

  // 輸入
  const [singleUrl, setSingleUrl] = useState('');
  const [batchUrls, setBatchUrls] = useState('');

  // 處理狀態
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });

  // 結果
  const [result, setResult] = useState<{ success: boolean; message: string; data?: Partial<Plan> } | null>(null);

  // 統計與歷史
  const [stats, setStats] = useState<{ totalJobs: number; successJobs: number; failedJobs: number } | null>(null);
  const [jobs, setJobs] = useState<ScraperJob[]>([]);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  // 即時日誌
  const [logs, setLogs] = useState<ScraperLogEntry[]>([]);

  // 對話框
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showResultDialog, setShowResultDialog] = useState(false);

  // 過濾與通知
  const [statusFilter, setStatusFilter] = useState<ScraperJobStatus | 'all'>('all');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string }>({ open: false, message: '' });
  const [detailTab, setDetailTab] = useState<Record<string, number>>({});

  // 手動 OCR 狀態
  const [selectedImages, setSelectedImages] = useState<Record<string, Set<number>>>({});
  const [ocrProcessing, setOcrProcessing] = useState<Record<string, boolean>>({});
  const [manualOcrResult, setManualOcrResult] = useState<Record<string, string>>({});

  // 重新解析狀態
  const [reParsingJob, setReParsingJob] = useState<string | null>(null);

  // AI 視覺分析狀態
  const [visionProcessing, setVisionProcessing] = useState<Record<string, boolean>>({});
  const [selectedVisionAI, setSelectedVisionAI] = useState<'claude' | 'gemini'>('claude');
  const [imageOnlyMode, setImageOnlyMode] = useState(true); // 預設只分析圖片
  const [visionResult, setVisionResult] = useState<Record<string, { plan: Partial<Plan> & { promotions?: string[]; visibleText?: string }; raw: string; cli: string } | null>>({});

  // 圖片尺寸快取和過濾
  const [imageSizes, setImageSizes] = useState<Record<string, { w: number; h: number }>>({});
  const [minImageSize, setMinImageSize] = useState(200); // 最小尺寸過濾

  // 批次重試狀態
  const [isRetryingAll, setIsRetryingAll] = useState(false);

  // 匯入 URL 對話框
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importUrls, setImportUrls] = useState('');

  // 編輯資料對話框
  const [editingJobData, setEditingJobData] = useState<{ jobId: string; data: Partial<Plan> } | null>(null);

  // 網址來源管理
  const [showSourceManager, setShowSourceManager] = useState(false);
  const [savedSources, setSavedSources] = useState<{ id: string; name: string; urls: string[]; createdAt: Date }[]>([]);
  const [newSourceName, setNewSourceName] = useState('');

  // AI 模型比較
  const [showAICompare, setShowAICompare] = useState(false);
  const [compareJobId, setCompareJobId] = useState<string | null>(null);
  const [aiCompareResults, setAiCompareResults] = useState<{
    claude?: { plan: Partial<Plan>; raw: string };
    gemini?: { plan: Partial<Plan>; raw: string };
  }>({});
  const [aiComparing, setAiComparing] = useState(false);

  // 排程爬取
  const [schedules, setSchedules] = useState<{ id: string; name: string; urls: string[]; cron: string; enabled: boolean; lastRun?: Date }[]>([]);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [newSchedule, setNewSchedule] = useState({ name: '', urls: '', interval: 'daily' });

  // 廠商設定檔
  const [showVendorConfig, setShowVendorConfig] = useState(false);
  const [vendorConfigs, setVendorConfigs] = useState<{
    id: string;
    name: string;
    urlPattern: string;
    aiPromptHints?: string;
    defaultTags?: string[];
    enabled: boolean;
  }[]>([]);
  const [newVendorConfig, setNewVendorConfig] = useState({ name: '', urlPattern: '', aiPromptHints: '', defaultTags: '' });

  // 錯誤分析
  const [showErrorAnalytics, setShowErrorAnalytics] = useState(false);

  // 差異比對
  const [showDiffDialog, setShowDiffDialog] = useState(false);
  const [diffData, setDiffData] = useState<{
    jobId: string;
    url: string;
    newData: Partial<Plan>;
    existingData: Plan | null;
  } | null>(null);

  // 爬取結果預覽 (在加入資料庫前)
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewData, setPreviewData] = useState<{
    job: ScraperJob;
    plan: Partial<Plan>;
  } | null>(null);

  // 價格監控
  const [showMonitorPanel, setShowMonitorPanel] = useState(false);
  const [monitorTasks, setMonitorTasks] = useState<MonitorTask[]>([]);
  const [priceHistory, setPriceHistory] = useState<Record<string, PriceHistory[]>>({});
  const [priceChanges, setPriceChanges] = useState<PriceChangeEvent[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);

  // 通知系統
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // 網域規則 (進階設定)
  const [showDomainRules, setShowDomainRules] = useState(false);
  const [domainRules, setDomainRules] = useState<{
    id: string;
    domain: string;
    selectors?: { title?: string; price?: string; description?: string; images?: string };
    waitTime?: number;
    useJavaScript?: boolean;
    customHeaders?: Record<string, string>;
    enabled: boolean;
  }[]>([]);
  const [newDomainRule, setNewDomainRule] = useState({
    domain: '',
    titleSelector: '',
    priceSelector: '',
    waitTime: 2000,
    useJavaScript: false,
  });

  // 爬取佇列管理
  const [showQueuePanel, setShowQueuePanel] = useState(false);
  const [queueItems, setQueueItems] = useState<{
    id: string;
    url: string;
    priority: 'high' | 'normal' | 'low';
    status: 'queued' | 'processing' | 'done' | 'failed';
    retryCount: number;
    maxRetries: number;
    addedAt: Date;
    nextRetryAt?: Date;
  }[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);

  // 重試策略設定
  const [retrySettings, setRetrySettings] = useState({
    maxRetries: 3,
    baseDelay: 1000,
    useExponentialBackoff: true,
    maxDelay: 30000,
  });

  // 日誌匯出
  const [showLogExport, setShowLogExport] = useState(false);

  // 分析報表
  const [showAnalyticsPanel, setShowAnalyticsPanel] = useState(false);

  // E1: 定時排程 (Cron 增強)
  const [showScheduleManager, setShowScheduleManager] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<{ id: string; name: string; urls: string[]; cron: string; enabled: boolean } | null>(null);
  const [cronPresets] = useState([
    { label: '每小時', cron: '0 * * * *' },
    { label: '每 6 小時', cron: '0 */6 * * *' },
    { label: '每天早上 9 點', cron: '0 9 * * *' },
    { label: '每天下午 6 點', cron: '0 18 * * *' },
    { label: '每週一早上 9 點', cron: '0 9 * * 1' },
  ]);

  // E2: Webhook 通知
  const [showWebhookSettings, setShowWebhookSettings] = useState(false);
  const [webhookConfig, setWebhookConfig] = useState({
    enabled: false,
    url: '',
    secret: '',
    events: ['scrape_complete', 'scrape_failed', 'price_change'] as string[],
  });

  // E3: 代理池管理
  const [showProxyPool, setShowProxyPool] = useState(false);
  const [proxyList, setProxyList] = useState<{ id: string; host: string; port: number; username?: string; password?: string; enabled: boolean; lastUsed?: Date; successRate: number }[]>([]);
  const [newProxy, setNewProxy] = useState({ host: '', port: '', username: '', password: '' });

  // E4: 差異比對 (增強版)
  const [jobHistory, setJobHistory] = useState<Record<string, { data: Partial<Plan>; timestamp: Date }[]>>({});

  // 過濾後的任務
  const filteredJobs = statusFilter === 'all'
    ? jobs
    : jobs.filter(j => j.status === statusFilter);

  // 錯誤分析數據
  const errorAnalytics = useMemo(() => {
    const failedJobs = jobs.filter(j => j.status === 'failed');
    if (failedJobs.length === 0) return null;

    // 錯誤類型統計
    const errorTypes: Record<string, { count: number; jobs: ScraperJob[] }> = {};
    failedJobs.forEach(job => {
      const error = job.error || '未知錯誤';
      let type = '其他';
      if (error.includes('timeout') || error.includes('超時')) type = '超時';
      else if (error.includes('403') || error.includes('401') || error.includes('blocked')) type = '被封鎖';
      else if (error.includes('404') || error.includes('Not Found')) type = '頁面不存在';
      else if (error.includes('network') || error.includes('ECONNREFUSED')) type = '網路錯誤';
      else if (error.includes('parse') || error.includes('JSON') || error.includes('AI')) type = 'AI 解析失敗';
      else if (error.includes('500') || error.includes('502') || error.includes('503')) type = '伺服器錯誤';

      if (!errorTypes[type]) errorTypes[type] = { count: 0, jobs: [] };
      errorTypes[type].count++;
      errorTypes[type].jobs.push(job);
    });

    // 按網域統計
    const domainErrors: Record<string, number> = {};
    failedJobs.forEach(job => {
      try {
        const domain = new URL(job.url).hostname;
        domainErrors[domain] = (domainErrors[domain] || 0) + 1;
      } catch {}
    });

    // 時間分布
    const hourlyErrors: number[] = new Array(24).fill(0);
    failedJobs.forEach(job => {
      if (job.startedAt) {
        const hour = new Date(job.startedAt).getHours();
        hourlyErrors[hour]++;
      }
    });

    return {
      total: failedJobs.length,
      errorTypes: Object.entries(errorTypes).sort((a, b) => b[1].count - a[1].count),
      topDomains: Object.entries(domainErrors).sort((a, b) => b[1] - a[1]).slice(0, 10),
      hourlyDistribution: hourlyErrors,
      recentErrors: failedJobs.slice(0, 5),
    };
  }, [jobs]);

  // 分析報表數據
  const analyticsData = useMemo(() => {
    if (jobs.length === 0) return null;

    // 網域成功率統計
    const domainStats: Record<string, { total: number; success: number; failed: number }> = {};
    jobs.forEach(job => {
      try {
        const domain = new URL(job.url).hostname;
        if (!domainStats[domain]) {
          domainStats[domain] = { total: 0, success: 0, failed: 0 };
        }
        domainStats[domain].total++;
        if (job.status === 'success') domainStats[domain].success++;
        if (job.status === 'failed') domainStats[domain].failed++;
      } catch {}
    });

    const domainSuccessRates = Object.entries(domainStats)
      .map(([domain, data]) => ({
        domain,
        ...data,
        successRate: data.total > 0 ? Math.round((data.success / data.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);

    // 廠商統計
    const vendorStats: Record<string, { count: number; totalPrice: number; minPrice: number; maxPrice: number }> = {};
    jobs.filter(j => j.status === 'success' && j.extractedData).forEach(job => {
      const vendor = job.extractedData?.vendorName || '未知廠商';
      const price = job.extractedData?.priceDiscount || 0;
      if (!vendorStats[vendor]) {
        vendorStats[vendor] = { count: 0, totalPrice: 0, minPrice: Infinity, maxPrice: 0 };
      }
      vendorStats[vendor].count++;
      vendorStats[vendor].totalPrice += price;
      if (price > 0) {
        vendorStats[vendor].minPrice = Math.min(vendorStats[vendor].minPrice, price);
        vendorStats[vendor].maxPrice = Math.max(vendorStats[vendor].maxPrice, price);
      }
    });

    const topVendors = Object.entries(vendorStats)
      .map(([vendor, data]) => ({
        vendor,
        ...data,
        avgPrice: data.count > 0 ? Math.round(data.totalPrice / data.count) : 0,
        minPrice: data.minPrice === Infinity ? 0 : data.minPrice,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // 價格分布
    const priceRanges = {
      '0-3000': 0,
      '3001-5000': 0,
      '5001-8000': 0,
      '8001-12000': 0,
      '12001+': 0,
    };
    jobs.filter(j => j.status === 'success' && j.extractedData?.priceDiscount).forEach(job => {
      const price = job.extractedData!.priceDiscount!;
      if (price <= 3000) priceRanges['0-3000']++;
      else if (price <= 5000) priceRanges['3001-5000']++;
      else if (price <= 8000) priceRanges['5001-8000']++;
      else if (price <= 12000) priceRanges['8001-12000']++;
      else priceRanges['12001+']++;
    });

    // 每日爬取趨勢 (最近7天)
    const dailyStats: Record<string, { success: number; failed: number }> = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const key = date.toISOString().slice(0, 10);
      dailyStats[key] = { success: 0, failed: 0 };
    }
    jobs.forEach(job => {
      if (job.completedAt) {
        const key = new Date(job.completedAt).toISOString().slice(0, 10);
        if (dailyStats[key]) {
          if (job.status === 'success') dailyStats[key].success++;
          if (job.status === 'failed') dailyStats[key].failed++;
        }
      }
    });

    const dailyTrend = Object.entries(dailyStats).map(([date, data]) => ({
      date: date.slice(5), // MM-DD format
      ...data,
    }));

    // 平均處理時間
    const processingTimes = jobs
      .filter(j => j.startedAt && j.completedAt)
      .map(j => new Date(j.completedAt!).getTime() - new Date(j.startedAt!).getTime());
    const avgProcessingTime = processingTimes.length > 0
      ? Math.round(processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length / 1000)
      : 0;

    return {
      domainSuccessRates,
      topVendors,
      priceRanges,
      dailyTrend,
      avgProcessingTime,
      totalJobs: jobs.length,
      successJobs: jobs.filter(j => j.status === 'success').length,
      failedJobs: jobs.filter(j => j.status === 'failed').length,
    };
  }, [jobs]);

  // 載入 localStorage 設定
  useEffect(() => {
    const saved = localStorage.getItem('scraper-service');
    if (saved && saved in scraperServices) {
      setSelectedService(saved as ScraperServiceType);
    }
  }, []);

  // 儲存服務選擇
  const handleServiceChange = (service: ScraperServiceType) => {
    setSelectedService(service);
    localStorage.setItem('scraper-service', service);
  };

  const addLog = (level: ScraperLogEntry['level'], message: string) => {
    setLogs((prev) => [...prev, { timestamp: new Date(), level, message }]);
    setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const loadData = async () => {
    const [statsData, jobsData] = await Promise.all([
      getScraperStats(),
      getAllScraperJobs(),
    ]);
    setStats(statsData);
    setJobs(jobsData);
  };

  useEffect(() => {
    loadData();
    loadPlans();
  }, [loadPlans]);

  // 載入網址來源
  useEffect(() => {
    const saved = localStorage.getItem('scraper-sources');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSavedSources(parsed.map((s: any) => ({ ...s, createdAt: new Date(s.createdAt) })));
      } catch {}
    }
  }, []);

  // 儲存網址來源
  const saveSources = (sources: typeof savedSources) => {
    setSavedSources(sources);
    localStorage.setItem('scraper-sources', JSON.stringify(sources));
  };

  // 新增網址來源
  const handleAddSource = () => {
    if (!newSourceName.trim() || !batchUrls.trim()) return;
    const urls = batchUrls.split('\n').map(u => u.trim()).filter(u => u.startsWith('http'));
    if (urls.length === 0) return;

    const newSource = {
      id: Date.now().toString(),
      name: newSourceName.trim(),
      urls,
      createdAt: new Date(),
    };
    saveSources([newSource, ...savedSources]);
    setNewSourceName('');
    setSnackbar({ open: true, message: `已儲存「${newSource.name}」(${urls.length} 個網址)` });
  };

  // 載入網址來源
  const handleLoadSource = (source: typeof savedSources[0]) => {
    setBatchUrls(source.urls.join('\n'));
    setShowSourceManager(false);
    setSnackbar({ open: true, message: `已載入「${source.name}」` });
  };

  // 刪除網址來源
  const handleDeleteSource = (id: string) => {
    saveSources(savedSources.filter(s => s.id !== id));
  };

  // AI 模型比較
  const handleAICompare = async (job: ScraperJob) => {
    if (!job.rawContent && !job.images?.length) {
      setSnackbar({ open: true, message: '無可分析的內容' });
      return;
    }

    setCompareJobId(job.id);
    setShowAICompare(true);
    setAiComparing(true);
    setAiCompareResults({});

    const content = job.rawContent || '';
    const imageUrls = job.images || [];

    try {
      // 同時呼叫 Claude 和 Gemini
      const [claudeRes, geminiRes] = await Promise.allSettled([
        fetch('/api/ai-vision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrls: imageUrls.slice(0, 5),
            textContent: content.slice(0, 3000),
            aiService: 'claude',
            imageOnly: false,
          }),
        }).then(r => r.json()),
        fetch('/api/ai-vision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrls: imageUrls.slice(0, 5),
            textContent: content.slice(0, 3000),
            aiService: 'gemini',
            imageOnly: false,
          }),
        }).then(r => r.json()),
      ]);

      const results: typeof aiCompareResults = {};

      if (claudeRes.status === 'fulfilled' && claudeRes.value.success) {
        results.claude = { plan: claudeRes.value.plan, raw: claudeRes.value.raw || '' };
      }
      if (geminiRes.status === 'fulfilled' && geminiRes.value.success) {
        results.gemini = { plan: geminiRes.value.plan, raw: geminiRes.value.raw || '' };
      }

      setAiCompareResults(results);
    } catch (err) {
      setSnackbar({ open: true, message: '比較失敗: ' + String(err) });
    } finally {
      setAiComparing(false);
    }
  };

  // 載入排程設定
  useEffect(() => {
    const saved = localStorage.getItem('scraper-schedules');
    if (saved) {
      try {
        setSchedules(JSON.parse(saved).map((s: any) => ({
          ...s,
          lastRun: s.lastRun ? new Date(s.lastRun) : undefined,
        })));
      } catch {}
    }
  }, []);

  // 儲存排程
  const saveSchedules = (data: typeof schedules) => {
    setSchedules(data);
    localStorage.setItem('scraper-schedules', JSON.stringify(data));
  };

  // 新增排程
  const handleAddSchedule = () => {
    if (!newSchedule.name.trim() || !newSchedule.urls.trim()) return;
    const urls = newSchedule.urls.split('\n').map(u => u.trim()).filter(u => u.startsWith('http'));
    if (urls.length === 0) return;

    const schedule = {
      id: Date.now().toString(),
      name: newSchedule.name.trim(),
      urls,
      cron: newSchedule.interval === 'daily' ? '0 9 * * *' : newSchedule.interval === 'weekly' ? '0 9 * * 1' : '0 9 1 * *',
      enabled: true,
    };

    saveSchedules([schedule, ...schedules]);
    setNewSchedule({ name: '', urls: '', interval: 'daily' });
    setShowScheduleDialog(false);
    setSnackbar({ open: true, message: `已建立排程「${schedule.name}」` });
  };

  // 切換排程狀態
  const handleToggleSchedule = (id: string) => {
    saveSchedules(schedules.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  };

  // 刪除排程
  const handleDeleteSchedule = (id: string) => {
    saveSchedules(schedules.filter(s => s.id !== id));
  };

  // 執行排程
  const handleRunSchedule = async (schedule: typeof schedules[0]) => {
    setBatchUrls(schedule.urls.join('\n'));
    setInputMode('batch');
    saveSchedules(schedules.map(s => s.id === schedule.id ? { ...s, lastRun: new Date() } : s));
    setSnackbar({ open: true, message: `正在執行「${schedule.name}」，請點擊開始爬取` });
  };

  // 廠商設定檔相關
  useEffect(() => {
    const saved = localStorage.getItem('scraper-vendor-configs');
    if (saved) {
      try {
        setVendorConfigs(JSON.parse(saved));
      } catch {}
    }
  }, []);

  const saveVendorConfigs = (configs: typeof vendorConfigs) => {
    setVendorConfigs(configs);
    localStorage.setItem('scraper-vendor-configs', JSON.stringify(configs));
  };

  const handleAddVendorConfig = () => {
    if (!newVendorConfig.name.trim() || !newVendorConfig.urlPattern.trim()) return;
    const config = {
      id: Date.now().toString(),
      name: newVendorConfig.name.trim(),
      urlPattern: newVendorConfig.urlPattern.trim(),
      aiPromptHints: newVendorConfig.aiPromptHints.trim() || undefined,
      defaultTags: newVendorConfig.defaultTags.split(',').map(t => t.trim()).filter(Boolean),
      enabled: true,
    };
    saveVendorConfigs([config, ...vendorConfigs]);
    setNewVendorConfig({ name: '', urlPattern: '', aiPromptHints: '', defaultTags: '' });
    setSnackbar({ open: true, message: `已新增廠商設定：${config.name}` });
  };

  // 檢查 URL 是否有匹配的廠商設定
  const getMatchingVendorConfig = (url: string) => {
    return vendorConfigs.find(c => c.enabled && url.includes(c.urlPattern));
  };

  // ===== 網域規則管理 =====
  useEffect(() => {
    const saved = localStorage.getItem('scraper-domain-rules');
    if (saved) {
      try {
        setDomainRules(JSON.parse(saved));
      } catch {}
    }
    // 載入重試設定
    const retrySaved = localStorage.getItem('scraper-retry-settings');
    if (retrySaved) {
      try {
        setRetrySettings(JSON.parse(retrySaved));
      } catch {}
    }
    // 載入佇列
    const queueSaved = localStorage.getItem('scraper-queue');
    if (queueSaved) {
      try {
        const parsed = JSON.parse(queueSaved);
        setQueueItems(parsed.map((q: any) => ({
          ...q,
          addedAt: new Date(q.addedAt),
          nextRetryAt: q.nextRetryAt ? new Date(q.nextRetryAt) : undefined,
        })));
      } catch {}
    }
  }, []);

  const saveDomainRules = (rules: typeof domainRules) => {
    setDomainRules(rules);
    localStorage.setItem('scraper-domain-rules', JSON.stringify(rules));
  };

  const handleAddDomainRule = () => {
    if (!newDomainRule.domain.trim()) return;
    const rule = {
      id: Date.now().toString(),
      domain: newDomainRule.domain.trim(),
      selectors: {
        title: newDomainRule.titleSelector || undefined,
        price: newDomainRule.priceSelector || undefined,
      },
      waitTime: newDomainRule.waitTime,
      useJavaScript: newDomainRule.useJavaScript,
      enabled: true,
    };
    saveDomainRules([rule, ...domainRules]);
    setNewDomainRule({ domain: '', titleSelector: '', priceSelector: '', waitTime: 2000, useJavaScript: false });
    setSnackbar({ open: true, message: `已新增網域規則：${rule.domain}` });
  };

  const getMatchingDomainRule = (url: string) => {
    try {
      const urlDomain = new URL(url).hostname;
      return domainRules.find(r => r.enabled && urlDomain.includes(r.domain));
    } catch {
      return undefined;
    }
  };

  // ===== 爬取佇列管理 =====
  const saveQueue = (items: typeof queueItems) => {
    setQueueItems(items);
    localStorage.setItem('scraper-queue', JSON.stringify(items));
  };

  const addToQueue = (urls: string[], priority: 'high' | 'normal' | 'low' = 'normal') => {
    const newItems = urls.map(url => ({
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      url: url.trim(),
      priority,
      status: 'queued' as const,
      retryCount: 0,
      maxRetries: retrySettings.maxRetries,
      addedAt: new Date(),
    }));
    const updated = [...newItems, ...queueItems];
    // 按優先順序排序
    updated.sort((a, b) => {
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
    saveQueue(updated);
    setSnackbar({ open: true, message: `已加入 ${urls.length} 個網址到佇列` });
  };

  const removeFromQueue = (id: string) => {
    saveQueue(queueItems.filter(q => q.id !== id));
  };

  const clearQueue = () => {
    saveQueue([]);
    setSnackbar({ open: true, message: '已清空佇列' });
  };

  const updateQueuePriority = (id: string, priority: 'high' | 'normal' | 'low') => {
    const updated = queueItems.map(q =>
      q.id === id ? { ...q, priority } : q
    );
    updated.sort((a, b) => {
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
    saveQueue(updated);
  };

  const getQueueStats = () => {
    return {
      total: queueItems.length,
      queued: queueItems.filter(q => q.status === 'queued').length,
      processing: queueItems.filter(q => q.status === 'processing').length,
      done: queueItems.filter(q => q.status === 'done').length,
      failed: queueItems.filter(q => q.status === 'failed').length,
      highPriority: queueItems.filter(q => q.priority === 'high' && q.status === 'queued').length,
    };
  };

  // 計算重試延遲（指數退避）
  const calculateRetryDelay = (retryCount: number) => {
    if (!retrySettings.useExponentialBackoff) {
      return retrySettings.baseDelay;
    }
    const delay = retrySettings.baseDelay * Math.pow(2, retryCount);
    return Math.min(delay, retrySettings.maxDelay);
  };

  // 儲存重試設定
  const saveRetrySettings = (settings: typeof retrySettings) => {
    setRetrySettings(settings);
    localStorage.setItem('scraper-retry-settings', JSON.stringify(settings));
  };

  // ===== 日誌匯出 =====
  const exportLogs = (format: 'json' | 'csv' | 'txt') => {
    let content = '';
    let filename = `scraper-logs-${new Date().toISOString().slice(0, 10)}`;
    let mimeType = '';

    if (format === 'json') {
      const exportData = {
        exportedAt: new Date().toISOString(),
        stats,
        jobs: jobs.map(j => ({
          ...j,
          extractedData: j.extractedData ? { ...j.extractedData } : null,
        })),
        logs,
      };
      content = JSON.stringify(exportData, null, 2);
      filename += '.json';
      mimeType = 'application/json';
    } else if (format === 'csv') {
      const headers = ['ID', 'URL', '狀態', '開始時間', '結束時間', '錯誤'];
      const rows = jobs.map(j => [
        j.id,
        j.url,
        j.status,
        j.startedAt?.toISOString() || '',
        j.completedAt?.toISOString() || '',
        j.error || '',
      ]);
      content = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
      filename += '.csv';
      mimeType = 'text/csv';
    } else {
      const lines = logs.map(l => `[${l.timestamp.toISOString()}] [${l.level.toUpperCase()}] ${l.message}`);
      content = lines.join('\n');
      filename += '.txt';
      mimeType = 'text/plain';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setSnackbar({ open: true, message: `已匯出 ${format.toUpperCase()} 檔案` });
  };

  const exportJobsHistory = () => {
    const exportData = jobs.map(j => ({
      id: j.id,
      url: j.url,
      status: j.status,
      startedAt: j.startedAt?.toISOString(),
      completedAt: j.completedAt?.toISOString(),
      error: j.error,
      vendorName: j.extractedData?.vendorName,
      title: j.extractedData?.title,
      price: j.extractedData?.priceDiscount,
    }));
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scraper-history-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setSnackbar({ open: true, message: '已匯出爬取歷史' });
  };

  // 預覽並確認加入資料庫
  const handlePreviewBeforeAdd = (job: ScraperJob) => {
    if (!job.extractedData) {
      setSnackbar({ open: true, message: '此任務沒有解析資料' });
      return;
    }
    setPreviewData({ job, plan: { ...job.extractedData } });
    setShowPreviewDialog(true);
  };

  const handleConfirmAddFromPreview = async () => {
    if (!previewData) return;
    try {
      await addPlan({
        vendorId: '',
        vendorName: previewData.plan.vendorName || '（待填寫）',
        title: previewData.plan.title || '匯入的方案',
        sourceUrl: previewData.job.url,
        priceDiscount: previewData.plan.priceDiscount || 0,
        shippingType: previewData.plan.shippingType || 'delivery',
        storageType: previewData.plan.storageType || 'frozen',
        servingsMin: previewData.plan.servingsMin || 4,
        tags: previewData.plan.tags || [],
        dishes: previewData.plan.dishes || [],
        status: 'needs_review',
        ...previewData.plan,
      });
      await loadPlans();
      setShowPreviewDialog(false);
      setPreviewData(null);
      setSnackbar({ open: true, message: '已加入資料庫' });
    } catch (e) {
      setSnackbar({ open: true, message: `新增失敗: ${e}` });
    }
  };

  // 差異比對
  const handleShowDiff = async (job: ScraperJob) => {
    if (!job.extractedData) return;

    // 檢查是否有相同 URL 的既有資料
    const { plans } = usePlanStore.getState();
    const existing = plans.find(p => p.sourceUrl === job.url);

    setDiffData({
      jobId: job.id,
      url: job.url,
      newData: job.extractedData,
      existingData: existing || null,
    });
    setShowDiffDialog(true);
  };

  // 用新資料更新既有資料
  const handleApplyDiff = async () => {
    if (!diffData || !diffData.existingData) return;
    try {
      const { updatePlan } = usePlanStore.getState();
      await updatePlan(diffData.existingData.id, {
        ...diffData.newData,
        updatedAt: new Date(),
      });
      await loadPlans();
      setShowDiffDialog(false);
      setDiffData(null);
      setSnackbar({ open: true, message: '已更新既有資料' });
    } catch (e) {
      setSnackbar({ open: true, message: `更新失敗: ${e}` });
    }
  };

  // ===== 監控與通知功能 =====

  // 載入監控資料
  useEffect(() => {
    const savedMonitors = localStorage.getItem('scraper-monitors');
    const savedPriceHistory = localStorage.getItem('scraper-price-history');
    const savedPriceChanges = localStorage.getItem('scraper-price-changes');
    const savedNotifications = localStorage.getItem('scraper-notifications');

    if (savedMonitors) setMonitorTasks(JSON.parse(savedMonitors));
    if (savedPriceHistory) setPriceHistory(JSON.parse(savedPriceHistory));
    if (savedPriceChanges) setPriceChanges(JSON.parse(savedPriceChanges).map((c: PriceChangeEvent) => ({ ...c, detectedAt: new Date(c.detectedAt) })));
    if (savedNotifications) {
      const notifs = JSON.parse(savedNotifications).map((n: Notification) => ({ ...n, createdAt: new Date(n.createdAt) }));
      setNotifications(notifs);
      setUnreadCount(notifs.filter((n: Notification) => !n.read).length);
    }
  }, []);

  // 儲存監控資料
  const saveMonitorData = (tasks: MonitorTask[], history: Record<string, PriceHistory[]>, changes: PriceChangeEvent[]) => {
    setMonitorTasks(tasks);
    setPriceHistory(history);
    setPriceChanges(changes);
    localStorage.setItem('scraper-monitors', JSON.stringify(tasks));
    localStorage.setItem('scraper-price-history', JSON.stringify(history));
    localStorage.setItem('scraper-price-changes', JSON.stringify(changes));
  };

  // 新增通知
  const addNotification = (type: Notification['type'], title: string, message: string, planId?: string) => {
    const notif: Notification = {
      id: Date.now().toString(),
      type,
      title,
      message,
      planId,
      read: false,
      createdAt: new Date(),
    };
    const newNotifs = [notif, ...notifications].slice(0, 50); // 最多保留 50 筆
    setNotifications(newNotifs);
    setUnreadCount(prev => prev + 1);
    localStorage.setItem('scraper-notifications', JSON.stringify(newNotifs));
  };

  // 標記通知已讀
  const markNotificationRead = (id: string) => {
    const newNotifs = notifications.map(n => n.id === id ? { ...n, read: true } : n);
    setNotifications(newNotifs);
    setUnreadCount(newNotifs.filter(n => !n.read).length);
    localStorage.setItem('scraper-notifications', JSON.stringify(newNotifs));
  };

  // 標記全部已讀
  const markAllNotificationsRead = () => {
    const newNotifs = notifications.map(n => ({ ...n, read: true }));
    setNotifications(newNotifs);
    setUnreadCount(0);
    localStorage.setItem('scraper-notifications', JSON.stringify(newNotifs));
  };

  // 清除所有通知
  const clearAllNotifications = () => {
    setNotifications([]);
    setUnreadCount(0);
    localStorage.removeItem('scraper-notifications');
  };

  // 新增監控任務
  const handleAddMonitor = (plan: Plan) => {
    if (!plan.sourceUrl) {
      setSnackbar({ open: true, message: '此方案沒有來源網址' });
      return;
    }

    // 檢查是否已存在
    if (monitorTasks.some(t => t.planId === plan.id)) {
      setSnackbar({ open: true, message: '此方案已在監控列表中' });
      return;
    }

    const task: MonitorTask = {
      id: Date.now().toString(),
      planId: plan.id,
      sourceUrl: plan.sourceUrl,
      enabled: true,
      checkInterval: 'daily',
      status: 'idle',
      createdAt: new Date(),
    };

    // 記錄當前價格
    const history: PriceHistory = {
      id: Date.now().toString(),
      planId: plan.id,
      price: plan.priceDiscount,
      originalPrice: plan.priceOriginal,
      recordedAt: new Date(),
      source: 'manual',
    };

    const newHistory = { ...priceHistory, [plan.id]: [history] };
    saveMonitorData([...monitorTasks, task], newHistory, priceChanges);
    setSnackbar({ open: true, message: `已加入監控：${plan.title}` });
  };

  // 執行價格檢查
  const handleCheckPrice = async (task: MonitorTask) => {
    const { plans } = usePlanStore.getState();
    const plan = plans.find(p => p.id === task.planId);
    if (!plan || !task.sourceUrl) return;

    // 更新狀態
    const updatedTasks = monitorTasks.map(t =>
      t.id === task.id ? { ...t, status: 'checking' as const, lastCheckedAt: new Date() } : t
    );
    setMonitorTasks(updatedTasks);
    localStorage.setItem('scraper-monitors', JSON.stringify(updatedTasks));

    try {
      addLog('info', `檢查價格: ${plan.title}`);

      // 爬取最新資料
      const scrapeRes = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: task.sourceUrl, service: selectedService }),
      });

      if (!scrapeRes.ok) throw new Error('爬取失敗');

      const { markdown } = await scrapeRes.json();

      // AI 解析
      const aiRes = await fetch('/api/ai-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown, url: task.sourceUrl }),
      });

      if (!aiRes.ok) throw new Error('AI 解析失敗');

      const { plan: newData } = await aiRes.json();
      const newPrice = newData?.priceDiscount || 0;
      const oldPrice = plan.priceDiscount;

      // 記錄價格歷史
      const historyEntry: PriceHistory = {
        id: Date.now().toString(),
        planId: plan.id,
        price: newPrice,
        originalPrice: newData?.priceOriginal,
        recordedAt: new Date(),
        source: 'scrape',
      };

      const planHistory = priceHistory[plan.id] || [];
      const newPriceHistory = { ...priceHistory, [plan.id]: [...planHistory, historyEntry].slice(-30) }; // 保留最近 30 筆

      // 檢查價格變化
      let newPriceChanges = [...priceChanges];
      if (newPrice !== oldPrice && newPrice > 0) {
        const changePercent = Math.round(((newPrice - oldPrice) / oldPrice) * 100);
        const changeEvent: PriceChangeEvent = {
          id: Date.now().toString(),
          planId: plan.id,
          planTitle: plan.title,
          vendorName: plan.vendorName,
          oldPrice,
          newPrice,
          changePercent,
          changeType: newPrice < oldPrice ? 'drop' : 'increase',
          detectedAt: new Date(),
          acknowledged: false,
        };
        newPriceChanges = [changeEvent, ...newPriceChanges].slice(0, 100);

        // 發送通知
        const notifType = newPrice < oldPrice ? 'price_drop' : 'price_increase';
        const notifTitle = newPrice < oldPrice ? '🎉 價格下降！' : '⚠️ 價格上漲';
        addNotification(
          notifType,
          notifTitle,
          `${plan.vendorName} - ${plan.title}\n$${oldPrice.toLocaleString()} → $${newPrice.toLocaleString()} (${changePercent > 0 ? '+' : ''}${changePercent}%)`,
          plan.id
        );

        addLog(newPrice < oldPrice ? 'success' : 'warn',
          `價格變化: ${plan.title} $${oldPrice} → $${newPrice} (${changePercent > 0 ? '+' : ''}${changePercent}%)`
        );
      }

      // 更新任務狀態
      const finalTasks = monitorTasks.map(t =>
        t.id === task.id ? {
          ...t,
          status: (newPrice !== oldPrice ? 'changed' : 'idle') as MonitorTask['status'],
          lastCheckedAt: new Date(),
          lastChangeAt: newPrice !== oldPrice ? new Date() : t.lastChangeAt,
        } : t
      );

      saveMonitorData(finalTasks, newPriceHistory, newPriceChanges);
      setSnackbar({ open: true, message: newPrice !== oldPrice ? `發現價格變化！` : '價格無變化' });

    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '未知錯誤';
      const errorTasks = monitorTasks.map(t =>
        t.id === task.id ? { ...t, status: 'error' as const, errorMessage: errMsg } : t
      );
      setMonitorTasks(errorTasks);
      localStorage.setItem('scraper-monitors', JSON.stringify(errorTasks));
      addLog('error', `檢查失敗: ${errMsg}`);
    }
  };

  // 批量檢查所有監控
  const handleCheckAllMonitors = async () => {
    const enabledTasks = monitorTasks.filter(t => t.enabled);
    if (enabledTasks.length === 0) {
      setSnackbar({ open: true, message: '沒有啟用的監控任務' });
      return;
    }

    setIsMonitoring(true);
    addLog('info', `開始批量檢查 ${enabledTasks.length} 個監控...`);

    for (const task of enabledTasks) {
      await handleCheckPrice(task);
      await new Promise(r => setTimeout(r, 2000)); // 間隔 2 秒
    }

    setIsMonitoring(false);
    addLog('success', '批量檢查完成');
  };

  // 刪除監控任務
  const handleDeleteMonitor = (id: string) => {
    const newTasks = monitorTasks.filter(t => t.id !== id);
    setMonitorTasks(newTasks);
    localStorage.setItem('scraper-monitors', JSON.stringify(newTasks));
  };

  // 切換監控狀態
  const handleToggleMonitor = (id: string) => {
    const newTasks = monitorTasks.map(t =>
      t.id === id ? { ...t, enabled: !t.enabled } : t
    );
    setMonitorTasks(newTasks);
    localStorage.setItem('scraper-monitors', JSON.stringify(newTasks));
  };

  // 從內容中提取圖片 URL
  const extractImagesFromContent = (content: string): string[] => {
    const images: string[] = [];

    // Markdown 圖片: ![alt](url)
    const mdRegex = /!\[.*?\]\((https?:\/\/[^)\s]+)\)/g;
    let match;
    while ((match = mdRegex.exec(content)) !== null) {
      images.push(match[1]);
    }

    // HTML img 標籤: <img src="url">
    const imgRegex = /<img[^>]+src=["'](https?:\/\/[^"']+)["']/gi;
    while ((match = imgRegex.exec(content)) !== null) {
      images.push(match[1]);
    }

    // 純 URL 圖片（常見圖片副檔名）
    const urlRegex = /(https?:\/\/[^\s<>"']+\.(?:jpg|jpeg|png|gif|webp|bmp)(?:\?[^\s<>"']*)?)/gi;
    while ((match = urlRegex.exec(content)) !== null) {
      images.push(match[1]);
    }

    // 去重並過濾小圖標
    const skipPatterns = ['icon', 'logo', 'avatar', 'emoji', 'btn', 'button', 'arrow', 'sprite', '1x1', 'pixel', 'tracking'];
    const uniqueImages = [...new Set(images)].filter(url => {
      const lowerUrl = url.toLowerCase();
      return !skipPatterns.some(p => lowerUrl.includes(p));
    });

    return uniqueImages;
  };

  // 執行單一 URL 爬取
  const scrapeUrl = async (url: string, jobId: string): Promise<{ success: boolean; data?: Partial<Plan>; error?: string }> => {
    const startTime = Date.now();
    let rawContent = '';
    let images: string[] = [];
    let ocrText = '';

    try {
      const scrapeRes = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, service: selectedService }),
      });

      if (!scrapeRes.ok) {
        const err = await scrapeRes.json().catch(() => ({}));
        throw new Error(err.error || `爬取失敗: ${scrapeRes.status}`);
      }

      const scrapeData = await scrapeRes.json();
      if (!scrapeData.success) throw new Error(scrapeData.error || '爬取失敗');

      // 儲存原始爬取內容
      rawContent = scrapeData.data?.content || '';

      // 合併圖片來源：API 返回的 + 從內容中提取的
      const apiImages = scrapeData.data?.images || [];
      const contentImages = extractImagesFromContent(rawContent);
      images = [...new Set([...apiImages, ...contentImages])];

      const contentLength = rawContent.length;
      addLog('info', `網頁抓取完成 (${contentLength.toLocaleString()} 字元, ${images.length} 張圖片)`);

      // 如果有圖片，執行 OCR（處理所有圖片，最多 20 張）
      const maxOcrImages = 20;
      if (images.length > 0) {
        const imagesToProcess = images.slice(0, maxOcrImages);
        addLog('info', `正在對 ${imagesToProcess.length} 張圖片進行 OCR 識別...`);
        try {
          const ocrRes = await fetch('/api/ocr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ images: imagesToProcess, maxImages: maxOcrImages }),
          });

          if (ocrRes.ok) {
            const ocrData = await ocrRes.json();
            if (ocrData.success) {
              const processed = ocrData.data?.processed || 0;
              const results = ocrData.data?.results || [];
              ocrText = ocrData.data?.combinedText || '';

              if (ocrText) {
                addLog('success', `OCR 完成：${processed}/${imagesToProcess.length} 張圖片，識別出 ${ocrText.length.toLocaleString()} 字元`);
              } else if (results.length === 0) {
                addLog('warn', 'OCR 未識別出文字（圖片可能不含文字）');
              }
            } else {
              addLog('warn', `OCR 失敗: ${ocrData.error || '未知錯誤'}`);
            }
          } else {
            const errData = await ocrRes.json().catch(() => ({}));
            addLog('warn', `OCR 服務錯誤: ${errData.error || ocrRes.status}`);
          }
        } catch (ocrError) {
          addLog('warn', `OCR 異常: ${ocrError instanceof Error ? ocrError.message : 'unknown'}`);
        }
      } else {
        addLog('info', '未發現圖片，跳過 OCR');
      }

      addLog('info', 'AI 解析中...');

      // 將 OCR 文字合併到內容中給 AI 解析
      const contentForAI = ocrText
        ? `${rawContent}\n\n---\n\n## 圖片 OCR 識別結果\n\n${ocrText}`
        : rawContent;

      const aiRes = await fetch('/api/ai-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown: contentForAI, url }),
      });

      if (!aiRes.ok) throw new Error(`AI 解析失敗: ${aiRes.status}`);

      const aiData = await aiRes.json();
      const duration = Date.now() - startTime;

      await updateScraperJob(jobId, {
        status: 'success',
        completedAt: new Date(),
        duration,
        extractedData: aiData.plan,
        vendorName: aiData.plan?.vendorName,
        rawContent: rawContent.substring(0, 50000),
        images: images.slice(0, 20), // 最多儲存 20 張圖片 URL
        ocrText: ocrText.substring(0, 30000), // 限制 OCR 文字大小
      });

      addLog('success', `完成！耗時 ${Math.round(duration / 1000)} 秒`);
      return { success: true, data: aiData.plan };

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      addLog('error', `失敗: ${msg}`);

      await updateScraperJob(jobId, {
        status: 'failed',
        completedAt: new Date(),
        duration: Date.now() - startTime,
        error: msg,
        rawContent: rawContent.substring(0, 50000),
        images: images.slice(0, 20),
        ocrText: ocrText.substring(0, 30000),
      });

      return { success: false, error: msg };
    }
  };

  // 主要爬取流程
  const handleScrape = async () => {
    const urls = inputMode === 'single'
      ? [singleUrl.trim()]
      : batchUrls.split('\n').map(u => u.trim()).filter(u => u.startsWith('http'));

    if (urls.length === 0) return;

    setIsProcessing(true);
    setIsCancelled(false);
    setResult(null);
    setLogs([]);
    setBatchProgress({ current: 0, total: urls.length, success: 0, failed: 0 });

    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < urls.length; i++) {
      if (isCancelled) {
        addLog('warn', '已取消');
        break;
      }

      const url = urls[i];
      setBatchProgress(prev => ({ ...prev, current: i + 1 }));
      addLog('info', `[${i + 1}/${urls.length}] 開始: ${url.substring(0, 50)}...`);

      const jobId = await createScraperJob({
        url,
        status: 'running',
        startedAt: new Date(),
        logs: [],
      });

      addLog('info', `使用 ${scraperServices[selectedService].name}`);

      const result = await scrapeUrl(url, jobId);

      if (result.success) {
        successCount++;
        setBatchProgress(prev => ({ ...prev, success: successCount }));

        if (inputMode === 'single') {
          setResult({
            success: true,
            message: `成功解析「${result.data?.vendorName || '未知'}」`,
            data: result.data,
          });
          setShowResultDialog(true);
        } else {
          // 批次自動加入
          await addPlan({
            vendorId: '',
            vendorName: result.data?.vendorName || '（待填寫）',
            title: result.data?.title || '匯入的方案',
            sourceUrl: url,
            priceDiscount: result.data?.priceDiscount || 0,
            shippingType: result.data?.shippingType || 'delivery',
            storageType: result.data?.storageType || 'frozen',
            servingsMin: result.data?.servingsMin || 4,
            tags: result.data?.tags || [],
            dishes: result.data?.dishes || [],
            status: 'needs_review',
            ...result.data,
          });
        }
      } else {
        failedCount++;
        setBatchProgress(prev => ({ ...prev, failed: failedCount }));

        if (inputMode === 'single') {
          setResult({ success: false, message: result.error || '爬取失敗' });
        }
      }

      // 批次間隔
      if (urls.length > 1 && i < urls.length - 1 && !isCancelled) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    setIsProcessing(false);
    await loadData();
    if (inputMode === 'batch') {
      await loadPlans();
      addLog('info', `批次完成：成功 ${successCount}，失敗 ${failedCount}`);
    }
  };

  // 取消處理
  const handleCancel = () => {
    setIsCancelled(true);
    addLog('warn', '正在取消...');
  };

  // 重試失敗任務
  const handleRetry = async (job: ScraperJob) => {
    setSingleUrl(job.url);
    setInputMode('single');
    // 觸發爬取
    setTimeout(() => handleScrape(), 100);
  };

  // 從歷史紀錄加入資料庫
  const handleAddFromHistory = async (job: ScraperJob) => {
    if (!job.extractedData) return;
    try {
      await addPlan({
        vendorId: '',
        vendorName: job.extractedData.vendorName || '（待填寫）',
        title: job.extractedData.title || '匯入的方案',
        sourceUrl: job.url,
        priceDiscount: job.extractedData.priceDiscount || 0,
        shippingType: job.extractedData.shippingType || 'delivery',
        storageType: job.extractedData.storageType || 'frozen',
        servingsMin: job.extractedData.servingsMin || 4,
        tags: job.extractedData.tags || [],
        dishes: job.extractedData.dishes || [],
        status: 'needs_review',
        ...job.extractedData,
      });
      await loadPlans();
      addLog('success', '已從歷史紀錄新增至資料庫');
    } catch (e) {
      addLog('error', `新增失敗: ${e}`);
    }
  };

  // 加入資料庫
  const handleAddToDatabase = async () => {
    if (!result?.data) return;
    try {
      await addPlan({
        vendorId: '',
        vendorName: result.data.vendorName || '（待填寫）',
        title: result.data.title || '匯入的方案',
        sourceUrl: singleUrl,
        priceDiscount: result.data.priceDiscount || 0,
        shippingType: result.data.shippingType || 'delivery',
        storageType: result.data.storageType || 'frozen',
        servingsMin: result.data.servingsMin || 4,
        tags: result.data.tags || [],
        dishes: result.data.dishes || [],
        status: 'needs_review',
        ...result.data,
      });
      await loadPlans();
      addLog('success', '已新增至資料庫');
      setSingleUrl('');
      setResult(null);
      setShowResultDialog(false);
    } catch (e) {
      addLog('error', `新增失敗: ${e}`);
    }
  };

  // 清除所有紀錄
  const handleClearAll = async () => {
    await clearAllScraperJobs();
    await loadData();
    setShowClearDialog(false);
  };

  // 複製網址
  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setSnackbar({ open: true, message: '已複製到剪貼簿' });
    } catch {
      setSnackbar({ open: true, message: '複製失敗' });
    }
  };

  // 匯出歷史紀錄
  const handleExport = () => {
    const exportData = filteredJobs.map(job => ({
      url: job.url,
      status: job.status,
      vendorName: job.vendorName || '',
      startedAt: job.startedAt ? new Date(job.startedAt).toISOString() : '',
      duration: job.duration || 0,
      error: job.error || '',
      extractedData: job.extractedData || null,
    }));

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scraper-history-${format(new Date(), 'yyyyMMdd-HHmmss')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setSnackbar({ open: true, message: `已匯出 ${exportData.length} 筆紀錄` });
  };

  // 載入圖片尺寸
  const loadImageSize = useCallback((url: string) => {
    if (imageSizes[url]) return;
    const img = new window.Image();
    img.onload = () => {
      setImageSizes(prev => ({ ...prev, [url]: { w: img.naturalWidth, h: img.naturalHeight } }));
    };
    img.src = url;
  }, [imageSizes]);

  // 智慧選取大圖
  const smartSelectImages = (jobId: string, images: string[]) => {
    const largeImageIndices = images
      .map((url, i) => ({ url, i }))
      .filter(({ url }) => {
        const size = imageSizes[url];
        return size && size.w >= minImageSize && size.h >= minImageSize;
      })
      .map(({ i }) => i);

    setSelectedImages(prev => ({
      ...prev,
      [jobId]: new Set(largeImageIndices),
    }));
  };

  // 取得過濾後的圖片列表
  const getFilteredImages = (images: string[]) => {
    return images
      .map((url, originalIndex) => ({ url, originalIndex }))
      .filter(({ url }) => {
        const size = imageSizes[url];
        if (!size) return true; // 尚未載入尺寸的先顯示
        return size.w >= minImageSize && size.h >= minImageSize;
      });
  };

  // 切換圖片選擇
  const toggleImageSelect = (jobId: string, imgIndex: number) => {
    setSelectedImages(prev => {
      const current = prev[jobId] || new Set<number>();
      const newSet = new Set(current);
      if (newSet.has(imgIndex)) {
        newSet.delete(imgIndex);
      } else {
        newSet.add(imgIndex);
      }
      return { ...prev, [jobId]: newSet };
    });
  };

  // 全選/取消全選
  const toggleAllImages = (jobId: string, images: string[]) => {
    setSelectedImages(prev => {
      const current = prev[jobId] || new Set<number>();
      if (current.size === images.length) {
        // 已全選，取消全部
        return { ...prev, [jobId]: new Set<number>() };
      } else {
        // 選擇全部
        return { ...prev, [jobId]: new Set(images.map((_, i) => i)) };
      }
    });
  };

  // 手動執行 OCR
  const handleManualOcr = async (job: ScraperJob) => {
    const selected = selectedImages[job.id];
    if (!selected || selected.size === 0 || !job.images) {
      setSnackbar({ open: true, message: '請先選擇要識別的圖片' });
      return;
    }

    const imagesToProcess = Array.from(selected)
      .sort((a, b) => a - b)
      .map(i => job.images![i])
      .filter(Boolean);

    if (imagesToProcess.length === 0) return;

    setOcrProcessing(prev => ({ ...prev, [job.id]: true }));
    setManualOcrResult(prev => ({ ...prev, [job.id]: '' }));

    try {
      const ocrRes = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: imagesToProcess, maxImages: imagesToProcess.length }),
      });

      if (ocrRes.ok) {
        const ocrData = await ocrRes.json();
        if (ocrData.success) {
          const combinedText = ocrData.data?.combinedText || '';
          const processed = ocrData.data?.processed || 0;

          setManualOcrResult(prev => ({ ...prev, [job.id]: combinedText }));

          // 可選：更新 job 的 ocrText
          if (combinedText) {
            const newOcrText = job.ocrText
              ? `${job.ocrText}\n\n--- 手動 OCR 結果 ---\n\n${combinedText}`
              : combinedText;
            await updateScraperJob(job.id, { ocrText: newOcrText.substring(0, 50000) });
            await loadData();
          }

          setSnackbar({
            open: true,
            message: combinedText
              ? `OCR 完成：${processed} 張圖片，識別出 ${combinedText.length} 字元`
              : 'OCR 完成，但未識別出文字'
          });
        } else {
          setSnackbar({ open: true, message: `OCR 失敗: ${ocrData.error}` });
        }
      } else {
        const errData = await ocrRes.json().catch(() => ({}));
        setSnackbar({ open: true, message: `OCR 錯誤: ${errData.error || ocrRes.status}` });
      }
    } catch (error) {
      setSnackbar({ open: true, message: `OCR 異常: ${error instanceof Error ? error.message : 'unknown'}` });
    } finally {
      setOcrProcessing(prev => ({ ...prev, [job.id]: false }));
    }
  };

  // 重新執行 AI 解析
  const handleReParse = async (job: ScraperJob) => {
    if (!job.rawContent && !job.ocrText) {
      setSnackbar({ open: true, message: '沒有可解析的內容（原始內容和 OCR 文字皆為空）' });
      return;
    }

    setReParsingJob(job.id);

    try {
      // 合併原始內容和 OCR 文字
      let contentForAI = job.rawContent || '';
      if (job.ocrText) {
        contentForAI = contentForAI
          ? `${contentForAI}\n\n---\n\n## 圖片 OCR 識別結果\n\n${job.ocrText}`
          : job.ocrText;
      }

      addLog('info', `重新解析: ${job.url.substring(0, 50)}...`);

      const aiRes = await fetch('/api/ai-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown: contentForAI, url: job.url }),
      });

      if (!aiRes.ok) {
        throw new Error(`AI 解析失敗: ${aiRes.status}`);
      }

      const aiData = await aiRes.json();

      // 更新任務資料
      await updateScraperJob(job.id, {
        status: 'success',
        extractedData: aiData.plan,
        vendorName: aiData.plan?.vendorName,
        error: undefined,
      });

      await loadData();
      addLog('success', `重新解析完成: ${aiData.plan?.vendorName || '未知'}`);
      setSnackbar({ open: true, message: `重新解析成功：${aiData.plan?.vendorName || '未知'}` });

      // 切換到 AI 解析分頁
      setDetailTab(prev => ({ ...prev, [job.id]: 0 }));

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      addLog('error', `重新解析失敗: ${msg}`);
      setSnackbar({ open: true, message: `重新解析失敗: ${msg}` });
    } finally {
      setReParsingJob(null);
    }
  };

  // AI 視覺分析（直接讓 Claude 看圖片）
  const handleVisionAnalysis = async (job: ScraperJob) => {
    const selected = selectedImages[job.id];
    if (!selected || selected.size === 0 || !job.images) {
      setSnackbar({ open: true, message: '請先選擇要分析的圖片' });
      return;
    }

    const imagesToProcess = Array.from(selected)
      .sort((a, b) => a - b)
      .map(i => job.images![i])
      .filter(Boolean);

    if (imagesToProcess.length === 0) return;

    setVisionProcessing(prev => ({ ...prev, [job.id]: true }));

    try {
      addLog('info', `AI 視覺分析 (${selectedVisionAI}): ${imagesToProcess.length} 張圖片...`);

      const res = await fetch('/api/ai-vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: imagesToProcess,
          textContent: imageOnlyMode ? undefined : job.rawContent?.substring(0, 5000),
          url: job.url,
          cli: selectedVisionAI,
          imageOnly: imageOnlyMode,
        }),
      });

      const data = await res.json();

      if (data.success && data.plan) {
        // 儲存視覺分析結果
        setVisionResult(prev => ({
          ...prev,
          [job.id]: {
            plan: data.plan,
            raw: data.rawResponse || '',
            cli: data.cli || selectedVisionAI,
          },
        }));

        // 更新任務資料
        await updateScraperJob(job.id, {
          status: 'success',
          extractedData: data.plan,
          vendorName: data.plan.vendorName,
          error: undefined,
        });

        await loadData();
        addLog('success', `AI 視覺分析完成: ${data.plan.vendorName || '未知'}`);
        setSnackbar({
          open: true,
          message: `AI 視覺分析成功：${data.plan.vendorName || '未知'} - $${data.plan.priceDiscount || '?'}`,
        });
      } else {
        const errMsg = data.error || '解析失敗';
        addLog('error', `AI 視覺分析失敗: ${errMsg}`);
        setSnackbar({ open: true, message: `AI 視覺分析失敗: ${errMsg}` });
        // 儲存錯誤結果
        setVisionResult(prev => ({
          ...prev,
          [job.id]: null,
        }));
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      addLog('error', `AI 視覺分析異常: ${msg}`);
      setSnackbar({ open: true, message: `AI 視覺分析異常: ${msg}` });
    } finally {
      setVisionProcessing(prev => ({ ...prev, [job.id]: false }));
    }
  };

  // 批次重試所有失敗任務
  const handleRetryAllFailed = async () => {
    const failedJobs = jobs.filter(j => j.status === 'failed');
    if (failedJobs.length === 0) {
      setSnackbar({ open: true, message: '沒有失敗的任務可重試' });
      return;
    }

    setIsRetryingAll(true);
    setLogs([]);
    addLog('info', `開始批次重試 ${failedJobs.length} 個失敗任務...`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < failedJobs.length; i++) {
      const job = failedJobs[i];
      addLog('info', `[${i + 1}/${failedJobs.length}] 重試: ${job.url.substring(0, 50)}...`);

      // 更新狀態為 running
      await updateScraperJob(job.id, { status: 'running', startedAt: new Date(), error: undefined });

      const result = await scrapeUrl(job.url, job.id);
      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }

      // 批次間隔
      if (i < failedJobs.length - 1) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    setIsRetryingAll(false);
    await loadData();
    addLog('info', `批次重試完成：成功 ${successCount}，失敗 ${failCount}`);
    setSnackbar({ open: true, message: `批次重試完成：成功 ${successCount}，失敗 ${failCount}` });
  };

  // 匯入 URL 清單
  const handleImportUrls = () => {
    const urls = importUrls
      .split('\n')
      .map(u => u.trim())
      .filter(u => u.startsWith('http'));

    if (urls.length === 0) {
      setSnackbar({ open: true, message: '沒有有效的 URL' });
      return;
    }

    setBatchUrls(urls.join('\n'));
    setInputMode('batch');
    setShowImportDialog(false);
    setImportUrls('');
    setSnackbar({ open: true, message: `已匯入 ${urls.length} 個網址` });
  };

  // 處理檔案匯入
  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      let urls: string[] = [];

      if (file.name.endsWith('.json')) {
        try {
          const data = JSON.parse(content);
          if (Array.isArray(data)) {
            urls = data.map(item => typeof item === 'string' ? item : item.url || item.sourceUrl).filter(Boolean);
          } else if (data.urls) {
            urls = data.urls;
          }
        } catch {
          setSnackbar({ open: true, message: 'JSON 格式錯誤' });
          return;
        }
      } else {
        // CSV 或純文字
        urls = content.split(/[\n,]/).map(u => u.trim()).filter(u => u.startsWith('http'));
      }

      setImportUrls(urls.join('\n'));
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset input
  };

  // 開啟編輯資料對話框
  const handleEditData = (job: ScraperJob) => {
    if (!job.extractedData) {
      setSnackbar({ open: true, message: '此任務沒有解析資料可編輯' });
      return;
    }
    setEditingJobData({ jobId: job.id, data: { ...job.extractedData } });
  };

  // 儲存編輯的資料
  const handleSaveEditedData = async () => {
    if (!editingJobData) return;

    try {
      await updateScraperJob(editingJobData.jobId, {
        extractedData: editingJobData.data,
        vendorName: editingJobData.data.vendorName,
      });
      await loadData();
      setEditingJobData(null);
      setSnackbar({ open: true, message: '資料已更新' });
    } catch (error) {
      setSnackbar({ open: true, message: `更新失敗: ${error}` });
    }
  };

  // 將編輯的資料加入資料庫
  const handleSaveEditedToDatabase = async () => {
    if (!editingJobData) return;

    try {
      const job = jobs.find(j => j.id === editingJobData.jobId);
      await addPlan({
        vendorId: '',
        vendorName: editingJobData.data.vendorName || '（待填寫）',
        title: editingJobData.data.title || '匯入的方案',
        sourceUrl: job?.url || '',
        priceDiscount: editingJobData.data.priceDiscount || 0,
        shippingType: editingJobData.data.shippingType || 'delivery',
        storageType: editingJobData.data.storageType || 'frozen',
        servingsMin: editingJobData.data.servingsMin || 4,
        tags: editingJobData.data.tags || [],
        dishes: editingJobData.data.dishes || [],
        status: 'needs_review',
        ...editingJobData.data,
      });
      await loadPlans();
      setEditingJobData(null);
      setSnackbar({ open: true, message: '已新增至資料庫' });
    } catch (error) {
      setSnackbar({ open: true, message: `新增失敗: ${error}` });
    }
  };

  // ===== E1: 定時排程管理 =====
  const saveSchedule = (schedule: typeof editingSchedule) => {
    if (!schedule) return;

    setSchedules(prev => {
      const existing = prev.findIndex(s => s.id === schedule.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...schedule, urls: schedule.urls };
        return updated;
      }
      return [...prev, { ...schedule, urls: schedule.urls }];
    });
    localStorage.setItem('scraper-schedules', JSON.stringify(schedules));
    setEditingSchedule(null);
    setSnackbar({ open: true, message: '排程已儲存' });
  };

  const deleteSchedule = (id: string) => {
    setSchedules(prev => prev.filter(s => s.id !== id));
    setSnackbar({ open: true, message: '排程已刪除' });
  };

  const parseCron = (cron: string): string => {
    const parts = cron.split(' ');
    if (parts.length !== 5) return '無效格式';

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

    if (minute === '0' && hour === '*') return '每小時整點';
    if (minute === '0' && hour.startsWith('*/')) return `每 ${hour.slice(2)} 小時`;
    if (minute === '0' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
      return `每天 ${hour}:00`;
    }
    if (dayOfWeek !== '*') {
      const days = ['日', '一', '二', '三', '四', '五', '六'];
      return `每週${days[parseInt(dayOfWeek)]} ${hour}:${minute.padStart(2, '0')}`;
    }
    return cron;
  };

  // ===== E2: Webhook 通知 =====
  const saveWebhookConfig = () => {
    localStorage.setItem('scraper-webhook', JSON.stringify(webhookConfig));
    setSnackbar({ open: true, message: 'Webhook 設定已儲存' });
    setShowWebhookSettings(false);
  };

  const sendWebhook = async (event: string, data: Record<string, unknown>) => {
    if (!webhookConfig.enabled || !webhookConfig.url) return;
    if (!webhookConfig.events.includes(event)) return;

    try {
      const payload = {
        event,
        timestamp: new Date().toISOString(),
        data,
      };

      // 實際環境中應該透過 API route 發送以避免 CORS 問題
      console.log('[Webhook] Would send:', payload);
      // await fetch(webhookConfig.url, { method: 'POST', body: JSON.stringify(payload) });
    } catch (error) {
      console.error('[Webhook] Failed:', error);
    }
  };

  const testWebhook = async () => {
    await sendWebhook('test', { message: '這是一個測試通知' });
    setSnackbar({ open: true, message: 'Webhook 測試已發送 (查看 console)' });
  };

  // ===== E3: 代理池管理 =====
  const addProxy = () => {
    if (!newProxy.host || !newProxy.port) return;

    const proxy = {
      id: Date.now().toString(),
      host: newProxy.host,
      port: parseInt(newProxy.port),
      username: newProxy.username || undefined,
      password: newProxy.password || undefined,
      enabled: true,
      successRate: 100,
    };

    setProxyList(prev => [...prev, proxy]);
    setNewProxy({ host: '', port: '', username: '', password: '' });
    localStorage.setItem('scraper-proxies', JSON.stringify([...proxyList, proxy]));
  };

  const toggleProxy = (id: string) => {
    setProxyList(prev => prev.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p));
  };

  const deleteProxy = (id: string) => {
    setProxyList(prev => prev.filter(p => p.id !== id));
  };

  const getRandomProxy = () => {
    const enabledProxies = proxyList.filter(p => p.enabled);
    if (enabledProxies.length === 0) return null;
    return enabledProxies[Math.floor(Math.random() * enabledProxies.length)];
  };

  // ===== E4: 差異比對 =====
  const recordJobHistory = (jobId: string, data: Partial<Plan>) => {
    setJobHistory(prev => ({
      ...prev,
      [jobId]: [...(prev[jobId] || []).slice(-9), { data, timestamp: new Date() }],
    }));
  };

  const getDataDiff = (oldData: Partial<Plan>, newData: Partial<Plan>): { field: string; old: unknown; new: unknown }[] => {
    const diff: { field: string; old: unknown; new: unknown }[] = [];
    const fields = ['title', 'priceOriginal', 'priceDiscount', 'description', 'vendorName'] as const;

    for (const field of fields) {
      if (oldData[field] !== newData[field]) {
        diff.push({ field, old: oldData[field], new: newData[field] });
      }
    }

    return diff;
  };

  // 載入儲存的設定
  useEffect(() => {
    const savedWebhook = localStorage.getItem('scraper-webhook');
    if (savedWebhook) {
      try {
        setWebhookConfig(JSON.parse(savedWebhook));
      } catch {}
    }

    const savedProxies = localStorage.getItem('scraper-proxies');
    if (savedProxies) {
      try {
        setProxyList(JSON.parse(savedProxies));
      } catch {}
    }

    const savedSchedules = localStorage.getItem('scraper-schedules');
    if (savedSchedules) {
      try {
        setSchedules(JSON.parse(savedSchedules));
      } catch {}
    }
  }, []);

  const successRate = stats && stats.totalJobs > 0
    ? Math.round((stats.successJobs / stats.totalJobs) * 100)
    : 0;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5', p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <IconButton onClick={() => router.push('/admin')}>
          <ArrowLeft />
        </IconButton>
        <Typography variant="h5" fontWeight="bold">爬蟲控管</Typography>

        {/* 功能按鈕 */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<FolderOpen size={14} />}
            onClick={() => setShowSourceManager(true)}
          >
            網址來源
            {savedSources.length > 0 && (
              <Chip size="small" label={savedSources.length} sx={{ ml: 0.5, height: 18 }} />
            )}
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<Building2 size={14} />}
            onClick={() => setShowVendorConfig(true)}
          >
            廠商設定
            {vendorConfigs.length > 0 && (
              <Chip size="small" label={vendorConfigs.filter(c => c.enabled).length} color="secondary" sx={{ ml: 0.5, height: 18 }} />
            )}
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<Calendar size={14} />}
            onClick={() => setShowScheduleDialog(true)}
          >
            排程管理
            {schedules.length > 0 && (
              <Chip size="small" label={schedules.filter(s => s.enabled).length} color="primary" sx={{ ml: 0.5, height: 18 }} />
            )}
          </Button>
          {errorAnalytics && (
            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={<BarChart3 size={14} />}
              onClick={() => setShowErrorAnalytics(true)}
            >
              錯誤分析
              <Chip size="small" label={errorAnalytics.total} color="error" sx={{ ml: 0.5, height: 18 }} />
            </Button>
          )}
          <Button
            size="small"
            variant="outlined"
            color="warning"
            startIcon={isMonitoring ? <Loader size={14} className="animate-spin" /> : <Activity size={14} />}
            onClick={() => setShowMonitorPanel(true)}
          >
            價格監控
            {monitorTasks.length > 0 && (
              <Chip size="small" label={monitorTasks.filter(t => t.enabled).length} color="warning" sx={{ ml: 0.5, height: 18 }} />
            )}
          </Button>
          {/* 網域規則 */}
          <Button
            size="small"
            variant="outlined"
            startIcon={<Globe size={14} />}
            onClick={() => setShowDomainRules(true)}
          >
            網域規則
            {domainRules.filter(r => r.enabled).length > 0 && (
              <Chip size="small" label={domainRules.filter(r => r.enabled).length} sx={{ ml: 0.5, height: 18 }} />
            )}
          </Button>
          {/* 爬取佇列 */}
          <Button
            size="small"
            variant="outlined"
            color={queueItems.length > 0 ? 'primary' : 'inherit'}
            startIcon={<ListOrdered size={14} />}
            onClick={() => setShowQueuePanel(true)}
          >
            佇列
            {queueItems.length > 0 && (
              <Chip size="small" label={queueItems.filter(q => q.status === 'queued').length} color="primary" sx={{ ml: 0.5, height: 18 }} />
            )}
          </Button>
          {/* 日誌匯出 */}
          <Button
            size="small"
            variant="outlined"
            startIcon={<FileDown size={14} />}
            onClick={() => setShowLogExport(true)}
          >
            匯出
          </Button>
          {/* 分析報表 */}
          <Button
            size="small"
            variant="outlined"
            color="secondary"
            startIcon={<PieChart size={14} />}
            onClick={() => setShowAnalyticsPanel(true)}
          >
            分析報表
          </Button>

          {/* E 系列: 爬蟲強化 */}
          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
          <Button
            size="small"
            variant="outlined"
            startIcon={<CalendarClock size={14} />}
            onClick={() => setShowScheduleManager(true)}
            sx={{ borderColor: '#10b981', color: '#10b981', '&:hover': { borderColor: '#059669', bgcolor: '#ecfdf5' } }}
          >
            排程
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<Webhook size={14} />}
            onClick={() => setShowWebhookSettings(true)}
            sx={{ borderColor: '#6366f1', color: '#6366f1', '&:hover': { borderColor: '#4f46e5', bgcolor: '#eef2ff' } }}
          >
            Webhook
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<Network size={14} />}
            onClick={() => setShowProxyPool(true)}
            sx={{ borderColor: '#f59e0b', color: '#f59e0b', '&:hover': { borderColor: '#d97706', bgcolor: '#fffbeb' } }}
          >
            代理池
          </Button>

          <IconButton
            onClick={() => setShowNotifications(true)}
            sx={{ position: 'relative' }}
          >
            {unreadCount > 0 ? <BellRing size={20} color="#f59e0b" /> : <Bell size={20} />}
            {unreadCount > 0 && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  bgcolor: 'error.main',
                  color: 'white',
                  borderRadius: '50%',
                  width: 18,
                  height: 18,
                  fontSize: 10,
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </Box>
            )}
          </IconButton>
        </Box>

        {stats && (
          <Box sx={{ ml: 'auto', display: 'flex', gap: 1, alignItems: 'center' }}>
            <Chip
              label={`成功率 ${successRate}%`}
              size="small"
              color={successRate >= 80 ? 'success' : successRate >= 50 ? 'warning' : 'error'}
              variant="outlined"
            />
            <Chip label={`${stats.totalJobs} 筆`} size="small" variant="outlined" />
            <Chip icon={<CheckCircle size={12} />} label={stats.successJobs} size="small" color="success" />
            <Chip icon={<XCircle size={12} />} label={stats.failedJobs} size="small" color="error" />
          </Box>
        )}
      </Box>

      {/* 輸入區 */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* 服務選擇 */}
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>爬蟲服務</InputLabel>
            <Select
              value={selectedService}
              label="爬蟲服務"
              onChange={(e) => handleServiceChange(e.target.value as ScraperServiceType)}
            >
              {(Object.keys(scraperServices) as ScraperServiceType[]).map((key) => (
                <MenuItem key={key} value={key}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <span>{scraperServices[key].name}</span>
                    <Chip label={scraperServices[key].speed} size="small" sx={{ height: 18, fontSize: 10 }} />
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* 模式切換 */}
          <Box sx={{ display: 'flex', border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
            <Button
              size="small"
              variant={inputMode === 'single' ? 'contained' : 'text'}
              onClick={() => setInputMode('single')}
              sx={{ borderRadius: 0, px: 2 }}
            >
              單一網址
            </Button>
            <Button
              size="small"
              variant={inputMode === 'batch' ? 'contained' : 'text'}
              onClick={() => setInputMode('batch')}
              sx={{ borderRadius: 0, px: 2 }}
            >
              批次匯入
            </Button>
          </Box>

          {/* 匯入按鈕 */}
          <Button
            size="small"
            variant="outlined"
            startIcon={<Upload size={14} />}
            onClick={() => setShowImportDialog(true)}
          >
            匯入網址
          </Button>

          {/* 快捷提示 */}
          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
            {inputMode === 'single' ? '按 Enter 快速爬取' : '每行一個網址'}
          </Typography>
        </Box>

        {/* 網址輸入 */}
        {inputMode === 'single' ? (
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="貼上年菜網址，例如：https://www.xxx.com/meal/123"
              value={singleUrl}
              onChange={(e) => setSingleUrl(e.target.value)}
              disabled={isProcessing}
              onKeyDown={(e) => e.key === 'Enter' && !isProcessing && singleUrl.trim() && handleScrape()}
              InputProps={{
                sx: { fontFamily: 'monospace', fontSize: 13 }
              }}
            />
            <Button
              variant="contained"
              startIcon={isProcessing ? <Loader size={16} className="animate-spin" /> : <Zap size={16} />}
              onClick={handleScrape}
              disabled={isProcessing || !singleUrl.trim()}
              sx={{ minWidth: 100 }}
            >
              {isProcessing ? '處理中' : '爬取'}
            </Button>
          </Box>
        ) : (
          <Box sx={{ mb: 2 }}>
            <TextField
              fullWidth
              multiline
              rows={5}
              size="small"
              placeholder={`每行一個網址：\nhttps://www.example1.com/meal\nhttps://www.example2.com/meal`}
              value={batchUrls}
              onChange={(e) => setBatchUrls(e.target.value)}
              disabled={isProcessing}
              sx={{ mb: 1, '& textarea': { fontFamily: 'monospace', fontSize: 12 } }}
            />
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              {!isProcessing ? (
                <Button
                  variant="contained"
                  startIcon={<Play size={16} />}
                  onClick={handleScrape}
                  disabled={!batchUrls.trim()}
                >
                  開始批次爬取 ({batchUrls.split('\n').filter(u => u.trim().startsWith('http')).length} 個)
                </Button>
              ) : (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<StopCircle size={16} />}
                  onClick={handleCancel}
                >
                  取消
                </Button>
              )}

              {isProcessing && (
                <>
                  <Box sx={{ flex: 1, mx: 2 }}>
                    <LinearProgress
                      variant="determinate"
                      value={(batchProgress.current / batchProgress.total) * 100}
                      sx={{ height: 8, borderRadius: 1 }}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="body2" color="text.secondary" component="span">
                      {batchProgress.current}/{batchProgress.total}
                    </Typography>
                    {batchProgress.success > 0 && <Chip label={`✓${batchProgress.success}`} size="small" color="success" sx={{ height: 20 }} />}
                    {batchProgress.failed > 0 && <Chip label={`✗${batchProgress.failed}`} size="small" color="error" sx={{ height: 20 }} />}
                  </Box>
                </>
              )}
            </Box>
          </Box>
        )}

        {/* 單一模式結果提示 */}
        {result && inputMode === 'single' && !showResultDialog && (
          <Alert
            severity={result.success ? 'success' : 'error'}
            sx={{ mb: 2 }}
            action={
              result.success && (
                <Button color="inherit" size="small" onClick={() => setShowResultDialog(true)}>
                  查看詳情
                </Button>
              )
            }
          >
            {result.message}
          </Alert>
        )}

        {/* 即時日誌 */}
        {logs.length > 0 && (
          <Box
            sx={{
              bgcolor: 'grey.900',
              borderRadius: 1,
              p: 1.5,
              maxHeight: 180,
              overflow: 'auto',
              fontFamily: 'monospace',
              fontSize: 11,
            }}
          >
            {logs.map((log, idx) => (
              <Box key={idx} sx={{ mb: 0.3 }}>
                <Typography
                  component="span"
                  sx={{
                    color: log.level === 'error' ? '#f87171' : log.level === 'success' ? '#4ade80' : log.level === 'warn' ? '#fbbf24' : '#60a5fa',
                  }}
                >
                  [{format(log.timestamp, 'HH:mm:ss')}]
                </Typography>{' '}
                <Typography component="span" sx={{ color: '#d1d5db' }}>
                  {log.message}
                </Typography>
              </Box>
            ))}
            <div ref={logsEndRef} />
          </Box>
        )}
      </Paper>

      {/* 歷史紀錄 */}
      <Paper sx={{ overflow: 'hidden' }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="h6">爬取紀錄</Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* 狀態過濾 */}
            <ToggleButtonGroup
              value={statusFilter}
              exclusive
              onChange={(_, v) => v && setStatusFilter(v)}
              size="small"
              sx={{ '& .MuiToggleButton-root': { px: 1.5, py: 0.5, fontSize: 12 } }}
            >
              <ToggleButton value="all">全部</ToggleButton>
              <ToggleButton value="success">成功</ToggleButton>
              <ToggleButton value="failed">失敗</ToggleButton>
              <ToggleButton value="running">執行中</ToggleButton>
            </ToggleButtonGroup>
            <Button
              size="small"
              startIcon={<RefreshCw size={14} />}
              onClick={loadData}
            >
              重新整理
            </Button>
            {jobs.length > 0 && (
              <>
                <Button
                  size="small"
                  startIcon={<Download size={14} />}
                  onClick={handleExport}
                >
                  匯出
                </Button>
                <Button
                  size="small"
                  color="error"
                  startIcon={<Trash2 size={14} />}
                  onClick={() => setShowClearDialog(true)}
                >
                  清除全部
                </Button>
                {/* 批次重試失敗任務 */}
                {jobs.filter(j => j.status === 'failed').length > 0 && (
                  <Button
                    size="small"
                    color="warning"
                    variant="contained"
                    startIcon={isRetryingAll ? <Loader size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                    onClick={handleRetryAllFailed}
                    disabled={isRetryingAll || isProcessing}
                  >
                    {isRetryingAll ? '重試中...' : `重試失敗 (${jobs.filter(j => j.status === 'failed').length})`}
                  </Button>
                )}
              </>
            )}
          </Box>
        </Box>

        <TableContainer sx={{ maxHeight: 350 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell width={40}></TableCell>
                <TableCell>來源</TableCell>
                <TableCell width={90}>狀態</TableCell>
                <TableCell width={70}>耗時</TableCell>
                <TableCell width={100}>時間</TableCell>
                <TableCell width={100}>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredJobs.map((job) => (
                <Fragment key={job.id}>
                  <TableRow hover sx={{ '& > *': { borderBottom: expandedJobId === job.id ? 0 : undefined } }}>
                    <TableCell>
                      <IconButton size="small" onClick={() => setExpandedJobId(expandedJobId === job.id ? null : job.id)}>
                        {expandedJobId === job.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </IconButton>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 250 }}>
                          {job.vendorName || new URL(job.url).hostname}
                        </Typography>
                        <Tooltip title="複製網址">
                          <IconButton size="small" onClick={() => handleCopyUrl(job.url)}>
                            <Copy size={12} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="開啟連結">
                          <IconButton size="small" component="a" href={job.url} target="_blank">
                            <ExternalLink size={12} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        icon={statusConfig[job.status].icon}
                        label={statusConfig[job.status].label}
                        color={statusConfig[job.status].color}
                        sx={{ '& .MuiChip-icon': { fontSize: 12 } }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {job.duration ? `${Math.round(job.duration / 1000)}s` : '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {job.startedAt && format(new Date(job.startedAt), 'MM/dd HH:mm')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {job.status === 'failed' && (
                          <Tooltip title="重試">
                            <IconButton size="small" onClick={() => handleRetry(job)} color="primary">
                              <RefreshCw size={14} />
                            </IconButton>
                          </Tooltip>
                        )}
                        {job.status === 'success' && job.extractedData && (
                          <>
                            <Tooltip title="編輯資料">
                              <IconButton size="small" onClick={() => handleEditData(job)} color="primary">
                                <Edit3 size={14} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="比對差異">
                              <IconButton size="small" onClick={() => handleShowDiff(job)} color="warning">
                                <ArrowLeftRight size={14} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="AI 模型比較">
                              <IconButton size="small" onClick={() => handleAICompare(job)} color="secondary">
                                <GitCompare size={14} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="預覽後加入">
                              <IconButton size="small" onClick={() => handlePreviewBeforeAdd(job)} color="success">
                                <Eye size={14} />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                        <Tooltip title="刪除">
                          <IconButton size="small" onClick={() => deleteScraperJob(job.id).then(loadData)} color="error">
                            <Trash2 size={14} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={6} sx={{ py: 0 }}>
                      <Collapse in={expandedJobId === job.id}>
                        <Box sx={{ p: 2, bgcolor: 'grey.50' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', wordBreak: 'break-all', flex: 1 }}>
                              {job.url}
                            </Typography>
                            <Tooltip title="複製網址">
                              <IconButton size="small" onClick={() => handleCopyUrl(job.url)}>
                                <Copy size={14} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                          {job.error && (
                            <Alert severity="error" sx={{ mt: 1 }} icon={<XCircle size={16} />}>
                              {job.error}
                            </Alert>
                          )}

                          {/* 分頁：AI 解析結果 / 原始內容 / OCR / 圖片 */}
                          {(job.extractedData || job.rawContent || job.ocrText || (job.images && job.images.length > 0)) && (
                            <Box sx={{ mt: 1 }}>
                              <Tabs
                                value={detailTab[job.id] || 0}
                                onChange={(_, v) => setDetailTab({ ...detailTab, [job.id]: v })}
                                sx={{ minHeight: 32, mb: 1, '& .MuiTab-root': { minHeight: 32, py: 0.5, fontSize: 12 } }}
                                variant="scrollable"
                                scrollButtons="auto"
                              >
                                <Tab icon={<Code size={14} />} iconPosition="start" label="AI 解析" disabled={!job.extractedData} />
                                <Tab icon={<FileText size={14} />} iconPosition="start" label={`原始內容 ${job.rawContent ? `(${(job.rawContent.length / 1000).toFixed(1)}K)` : ''}`} disabled={!job.rawContent} />
                                <Tab icon={<ScanText size={14} />} iconPosition="start" label={`OCR ${job.ocrText ? `(${(job.ocrText.length / 1000).toFixed(1)}K)` : ''}`} disabled={!job.ocrText} />
                                <Tab icon={<Image size={14} />} iconPosition="start" label={`圖片 ${job.images ? `(${job.images.length})` : ''}`} disabled={!job.images || job.images.length === 0} />
                              </Tabs>

                              {/* AI 解析結果 */}
                              {(detailTab[job.id] || 0) === 0 && job.extractedData && (
                                <Box>
                                  <Box sx={{ display: 'flex', gap: 2, mb: 1, flexWrap: 'wrap' }}>
                                    {job.extractedData.vendorName && (
                                      <Chip label={`餐廳: ${job.extractedData.vendorName}`} size="small" />
                                    )}
                                    {job.extractedData.priceDiscount && (
                                      <Chip label={`$${job.extractedData.priceDiscount}`} size="small" color="primary" />
                                    )}
                                    {job.extractedData.servingsMin && (
                                      <Chip label={`${job.extractedData.servingsMin}人份`} size="small" variant="outlined" />
                                    )}
                                  </Box>
                                  <pre style={{ fontSize: 10, maxHeight: 200, overflow: 'auto', margin: 0, padding: 8, background: '#f9fafb', borderRadius: 4 }}>
                                    {JSON.stringify(job.extractedData, null, 2)}
                                  </pre>
                                </Box>
                              )}

                              {/* 原始內容 */}
                              {detailTab[job.id] === 1 && job.rawContent && (
                                <Box>
                                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 0.5 }}>
                                    <Tooltip title="複製原始內容">
                                      <IconButton size="small" onClick={() => handleCopyUrl(job.rawContent!)}>
                                        <Copy size={14} />
                                      </IconButton>
                                    </Tooltip>
                                  </Box>
                                  <pre style={{
                                    fontSize: 11,
                                    maxHeight: 300,
                                    overflow: 'auto',
                                    margin: 0,
                                    padding: 12,
                                    background: '#1e1e1e',
                                    color: '#d4d4d4',
                                    borderRadius: 4,
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                  }}>
                                    {job.rawContent}
                                  </pre>
                                </Box>
                              )}

                              {/* OCR 結果 */}
                              {detailTab[job.id] === 2 && job.ocrText && (
                                <Box>
                                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 0.5 }}>
                                    <Tooltip title="複製 OCR 內容">
                                      <IconButton size="small" onClick={() => handleCopyUrl(job.ocrText!)}>
                                        <Copy size={14} />
                                      </IconButton>
                                    </Tooltip>
                                  </Box>
                                  <pre style={{
                                    fontSize: 12,
                                    maxHeight: 300,
                                    overflow: 'auto',
                                    margin: 0,
                                    padding: 12,
                                    background: '#fefce8',
                                    color: '#854d0e',
                                    borderRadius: 4,
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                    border: '1px solid #fde047',
                                  }}>
                                    {job.ocrText}
                                  </pre>
                                </Box>
                              )}

                              {/* 圖片列表 */}
                              {detailTab[job.id] === 3 && job.images && job.images.length > 0 && (() => {
                                const filteredImgs = getFilteredImages(job.images);
                                const selectedCount = selectedImages[job.id]?.size || 0;
                                return (
                                <Box>
                                  {/* 過濾和選取工具列 */}
                                  <Box sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center', flexWrap: 'wrap', p: 1, bgcolor: '#f8fafc', borderRadius: 1 }}>
                                    <Filter size={14} />
                                    <Typography variant="caption" sx={{ mr: 0.5 }}>尺寸 ≥</Typography>
                                    <ToggleButtonGroup
                                      value={minImageSize}
                                      exclusive
                                      onChange={(_, v) => v !== null && setMinImageSize(v)}
                                      size="small"
                                      sx={{ '& .MuiToggleButton-root': { px: 1, py: 0, fontSize: 10, minWidth: 40 } }}
                                    >
                                      <ToggleButton value={0}>全部</ToggleButton>
                                      <ToggleButton value={100}>100</ToggleButton>
                                      <ToggleButton value={200}>200</ToggleButton>
                                      <ToggleButton value={300}>300</ToggleButton>
                                      <ToggleButton value={500}>500</ToggleButton>
                                    </ToggleButtonGroup>
                                    <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      startIcon={<Zap size={12} />}
                                      onClick={() => smartSelectImages(job.id, job.images!)}
                                      sx={{ fontSize: 11, py: 0.3 }}
                                    >
                                      智慧選取
                                    </Button>
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      startIcon={selectedCount === filteredImgs.length ? <CheckSquare size={12} /> : <Square size={12} />}
                                      onClick={() => {
                                        const indices = filteredImgs.map(f => f.originalIndex);
                                        setSelectedImages(prev => ({
                                          ...prev,
                                          [job.id]: selectedCount === filteredImgs.length ? new Set() : new Set(indices)
                                        }));
                                      }}
                                      sx={{ fontSize: 11, py: 0.3 }}
                                    >
                                      {selectedCount === filteredImgs.length ? '取消' : '全選'}
                                    </Button>
                                    <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                                      顯示 {filteredImgs.length}/{job.images.length} · 已選 {selectedCount}
                                    </Typography>
                                  </Box>

                                  {/* 分析工具列 */}
                                  <Box sx={{ display: 'flex', gap: 1, mb: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
                                    <Button
                                      size="small"
                                      variant="contained"
                                      color="warning"
                                      startIcon={ocrProcessing[job.id] ? <Loader size={14} className="animate-spin" /> : <ScanText size={14} />}
                                      onClick={() => handleManualOcr(job)}
                                      disabled={ocrProcessing[job.id] || visionProcessing[job.id] || !selectedCount}
                                    >
                                      {ocrProcessing[job.id] ? 'OCR 中...' : `OCR (${selectedCount})`}
                                    </Button>
                                    <Divider orientation="vertical" flexItem />
                                    <ToggleButtonGroup
                                      value={selectedVisionAI}
                                      exclusive
                                      onChange={(_, v) => v && setSelectedVisionAI(v)}
                                      size="small"
                                      sx={{ '& .MuiToggleButton-root': { px: 1.5, py: 0.3, fontSize: 11 } }}
                                    >
                                      <ToggleButton value="claude">Claude</ToggleButton>
                                      <ToggleButton value="gemini">Gemini</ToggleButton>
                                    </ToggleButtonGroup>
                                    <ToggleButtonGroup
                                      value={imageOnlyMode ? 'image' : 'mixed'}
                                      exclusive
                                      onChange={(_, v) => v && setImageOnlyMode(v === 'image')}
                                      size="small"
                                      sx={{ '& .MuiToggleButton-root': { px: 1, py: 0.3, fontSize: 10 } }}
                                    >
                                      <ToggleButton value="image">
                                        <Tooltip title="只分析圖片內容">
                                          <span>純圖片</span>
                                        </Tooltip>
                                      </ToggleButton>
                                      <ToggleButton value="mixed">
                                        <Tooltip title="圖片+網頁文字">
                                          <span>圖+文</span>
                                        </Tooltip>
                                      </ToggleButton>
                                    </ToggleButtonGroup>
                                    <Button
                                      size="small"
                                      variant="contained"
                                      startIcon={visionProcessing[job.id] ? <Loader size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                      onClick={() => handleVisionAnalysis(job)}
                                      disabled={ocrProcessing[job.id] || visionProcessing[job.id] || !selectedCount}
                                      sx={{ bgcolor: selectedVisionAI === 'claude' ? '#8b5cf6' : '#4285f4', '&:hover': { bgcolor: selectedVisionAI === 'claude' ? '#7c3aed' : '#3367d6' } }}
                                    >
                                      {visionProcessing[job.id] ? 'AI 分析中...' : `視覺分析 (${selectedCount})`}
                                    </Button>
                                  </Box>

                                  {/* 圖片網格 */}
                                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                    {filteredImgs.map(({ url: imgUrl, originalIndex: idx }) => {
                                      const isSelected = selectedImages[job.id]?.has(idx) || false;
                                      const size = imageSizes[imgUrl];
                                      // 載入尺寸
                                      if (!size) loadImageSize(imgUrl);
                                      return (
                                        <Tooltip key={idx} title={size ? `${size.w} x ${size.h}` : '載入中...'} placement="top">
                                        <Box
                                          sx={{
                                            position: 'relative',
                                            width: 100,
                                            height: 100,
                                            borderRadius: 1,
                                            overflow: 'hidden',
                                            bgcolor: 'grey.200',
                                            cursor: 'pointer',
                                            border: isSelected ? '3px solid #f59e0b' : '3px solid transparent',
                                            boxShadow: isSelected ? '0 0 0 2px rgba(245, 158, 11, 0.3)' : 'none',
                                            transition: 'all 0.15s ease',
                                            '&:hover': {
                                              opacity: 0.9,
                                              transform: 'scale(1.02)',
                                            },
                                          }}
                                          onClick={() => toggleImageSelect(job.id, idx)}
                                          onDoubleClick={() => window.open(imgUrl, '_blank')}
                                        >
                                          <img
                                            src={imgUrl}
                                            alt={`圖片 ${idx + 1}`}
                                            style={{
                                              width: '100%',
                                              height: '100%',
                                              objectFit: 'cover',
                                            }}
                                            onError={(e) => {
                                              (e.target as HTMLImageElement).style.display = 'none';
                                            }}
                                          />
                                          {/* 選擇指示器 */}
                                          <Box
                                            sx={{
                                              position: 'absolute',
                                              top: 4,
                                              right: 4,
                                              width: 20,
                                              height: 20,
                                              borderRadius: '50%',
                                              bgcolor: isSelected ? '#f59e0b' : 'rgba(255,255,255,0.8)',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              border: '2px solid white',
                                              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                                            }}
                                          >
                                            {isSelected && <CheckCircle size={12} color="white" />}
                                          </Box>
                                          {/* 編號和尺寸 */}
                                          <Box
                                            sx={{
                                              position: 'absolute',
                                              bottom: 0,
                                              left: 0,
                                              right: 0,
                                              bgcolor: isSelected ? 'rgba(245, 158, 11, 0.9)' : 'rgba(0,0,0,0.6)',
                                              color: 'white',
                                              px: 0.5,
                                              py: 0.2,
                                              display: 'flex',
                                              justifyContent: 'space-between',
                                              alignItems: 'center',
                                            }}
                                          >
                                            <Typography variant="caption" sx={{ fontSize: 10, fontWeight: isSelected ? 'bold' : 'normal' }}>
                                              #{idx + 1}
                                            </Typography>
                                            {size && (
                                              <Typography variant="caption" sx={{ fontSize: 8, opacity: 0.9 }}>
                                                {size.w}x{size.h}
                                              </Typography>
                                            )}
                                          </Box>
                                        </Box>
                                        </Tooltip>
                                      );
                                    })}
                                  </Box>

                                  {/* 手動 OCR 結果 */}
                                  {manualOcrResult[job.id] && (
                                    <Box sx={{ mt: 2 }}>
                                      <Typography variant="subtitle2" sx={{ mb: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <ScanText size={14} /> 手動 OCR 結果
                                      </Typography>
                                      <pre style={{
                                        fontSize: 12,
                                        maxHeight: 200,
                                        overflow: 'auto',
                                        margin: 0,
                                        padding: 12,
                                        background: '#fef3c7',
                                        color: '#92400e',
                                        borderRadius: 4,
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word',
                                        border: '1px solid #fcd34d',
                                      }}>
                                        {manualOcrResult[job.id]}
                                      </pre>
                                    </Box>
                                  )}

                                  {/* AI 視覺分析結果 */}
                                  {visionResult[job.id] && (
                                    <Box sx={{ mt: 2 }}>
                                      <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <Sparkles size={14} /> AI 視覺分析結果
                                        <Chip
                                          label={visionResult[job.id]!.cli.toUpperCase()}
                                          size="small"
                                          sx={{
                                            ml: 1,
                                            height: 18,
                                            fontSize: 10,
                                            bgcolor: visionResult[job.id]!.cli === 'claude' ? '#8b5cf6' : '#4285f4',
                                            color: 'white',
                                          }}
                                        />
                                      </Typography>

                                      {/* 摘要卡片 */}
                                      <Box sx={{
                                        p: 2,
                                        mb: 1.5,
                                        borderRadius: 2,
                                        background: 'linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)',
                                        border: '1px solid #c4b5fd',
                                      }}>
                                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: 1 }}>
                                          <Typography variant="h6" sx={{ color: '#6b21a8', fontWeight: 'bold' }}>
                                            {visionResult[job.id]!.plan.vendorName || '未知店家'}
                                          </Typography>
                                          {visionResult[job.id]!.plan.priceDiscount && (
                                            <Chip
                                              label={`$${visionResult[job.id]!.plan.priceDiscount.toLocaleString()}`}
                                              color="error"
                                              sx={{ fontWeight: 'bold' }}
                                            />
                                          )}
                                          {visionResult[job.id]!.plan.priceOriginal && (
                                            <Typography variant="body2" sx={{ textDecoration: 'line-through', color: '#9ca3af' }}>
                                              原價 ${visionResult[job.id]!.plan.priceOriginal.toLocaleString()}
                                            </Typography>
                                          )}
                                        </Box>
                                        <Typography variant="body1" sx={{ color: '#581c87', mb: 1 }}>
                                          {visionResult[job.id]!.plan.title || '未知方案'}
                                        </Typography>
                                        {visionResult[job.id]!.plan.description && (
                                          <Typography variant="body2" sx={{ color: '#7c3aed', mb: 1 }}>
                                            {visionResult[job.id]!.plan.description}
                                          </Typography>
                                        )}
                                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                                          {visionResult[job.id]!.plan.servingsMin && (
                                            <Chip
                                              label={`${visionResult[job.id]!.plan.servingsMin}${visionResult[job.id]!.plan.servingsMax ? `-${visionResult[job.id]!.plan.servingsMax}` : ''} 人份`}
                                              size="small"
                                              variant="outlined"
                                            />
                                          )}
                                          {visionResult[job.id]!.plan.shippingType && (
                                            <Chip
                                              label={visionResult[job.id]!.plan.shippingType === 'delivery' ? '宅配' : visionResult[job.id]!.plan.shippingType === 'pickup' ? '自取' : '宅配/自取'}
                                              size="small"
                                              variant="outlined"
                                            />
                                          )}
                                          {visionResult[job.id]!.plan.storageType && visionResult[job.id]!.plan.storageType !== 'unknown' && (
                                            <Chip
                                              label={visionResult[job.id]!.plan.storageType === 'frozen' ? '冷凍' : visionResult[job.id]!.plan.storageType === 'chilled' ? '冷藏' : '常溫'}
                                              size="small"
                                              variant="outlined"
                                            />
                                          )}
                                          {visionResult[job.id]!.plan.shippingFee !== undefined && (
                                            <Chip
                                              label={visionResult[job.id]!.plan.shippingFee === 0 ? '免運' : `運費 $${visionResult[job.id]!.plan.shippingFee}`}
                                              size="small"
                                              color={visionResult[job.id]!.plan.shippingFee === 0 ? 'success' : 'default'}
                                              variant="outlined"
                                            />
                                          )}
                                        </Box>
                                        {/* 菜色 */}
                                        {visionResult[job.id]!.plan.dishes && visionResult[job.id]!.plan.dishes!.length > 0 && (
                                          <Box sx={{ mt: 1.5 }}>
                                            <Typography variant="caption" sx={{ color: '#7c3aed', fontWeight: 'bold' }}>
                                              菜色 ({visionResult[job.id]!.plan.dishes!.length} 道)：
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#6b21a8', mt: 0.5 }}>
                                              {visionResult[job.id]!.plan.dishes!.join('、')}
                                            </Typography>
                                          </Box>
                                        )}
                                        {/* 標籤 */}
                                        {visionResult[job.id]!.plan.tags && visionResult[job.id]!.plan.tags!.length > 0 && (
                                          <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                            {visionResult[job.id]!.plan.tags!.map((tag, i) => (
                                              <Chip key={i} label={tag} size="small" sx={{ fontSize: 10, height: 20, bgcolor: '#ddd6fe' }} />
                                            ))}
                                          </Box>
                                        )}
                                        {/* 促銷資訊 */}
                                        {visionResult[job.id]!.plan.promotions && visionResult[job.id]!.plan.promotions!.length > 0 && (
                                          <Box sx={{ mt: 1.5, p: 1.5, bgcolor: '#fef3c7', borderRadius: 1, border: '1px solid #fcd34d' }}>
                                            <Typography variant="caption" sx={{ color: '#92400e', fontWeight: 'bold' }}>
                                              促銷活動：
                                            </Typography>
                                            <Box sx={{ mt: 0.5 }}>
                                              {visionResult[job.id]!.plan.promotions!.map((promo, i) => (
                                                <Typography key={i} variant="body2" sx={{ color: '#78350f' }}>
                                                  • {promo}
                                                </Typography>
                                              ))}
                                            </Box>
                                          </Box>
                                        )}
                                        {/* 可見文字 */}
                                        {visionResult[job.id]!.plan.visibleText && (
                                          <Box sx={{ mt: 1.5 }}>
                                            <Typography variant="caption" sx={{ color: '#7c3aed', fontWeight: 'bold' }}>
                                              圖片中的文字：
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#581c87', mt: 0.5, whiteSpace: 'pre-wrap', fontSize: 11 }}>
                                              {visionResult[job.id]!.plan.visibleText}
                                            </Typography>
                                          </Box>
                                        )}
                                      </Box>

                                      {/* 完整 JSON */}
                                      <details>
                                        <summary style={{ cursor: 'pointer', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                                          查看完整 JSON
                                        </summary>
                                        <pre style={{
                                          fontSize: 10,
                                          maxHeight: 200,
                                          overflow: 'auto',
                                          margin: 0,
                                          padding: 8,
                                          background: '#faf5ff',
                                          color: '#581c87',
                                          borderRadius: 4,
                                          whiteSpace: 'pre-wrap',
                                          wordBreak: 'break-word',
                                          border: '1px solid #e9d5ff',
                                        }}>
                                          {JSON.stringify(visionResult[job.id]!.plan, null, 2)}
                                        </pre>
                                      </details>
                                    </Box>
                                  )}
                                </Box>
                                );
                              })()}
                            </Box>
                          )}
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </Fragment>
              ))}
              {filteredJobs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    {statusFilter === 'all' ? '尚無爬取紀錄，貼上網址開始吧！' : `沒有${statusConfig[statusFilter]?.label || ''}的紀錄`}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* 結果詳情對話框 */}
      <Dialog open={showResultDialog} onClose={() => setShowResultDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>解析結果</DialogTitle>
        <DialogContent>
          {result?.data && (
            <Box>
              <Box sx={{ mb: 2 }}>
                <Typography variant="h6">{result.data.vendorName}</Typography>
                <Typography variant="body2" color="text.secondary">{result.data.title}</Typography>
              </Box>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
                {result.data.priceDiscount && (
                  <Chip label={`售價 $${result.data.priceDiscount}`} color="primary" />
                )}
                {result.data.priceOriginal && (
                  <Chip label={`原價 $${result.data.priceOriginal}`} variant="outlined" />
                )}
                {result.data.servingsMin && (
                  <Chip label={`${result.data.servingsMin}${result.data.servingsMax ? `-${result.data.servingsMax}` : ''} 人份`} variant="outlined" />
                )}
              </Box>
              <pre style={{ fontSize: 11, maxHeight: 200, overflow: 'auto', background: '#f5f5f5', padding: 12, borderRadius: 8 }}>
                {JSON.stringify(result.data, null, 2)}
              </pre>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowResultDialog(false)}>關閉</Button>
          <Button variant="contained" onClick={handleAddToDatabase} startIcon={<Database size={16} />}>
            加入資料庫
          </Button>
        </DialogActions>
      </Dialog>

      {/* 清除確認對話框 */}
      <Dialog open={showClearDialog} onClose={() => setShowClearDialog(false)}>
        <DialogTitle>確認清除</DialogTitle>
        <DialogContent>
          確定要清除所有 {jobs.length} 筆爬取紀錄嗎？此操作無法復原。
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowClearDialog(false)}>取消</Button>
          <Button color="error" variant="contained" onClick={handleClearAll}>
            確認清除
          </Button>
        </DialogActions>
      </Dialog>

      {/* 匯入 URL 對話框 */}
      <Dialog open={showImportDialog} onClose={() => setShowImportDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>匯入網址清單</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            支援格式：每行一個網址、JSON 陣列、CSV 檔案
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={8}
            placeholder={`https://example.com/meal1\nhttps://example.com/meal2\nhttps://example.com/meal3`}
            value={importUrls}
            onChange={(e) => setImportUrls(e.target.value)}
            sx={{ mb: 2, '& textarea': { fontFamily: 'monospace', fontSize: 12 } }}
          />
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Button
              variant="outlined"
              component="label"
              startIcon={<Upload size={14} />}
              size="small"
            >
              上傳檔案
              <input
                type="file"
                hidden
                accept=".json,.csv,.txt"
                onChange={handleFileImport}
              />
            </Button>
            <Typography variant="caption" color="text.secondary">
              支援 .json, .csv, .txt
            </Typography>
          </Box>
          {importUrls && (
            <Typography variant="caption" color="primary" sx={{ display: 'block', mt: 1 }}>
              偵測到 {importUrls.split('\n').filter(u => u.trim().startsWith('http')).length} 個有效網址
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setShowImportDialog(false); setImportUrls(''); }}>取消</Button>
          <Button
            variant="contained"
            onClick={handleImportUrls}
            disabled={!importUrls.trim()}
          >
            匯入到批次區
          </Button>
        </DialogActions>
      </Dialog>

      {/* 編輯資料對話框 */}
      <Dialog open={!!editingJobData} onClose={() => setEditingJobData(null)} maxWidth="md" fullWidth>
        <DialogTitle>編輯解析資料</DialogTitle>
        <DialogContent>
          {editingJobData && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="餐廳名稱"
                  fullWidth
                  value={editingJobData.data.vendorName || ''}
                  onChange={(e) => setEditingJobData({
                    ...editingJobData,
                    data: { ...editingJobData.data, vendorName: e.target.value }
                  })}
                />
                <TextField
                  label="方案名稱"
                  fullWidth
                  value={editingJobData.data.title || ''}
                  onChange={(e) => setEditingJobData({
                    ...editingJobData,
                    data: { ...editingJobData.data, title: e.target.value }
                  })}
                />
              </Box>
              <TextField
                label="描述"
                fullWidth
                multiline
                rows={2}
                value={editingJobData.data.description || ''}
                onChange={(e) => setEditingJobData({
                  ...editingJobData,
                  data: { ...editingJobData.data, description: e.target.value }
                })}
              />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="售價"
                  type="number"
                  value={editingJobData.data.priceDiscount || ''}
                  onChange={(e) => setEditingJobData({
                    ...editingJobData,
                    data: { ...editingJobData.data, priceDiscount: Number(e.target.value) || 0 }
                  })}
                />
                <TextField
                  label="原價"
                  type="number"
                  value={editingJobData.data.priceOriginal || ''}
                  onChange={(e) => setEditingJobData({
                    ...editingJobData,
                    data: { ...editingJobData.data, priceOriginal: Number(e.target.value) || undefined }
                  })}
                />
                <TextField
                  label="運費"
                  type="number"
                  value={editingJobData.data.shippingFee ?? ''}
                  onChange={(e) => setEditingJobData({
                    ...editingJobData,
                    data: { ...editingJobData.data, shippingFee: e.target.value ? Number(e.target.value) : undefined }
                  })}
                />
              </Box>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="最少人數"
                  type="number"
                  value={editingJobData.data.servingsMin || ''}
                  onChange={(e) => setEditingJobData({
                    ...editingJobData,
                    data: { ...editingJobData.data, servingsMin: Number(e.target.value) || 4 }
                  })}
                />
                <TextField
                  label="最多人數"
                  type="number"
                  value={editingJobData.data.servingsMax || ''}
                  onChange={(e) => setEditingJobData({
                    ...editingJobData,
                    data: { ...editingJobData.data, servingsMax: Number(e.target.value) || undefined }
                  })}
                />
                <FormControl sx={{ minWidth: 120 }}>
                  <InputLabel>配送方式</InputLabel>
                  <Select
                    value={editingJobData.data.shippingType || 'delivery'}
                    label="配送方式"
                    onChange={(e) => setEditingJobData({
                      ...editingJobData,
                      data: { ...editingJobData.data, shippingType: e.target.value as 'delivery' | 'pickup' | 'both' }
                    })}
                  >
                    <MenuItem value="delivery">宅配</MenuItem>
                    <MenuItem value="pickup">自取</MenuItem>
                    <MenuItem value="both">皆可</MenuItem>
                  </Select>
                </FormControl>
                <FormControl sx={{ minWidth: 120 }}>
                  <InputLabel>保存方式</InputLabel>
                  <Select
                    value={editingJobData.data.storageType || 'frozen'}
                    label="保存方式"
                    onChange={(e) => setEditingJobData({
                      ...editingJobData,
                      data: { ...editingJobData.data, storageType: e.target.value as 'frozen' | 'chilled' | 'room_temp' | 'unknown' }
                    })}
                  >
                    <MenuItem value="frozen">冷凍</MenuItem>
                    <MenuItem value="chilled">冷藏</MenuItem>
                    <MenuItem value="room_temp">常溫</MenuItem>
                    <MenuItem value="unknown">未知</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              <TextField
                label="標籤 (逗號分隔)"
                fullWidth
                value={(editingJobData.data.tags || []).join(', ')}
                onChange={(e) => setEditingJobData({
                  ...editingJobData,
                  data: { ...editingJobData.data, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) }
                })}
              />
              <TextField
                label="菜色 (逗號分隔)"
                fullWidth
                multiline
                rows={2}
                value={(editingJobData.data.dishes || []).join(', ')}
                onChange={(e) => setEditingJobData({
                  ...editingJobData,
                  data: { ...editingJobData.data, dishes: e.target.value.split(',').map(t => t.trim()).filter(Boolean) }
                })}
              />
              <TextField
                label="圖片網址"
                fullWidth
                value={editingJobData.data.imageUrl || ''}
                onChange={(e) => setEditingJobData({
                  ...editingJobData,
                  data: { ...editingJobData.data, imageUrl: e.target.value || undefined }
                })}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingJobData(null)}>取消</Button>
          <Button variant="outlined" onClick={handleSaveEditedData} startIcon={<Save size={14} />}>
            儲存變更
          </Button>
          <Button variant="contained" onClick={handleSaveEditedToDatabase} startIcon={<Database size={14} />}>
            儲存並加入資料庫
          </Button>
        </DialogActions>
      </Dialog>

      {/* 網址來源管理對話框 */}
      <Dialog open={showSourceManager} onClose={() => setShowSourceManager(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FolderOpen size={20} />
          網址來源管理
        </DialogTitle>
        <DialogContent>
          {/* 儲存目前網址 */}
          {batchUrls.trim() && (
            <Box sx={{ mb: 3, p: 2, bgcolor: '#f0f7ff', borderRadius: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>儲存目前批次網址</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  size="small"
                  placeholder="來源名稱（例如：momo 年菜）"
                  value={newSourceName}
                  onChange={(e) => setNewSourceName(e.target.value)}
                  sx={{ flex: 1 }}
                />
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<Bookmark size={14} />}
                  onClick={handleAddSource}
                  disabled={!newSourceName.trim()}
                >
                  儲存
                </Button>
              </Box>
              <Typography variant="caption" color="text.secondary">
                目前有 {batchUrls.split('\n').filter(u => u.trim().startsWith('http')).length} 個網址
              </Typography>
            </Box>
          )}

          {/* 已儲存的來源 */}
          <Typography variant="subtitle2" sx={{ mb: 1 }}>已儲存的來源</Typography>
          {savedSources.length === 0 ? (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              尚未儲存任何網址來源
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {savedSources.map((source) => (
                <Paper key={source.id} sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography fontWeight="medium">{source.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {source.urls.length} 個網址 · {format(source.createdAt, 'yyyy/MM/dd HH:mm', { locale: zhTW })}
                    </Typography>
                  </Box>
                  <Button size="small" variant="outlined" onClick={() => handleLoadSource(source)}>
                    載入
                  </Button>
                  <IconButton size="small" color="error" onClick={() => handleDeleteSource(source.id)}>
                    <Trash2 size={14} />
                  </IconButton>
                </Paper>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSourceManager(false)}>關閉</Button>
        </DialogActions>
      </Dialog>

      {/* 排程管理對話框 */}
      <Dialog open={showScheduleDialog} onClose={() => setShowScheduleDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Calendar size={20} />
          排程管理
        </DialogTitle>
        <DialogContent>
          {/* 新增排程 */}
          <Box sx={{ mb: 3, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>新增排程</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                size="small"
                label="排程名稱"
                value={newSchedule.name}
                onChange={(e) => setNewSchedule({ ...newSchedule, name: e.target.value })}
              />
              <TextField
                size="small"
                label="網址（每行一個）"
                multiline
                rows={3}
                value={newSchedule.urls}
                onChange={(e) => setNewSchedule({ ...newSchedule, urls: e.target.value })}
              />
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>執行頻率</InputLabel>
                  <Select
                    value={newSchedule.interval}
                    label="執行頻率"
                    onChange={(e) => setNewSchedule({ ...newSchedule, interval: e.target.value })}
                  >
                    <MenuItem value="daily">每日</MenuItem>
                    <MenuItem value="weekly">每週</MenuItem>
                    <MenuItem value="monthly">每月</MenuItem>
                  </Select>
                </FormControl>
                <Button variant="contained" onClick={handleAddSchedule} disabled={!newSchedule.name.trim() || !newSchedule.urls.trim()}>
                  建立排程
                </Button>
              </Box>
            </Box>
          </Box>

          {/* 已建立的排程 */}
          <Typography variant="subtitle2" sx={{ mb: 1 }}>已建立的排程</Typography>
          {schedules.length === 0 ? (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              尚未建立任何排程
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {schedules.map((schedule) => (
                <Paper key={schedule.id} sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, bgcolor: schedule.enabled ? '#fff' : '#f5f5f5' }}>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography fontWeight="medium">{schedule.name}</Typography>
                      <Chip
                        size="small"
                        label={schedule.enabled ? '啟用中' : '已停用'}
                        color={schedule.enabled ? 'success' : 'default'}
                        sx={{ height: 20, fontSize: 11 }}
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {schedule.urls.length} 個網址 ·
                      {schedule.cron.includes('* *') ? ' 每日' : schedule.cron.includes('* 1') ? ' 每週一' : ' 每月1日'}
                      {schedule.lastRun && ` · 上次執行: ${format(schedule.lastRun, 'MM/dd HH:mm', { locale: zhTW })}`}
                    </Typography>
                  </Box>
                  <Tooltip title="立即執行">
                    <IconButton size="small" color="primary" onClick={() => handleRunSchedule(schedule)}>
                      <PlayCircle size={16} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={schedule.enabled ? '停用' : '啟用'}>
                    <IconButton size="small" onClick={() => handleToggleSchedule(schedule.id)}>
                      {schedule.enabled ? <PauseCircle size={16} /> : <PlayCircle size={16} />}
                    </IconButton>
                  </Tooltip>
                  <IconButton size="small" color="error" onClick={() => handleDeleteSchedule(schedule.id)}>
                    <Trash2 size={14} />
                  </IconButton>
                </Paper>
              ))}
            </Box>
          )}

          <Alert severity="info" sx={{ mt: 2 }}>
            注意：排程功能需要伺服器端背景服務支援。目前為前端模擬，需手動點擊「立即執行」。
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowScheduleDialog(false)}>關閉</Button>
        </DialogActions>
      </Dialog>

      {/* AI 模型比較對話框 */}
      <Dialog open={showAICompare} onClose={() => setShowAICompare(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <GitCompare size={20} />
          AI 模型比較
        </DialogTitle>
        <DialogContent>
          {aiComparing ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Loader size={32} className="animate-spin" style={{ margin: '0 auto' }} />
              <Typography sx={{ mt: 2 }}>正在分析中...</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              {/* Claude 結果 */}
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Sparkles size={16} />
                  Claude
                  {aiCompareResults.claude && <Chip size="small" label="完成" color="success" sx={{ ml: 1 }} />}
                </Typography>
                {aiCompareResults.claude ? (
                  <Box sx={{ fontSize: 13 }}>
                    <Typography variant="body2"><strong>餐廳：</strong>{aiCompareResults.claude.plan.vendorName || '-'}</Typography>
                    <Typography variant="body2"><strong>方案：</strong>{aiCompareResults.claude.plan.title || '-'}</Typography>
                    <Typography variant="body2"><strong>售價：</strong>${aiCompareResults.claude.plan.priceDiscount?.toLocaleString() || '-'}</Typography>
                    <Typography variant="body2"><strong>份量：</strong>{aiCompareResults.claude.plan.servingsMin || '-'} 人</Typography>
                    <Typography variant="body2"><strong>標籤：</strong>{(aiCompareResults.claude.plan.tags || []).join(', ') || '-'}</Typography>
                    <Typography variant="body2"><strong>菜色：</strong>{(aiCompareResults.claude.plan.dishes || []).slice(0, 5).join(', ') || '-'}</Typography>
                  </Box>
                ) : (
                  <Typography color="text.secondary">無結果或分析失敗</Typography>
                )}
              </Paper>

              {/* Gemini 結果 */}
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Zap size={16} />
                  Gemini
                  {aiCompareResults.gemini && <Chip size="small" label="完成" color="success" sx={{ ml: 1 }} />}
                </Typography>
                {aiCompareResults.gemini ? (
                  <Box sx={{ fontSize: 13 }}>
                    <Typography variant="body2"><strong>餐廳：</strong>{aiCompareResults.gemini.plan.vendorName || '-'}</Typography>
                    <Typography variant="body2"><strong>方案：</strong>{aiCompareResults.gemini.plan.title || '-'}</Typography>
                    <Typography variant="body2"><strong>售價：</strong>${aiCompareResults.gemini.plan.priceDiscount?.toLocaleString() || '-'}</Typography>
                    <Typography variant="body2"><strong>份量：</strong>{aiCompareResults.gemini.plan.servingsMin || '-'} 人</Typography>
                    <Typography variant="body2"><strong>標籤：</strong>{(aiCompareResults.gemini.plan.tags || []).join(', ') || '-'}</Typography>
                    <Typography variant="body2"><strong>菜色：</strong>{(aiCompareResults.gemini.plan.dishes || []).slice(0, 5).join(', ') || '-'}</Typography>
                  </Box>
                ) : (
                  <Typography color="text.secondary">無結果或分析失敗</Typography>
                )}
              </Paper>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAICompare(false)}>關閉</Button>
        </DialogActions>
      </Dialog>

      {/* 廠商設定檔對話框 */}
      <Dialog open={showVendorConfig} onClose={() => setShowVendorConfig(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Building2 size={20} />
          廠商設定檔
        </DialogTitle>
        <DialogContent>
          {/* 新增設定 */}
          <Box sx={{ mb: 3, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>新增廠商設定</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  size="small"
                  label="廠商名稱"
                  value={newVendorConfig.name}
                  onChange={(e) => setNewVendorConfig({ ...newVendorConfig, name: e.target.value })}
                  sx={{ flex: 1 }}
                />
                <TextField
                  size="small"
                  label="URL 特徵 (如: momo.com, pchome)"
                  value={newVendorConfig.urlPattern}
                  onChange={(e) => setNewVendorConfig({ ...newVendorConfig, urlPattern: e.target.value })}
                  sx={{ flex: 1 }}
                />
              </Box>
              <TextField
                size="small"
                label="AI 提示語補充 (選填)"
                value={newVendorConfig.aiPromptHints}
                onChange={(e) => setNewVendorConfig({ ...newVendorConfig, aiPromptHints: e.target.value })}
                placeholder="例如：此廠商價格通常包含運費"
              />
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <TextField
                  size="small"
                  label="預設標籤 (逗號分隔)"
                  value={newVendorConfig.defaultTags}
                  onChange={(e) => setNewVendorConfig({ ...newVendorConfig, defaultTags: e.target.value })}
                  sx={{ flex: 1 }}
                  placeholder="台式, 海鮮"
                />
                <Button
                  variant="contained"
                  onClick={handleAddVendorConfig}
                  disabled={!newVendorConfig.name.trim() || !newVendorConfig.urlPattern.trim()}
                >
                  新增
                </Button>
              </Box>
            </Box>
          </Box>

          {/* 已設定的廠商 */}
          <Typography variant="subtitle2" sx={{ mb: 1 }}>已設定的廠商</Typography>
          {vendorConfigs.length === 0 ? (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              尚未設定任何廠商
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {vendorConfigs.map((config) => (
                <Paper key={config.id} sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, bgcolor: config.enabled ? '#fff' : '#f5f5f5' }}>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography fontWeight="medium">{config.name}</Typography>
                      <Chip
                        size="small"
                        label={config.urlPattern}
                        variant="outlined"
                        sx={{ height: 20, fontSize: 10 }}
                      />
                      <Chip
                        size="small"
                        label={config.enabled ? '啟用' : '停用'}
                        color={config.enabled ? 'success' : 'default'}
                        sx={{ height: 20, fontSize: 10 }}
                      />
                    </Box>
                    {config.defaultTags && config.defaultTags.length > 0 && (
                      <Box sx={{ mt: 0.5, display: 'flex', gap: 0.5 }}>
                        {config.defaultTags.map((tag, i) => (
                          <Chip key={i} label={tag} size="small" sx={{ height: 18, fontSize: 10 }} />
                        ))}
                      </Box>
                    )}
                  </Box>
                  <IconButton
                    size="small"
                    onClick={() => saveVendorConfigs(vendorConfigs.map(c => c.id === config.id ? { ...c, enabled: !c.enabled } : c))}
                  >
                    {config.enabled ? <PauseCircle size={16} /> : <PlayCircle size={16} />}
                  </IconButton>
                  <IconButton size="small" color="error" onClick={() => saveVendorConfigs(vendorConfigs.filter(c => c.id !== config.id))}>
                    <Trash2 size={14} />
                  </IconButton>
                </Paper>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowVendorConfig(false)}>關閉</Button>
        </DialogActions>
      </Dialog>

      {/* 錯誤分析對話框 */}
      <Dialog open={showErrorAnalytics} onClose={() => setShowErrorAnalytics(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
          <BarChart3 size={20} />
          錯誤分析報告
        </DialogTitle>
        <DialogContent>
          {errorAnalytics ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* 錯誤類型分布 */}
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 2 }}>錯誤類型分布</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {errorAnalytics.errorTypes.map(([type, data]) => (
                    <Box key={type} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography variant="body2" sx={{ minWidth: 100 }}>{type}</Typography>
                      <Box sx={{ flex: 1, height: 16, bgcolor: '#fee2e2', borderRadius: 1, overflow: 'hidden' }}>
                        <Box
                          sx={{
                            height: '100%',
                            bgcolor: 'error.main',
                            borderRadius: 1,
                            width: `${(data.count / errorAnalytics.total) * 100}%`,
                          }}
                        />
                      </Box>
                      <Typography variant="body2" fontWeight="bold" sx={{ minWidth: 40, textAlign: 'right' }}>
                        {data.count}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Paper>

              {/* 問題網域 Top 10 */}
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 2 }}>問題網域 Top 10</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {errorAnalytics.topDomains.map(([domain, count], idx) => (
                    <Box key={domain} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography variant="body2" sx={{ minWidth: 20, color: 'text.secondary' }}>{idx + 1}</Typography>
                      <Typography variant="body2" sx={{ flex: 1, fontFamily: 'monospace', fontSize: 12 }}>{domain}</Typography>
                      <Chip label={count} size="small" color="error" variant="outlined" />
                    </Box>
                  ))}
                </Box>
              </Paper>

              {/* 最近錯誤 */}
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 2 }}>最近失敗記錄</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {errorAnalytics.recentErrors.map((job) => (
                    <Box key={job.id} sx={{ p: 1.5, bgcolor: '#fef2f2', borderRadius: 1, border: '1px solid #fecaca' }}>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 11, mb: 0.5 }}>
                        {job.url.substring(0, 60)}...
                      </Typography>
                      <Typography variant="caption" color="error">
                        {job.error?.substring(0, 100) || '未知錯誤'}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Paper>
            </Box>
          ) : (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              無錯誤資料
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowErrorAnalytics(false)}>關閉</Button>
        </DialogActions>
      </Dialog>

      {/* 預覽對話框 */}
      <Dialog open={showPreviewDialog} onClose={() => setShowPreviewDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Eye size={20} />
          預覽並確認加入
        </DialogTitle>
        <DialogContent>
          {previewData && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <TextField
                label="餐廳名稱"
                fullWidth
                value={previewData.plan.vendorName || ''}
                onChange={(e) => setPreviewData({
                  ...previewData,
                  plan: { ...previewData.plan, vendorName: e.target.value }
                })}
              />
              <TextField
                label="方案名稱"
                fullWidth
                value={previewData.plan.title || ''}
                onChange={(e) => setPreviewData({
                  ...previewData,
                  plan: { ...previewData.plan, title: e.target.value }
                })}
              />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="售價"
                  type="number"
                  value={previewData.plan.priceDiscount || ''}
                  onChange={(e) => setPreviewData({
                    ...previewData,
                    plan: { ...previewData.plan, priceDiscount: Number(e.target.value) }
                  })}
                />
                <TextField
                  label="人數"
                  type="number"
                  value={previewData.plan.servingsMin || ''}
                  onChange={(e) => setPreviewData({
                    ...previewData,
                    plan: { ...previewData.plan, servingsMin: Number(e.target.value) }
                  })}
                />
              </Box>
              <TextField
                label="標籤 (逗號分隔)"
                fullWidth
                value={(previewData.plan.tags || []).join(', ')}
                onChange={(e) => setPreviewData({
                  ...previewData,
                  plan: { ...previewData.plan, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) }
                })}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPreviewDialog(false)}>取消</Button>
          <Button variant="contained" onClick={handleConfirmAddFromPreview} startIcon={<Database size={14} />}>
            確認加入資料庫
          </Button>
        </DialogActions>
      </Dialog>

      {/* 差異比對對話框 */}
      <Dialog open={showDiffDialog} onClose={() => setShowDiffDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ArrowLeftRight size={20} />
          資料差異比對
        </DialogTitle>
        <DialogContent>
          {diffData && (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2, fontFamily: 'monospace' }}>
                {diffData.url}
              </Typography>

              {diffData.existingData ? (
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                  {/* 既有資料 */}
                  <Paper sx={{ p: 2, bgcolor: '#fef3c7' }}>
                    <Typography variant="subtitle2" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Database size={16} /> 既有資料
                    </Typography>
                    <Box sx={{ fontSize: 13 }}>
                      <Typography variant="body2"><strong>餐廳：</strong>{diffData.existingData.vendorName}</Typography>
                      <Typography variant="body2"><strong>方案：</strong>{diffData.existingData.title}</Typography>
                      <Typography variant="body2"><strong>售價：</strong>${diffData.existingData.priceDiscount?.toLocaleString()}</Typography>
                      <Typography variant="body2"><strong>份量：</strong>{diffData.existingData.servingsMin} 人</Typography>
                      <Typography variant="body2"><strong>標籤：</strong>{diffData.existingData.tags?.join(', ')}</Typography>
                    </Box>
                  </Paper>

                  {/* 新資料 */}
                  <Paper sx={{ p: 2, bgcolor: '#d1fae5' }}>
                    <Typography variant="subtitle2" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Sparkles size={16} /> 新爬取資料
                    </Typography>
                    <Box sx={{ fontSize: 13 }}>
                      <Typography variant="body2" sx={{ color: diffData.newData.vendorName !== diffData.existingData.vendorName ? 'success.main' : 'inherit' }}>
                        <strong>餐廳：</strong>{diffData.newData.vendorName || '-'}
                        {diffData.newData.vendorName !== diffData.existingData.vendorName && ' ✓'}
                      </Typography>
                      <Typography variant="body2" sx={{ color: diffData.newData.title !== diffData.existingData.title ? 'success.main' : 'inherit' }}>
                        <strong>方案：</strong>{diffData.newData.title || '-'}
                        {diffData.newData.title !== diffData.existingData.title && ' ✓'}
                      </Typography>
                      <Typography variant="body2" sx={{ color: diffData.newData.priceDiscount !== diffData.existingData.priceDiscount ? 'success.main' : 'inherit' }}>
                        <strong>售價：</strong>${diffData.newData.priceDiscount?.toLocaleString() || '-'}
                        {diffData.newData.priceDiscount !== diffData.existingData.priceDiscount && (
                          <span>
                            {' '}
                            {diffData.newData.priceDiscount! > diffData.existingData.priceDiscount ? (
                              <TrendingUp size={12} style={{ display: 'inline' }} />
                            ) : (
                              <TrendingDown size={12} style={{ display: 'inline' }} />
                            )}
                          </span>
                        )}
                      </Typography>
                      <Typography variant="body2" sx={{ color: diffData.newData.servingsMin !== diffData.existingData.servingsMin ? 'success.main' : 'inherit' }}>
                        <strong>份量：</strong>{diffData.newData.servingsMin || '-'} 人
                        {diffData.newData.servingsMin !== diffData.existingData.servingsMin && ' ✓'}
                      </Typography>
                      <Typography variant="body2">
                        <strong>標籤：</strong>{(diffData.newData.tags || []).join(', ') || '-'}
                      </Typography>
                    </Box>
                  </Paper>
                </Box>
              ) : (
                <Alert severity="info" sx={{ mb: 2 }}>
                  此 URL 尚無既有資料，可直接新增到資料庫
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDiffDialog(false)}>取消</Button>
          {diffData?.existingData ? (
            <Button variant="contained" color="warning" onClick={handleApplyDiff} startIcon={<RefreshCw size={14} />}>
              用新資料覆蓋既有資料
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={() => {
                if (diffData) {
                  const job = jobs.find(j => j.id === diffData.jobId);
                  if (job) handlePreviewBeforeAdd(job);
                }
                setShowDiffDialog(false);
              }}
              startIcon={<Database size={14} />}
            >
              新增到資料庫
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* 價格監控面板 */}
      <Dialog open={showMonitorPanel} onClose={() => setShowMonitorPanel(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#fffbeb' }}>
          <Activity size={20} color="#f59e0b" />
          價格監控
          <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
            <Button
              size="small"
              variant="contained"
              color="warning"
              startIcon={isMonitoring ? <Loader size={14} className="animate-spin" /> : <Radio size={14} />}
              onClick={handleCheckAllMonitors}
              disabled={isMonitoring || monitorTasks.filter(t => t.enabled).length === 0}
            >
              {isMonitoring ? '檢查中...' : `檢查全部 (${monitorTasks.filter(t => t.enabled).length})`}
            </Button>
          </Box>
        </DialogTitle>
        <DialogContent>
          {/* 價格變化記錄 */}
          {priceChanges.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <LineChart size={16} /> 最近價格變化
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 200, overflow: 'auto' }}>
                {priceChanges.slice(0, 10).map((change) => (
                  <Paper
                    key={change.id}
                    sx={{
                      p: 1.5,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      bgcolor: change.changeType === 'drop' ? '#ecfdf5' : '#fef2f2',
                      border: `1px solid ${change.changeType === 'drop' ? '#86efac' : '#fecaca'}`,
                    }}
                  >
                    {change.changeType === 'drop' ? (
                      <TrendingDown size={20} color="#22c55e" />
                    ) : (
                      <TrendingUp size={20} color="#ef4444" />
                    )}
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" fontWeight="medium">
                        {change.vendorName} - {change.planTitle}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        ${change.oldPrice.toLocaleString()} → ${change.newPrice.toLocaleString()}
                        <Chip
                          size="small"
                          label={`${change.changePercent > 0 ? '+' : ''}${change.changePercent}%`}
                          color={change.changeType === 'drop' ? 'success' : 'error'}
                          sx={{ ml: 1, height: 18, fontSize: 10 }}
                        />
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {format(new Date(change.detectedAt), 'MM/dd HH:mm', { locale: zhTW })}
                    </Typography>
                  </Paper>
                ))}
              </Box>
            </Box>
          )}

          {/* 監控列表 */}
          <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircleDot size={16} /> 監控中的方案 ({monitorTasks.length})
          </Typography>
          {monitorTasks.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
              <Activity size={40} style={{ opacity: 0.3, marginBottom: 8 }} />
              <Typography>尚未設定任何監控</Typography>
              <Typography variant="caption">在 Admin 頁面選擇方案後可加入監控</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {monitorTasks.map((task) => {
                const plan = plans.find(p => p.id === task.planId);
                const history = priceHistory[task.planId] || [];
                return (
                  <Paper key={task.id} sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, bgcolor: task.enabled ? '#fff' : '#f5f5f5' }}>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography fontWeight="medium">{plan?.vendorName || '未知'}</Typography>
                        <Chip
                          size="small"
                          label={plan?.title?.substring(0, 20) || '未知方案'}
                          variant="outlined"
                          sx={{ height: 20, fontSize: 10 }}
                        />
                        <Chip
                          size="small"
                          icon={task.status === 'checking' ? <Loader size={10} className="animate-spin" /> : undefined}
                          label={
                            task.status === 'idle' ? '正常' :
                            task.status === 'checking' ? '檢查中' :
                            task.status === 'changed' ? '有變化' : '錯誤'
                          }
                          color={
                            task.status === 'idle' ? 'default' :
                            task.status === 'checking' ? 'primary' :
                            task.status === 'changed' ? 'warning' : 'error'
                          }
                          sx={{ height: 20, fontSize: 10 }}
                        />
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        目前價格: ${plan?.priceDiscount?.toLocaleString() || '-'}
                        {task.lastCheckedAt && ` · 上次檢查: ${format(new Date(task.lastCheckedAt), 'MM/dd HH:mm', { locale: zhTW })}`}
                        {history.length > 1 && ` · 記錄 ${history.length} 筆`}
                      </Typography>
                    </Box>
                    <Tooltip title="立即檢查">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleCheckPrice(task)}
                        disabled={task.status === 'checking'}
                      >
                        <RefreshCw size={16} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={task.enabled ? '停用' : '啟用'}>
                      <IconButton size="small" onClick={() => handleToggleMonitor(task.id)}>
                        {task.enabled ? <PauseCircle size={16} /> : <PlayCircle size={16} />}
                      </IconButton>
                    </Tooltip>
                    <IconButton size="small" color="error" onClick={() => handleDeleteMonitor(task.id)}>
                      <Trash2 size={14} />
                    </IconButton>
                  </Paper>
                );
              })}
            </Box>
          )}

          {/* 從已有方案加入監控 */}
          <Box sx={{ mt: 3, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>從已有方案加入監控</Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {plans
                .filter(p => p.sourceUrl && !monitorTasks.some(t => t.planId === p.id))
                .slice(0, 10)
                .map((plan) => (
                  <Chip
                    key={plan.id}
                    label={`${plan.vendorName} - $${plan.priceDiscount?.toLocaleString()}`}
                    size="small"
                    onClick={() => handleAddMonitor(plan)}
                    sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#e5e7eb' } }}
                  />
                ))}
              {plans.filter(p => p.sourceUrl && !monitorTasks.some(t => t.planId === p.id)).length === 0 && (
                <Typography variant="caption" color="text.secondary">
                  所有有來源網址的方案都已在監控中
                </Typography>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowMonitorPanel(false)}>關閉</Button>
        </DialogActions>
      </Dialog>

      {/* 通知面板 */}
      <Dialog open={showNotifications} onClose={() => setShowNotifications(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Bell size={20} />
          通知中心
          <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
            {unreadCount > 0 && (
              <Button size="small" onClick={markAllNotificationsRead}>
                全部已讀
              </Button>
            )}
            {notifications.length > 0 && (
              <Button size="small" color="error" onClick={clearAllNotifications}>
                清除全部
              </Button>
            )}
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {notifications.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
              <Bell size={40} style={{ opacity: 0.3, marginBottom: 8 }} />
              <Typography>沒有通知</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              {notifications.map((notif) => (
                <Box
                  key={notif.id}
                  onClick={() => markNotificationRead(notif.id)}
                  sx={{
                    p: 2,
                    borderBottom: '1px solid #e5e7eb',
                    bgcolor: notif.read ? '#fff' : '#fffbeb',
                    cursor: 'pointer',
                    '&:hover': { bgcolor: notif.read ? '#f9fafb' : '#fef3c7' },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                    {notif.type === 'price_drop' && <TrendingDown size={18} color="#22c55e" />}
                    {notif.type === 'price_increase' && <TrendingUp size={18} color="#ef4444" />}
                    {notif.type === 'error' && <AlertTriangle size={18} color="#ef4444" />}
                    {notif.type === 'info' && <Bell size={18} color="#6b7280" />}
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" fontWeight={notif.read ? 'normal' : 'bold'}>
                        {notif.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
                        {notif.message}
                      </Typography>
                      <Typography variant="caption" display="block" color="text.disabled" sx={{ mt: 0.5 }}>
                        {format(new Date(notif.createdAt), 'MM/dd HH:mm', { locale: zhTW })}
                      </Typography>
                    </Box>
                    {!notif.read && (
                      <Box sx={{ width: 8, height: 8, bgcolor: '#f59e0b', borderRadius: '50%', flexShrink: 0, mt: 0.5 }} />
                    )}
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* 網域規則對話框 */}
      <Dialog open={showDomainRules} onClose={() => setShowDomainRules(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Globe size={20} />
          網域抽取規則
        </DialogTitle>
        <DialogContent dividers>
          {/* 新增規則 */}
          <Box sx={{ mb: 3, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>新增網域規則</Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <TextField
                size="small"
                label="網域"
                placeholder="例: momoshop.com.tw"
                value={newDomainRule.domain}
                onChange={(e) => setNewDomainRule({ ...newDomainRule, domain: e.target.value })}
                sx={{ flex: 1, minWidth: 200 }}
              />
              <TextField
                size="small"
                label="標題選擇器"
                placeholder="CSS 選擇器"
                value={newDomainRule.titleSelector}
                onChange={(e) => setNewDomainRule({ ...newDomainRule, titleSelector: e.target.value })}
                sx={{ flex: 1, minWidth: 150 }}
              />
              <TextField
                size="small"
                label="價格選擇器"
                placeholder="CSS 選擇器"
                value={newDomainRule.priceSelector}
                onChange={(e) => setNewDomainRule({ ...newDomainRule, priceSelector: e.target.value })}
                sx={{ flex: 1, minWidth: 150 }}
              />
              <TextField
                size="small"
                type="number"
                label="等待時間 (ms)"
                value={newDomainRule.waitTime}
                onChange={(e) => setNewDomainRule({ ...newDomainRule, waitTime: parseInt(e.target.value) || 2000 })}
                sx={{ width: 120 }}
              />
              <Button
                variant="contained"
                size="small"
                onClick={handleAddDomainRule}
                disabled={!newDomainRule.domain}
              >
                新增
              </Button>
            </Box>
          </Box>

          {/* 規則列表 */}
          {domainRules.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={4}>
              尚無網域規則
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>網域</TableCell>
                    <TableCell>選擇器</TableCell>
                    <TableCell align="center">等待</TableCell>
                    <TableCell align="center">狀態</TableCell>
                    <TableCell align="right">操作</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {domainRules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>{rule.domain}</Typography>
                      </TableCell>
                      <TableCell>
                        {rule.selectors?.title && (
                          <Chip size="small" label={`標題: ${rule.selectors.title}`} sx={{ mr: 0.5, mb: 0.5 }} />
                        )}
                        {rule.selectors?.price && (
                          <Chip size="small" label={`價格: ${rule.selectors.price}`} />
                        )}
                      </TableCell>
                      <TableCell align="center">{rule.waitTime || 0}ms</TableCell>
                      <TableCell align="center">
                        <Chip
                          size="small"
                          label={rule.enabled ? '啟用' : '停用'}
                          color={rule.enabled ? 'success' : 'default'}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={() => {
                            saveDomainRules(domainRules.map(r =>
                              r.id === rule.id ? { ...r, enabled: !r.enabled } : r
                            ));
                          }}
                        >
                          {rule.enabled ? <Eye size={16} /> : <Eye size={16} color="#ccc" />}
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => saveDomainRules(domainRules.filter(r => r.id !== rule.id))}
                        >
                          <Trash2 size={16} />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDomainRules(false)}>關閉</Button>
        </DialogActions>
      </Dialog>

      {/* 爬取佇列對話框 */}
      <Dialog open={showQueuePanel} onClose={() => setShowQueuePanel(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ListOrdered size={20} />
          爬取佇列
          <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
            {queueItems.length > 0 && (
              <Button size="small" color="error" onClick={clearQueue}>
                清空佇列
              </Button>
            )}
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {/* 佇列統計 */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            {[
              { label: '等待中', value: getQueueStats().queued, color: 'primary' },
              { label: '處理中', value: getQueueStats().processing, color: 'warning' },
              { label: '完成', value: getQueueStats().done, color: 'success' },
              { label: '失敗', value: getQueueStats().failed, color: 'error' },
            ].map(({ label, value, color }) => (
              <Paper key={label} sx={{ p: 1.5, flex: 1, textAlign: 'center' }}>
                <Typography variant="h5" color={`${color}.main`}>{value}</Typography>
                <Typography variant="caption" color="text.secondary">{label}</Typography>
              </Paper>
            ))}
          </Box>

          {/* 重試策略設定 */}
          <Box sx={{ mb: 3, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <RotateCw size={16} />
              重試策略
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <TextField
                size="small"
                type="number"
                label="最大重試次數"
                value={retrySettings.maxRetries}
                onChange={(e) => saveRetrySettings({ ...retrySettings, maxRetries: parseInt(e.target.value) || 3 })}
                sx={{ width: 120 }}
              />
              <TextField
                size="small"
                type="number"
                label="基礎延遲 (ms)"
                value={retrySettings.baseDelay}
                onChange={(e) => saveRetrySettings({ ...retrySettings, baseDelay: parseInt(e.target.value) || 1000 })}
                sx={{ width: 120 }}
              />
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>退避策略</InputLabel>
                <Select
                  value={retrySettings.useExponentialBackoff ? 'exponential' : 'fixed'}
                  label="退避策略"
                  onChange={(e) => saveRetrySettings({ ...retrySettings, useExponentialBackoff: e.target.value === 'exponential' })}
                >
                  <MenuItem value="fixed">固定延遲</MenuItem>
                  <MenuItem value="exponential">指數退避</MenuItem>
                </Select>
              </FormControl>
              {retrySettings.useExponentialBackoff && (
                <TextField
                  size="small"
                  type="number"
                  label="最大延遲 (ms)"
                  value={retrySettings.maxDelay}
                  onChange={(e) => saveRetrySettings({ ...retrySettings, maxDelay: parseInt(e.target.value) || 30000 })}
                  sx={{ width: 120 }}
                />
              )}
            </Box>
          </Box>

          {/* 佇列列表 */}
          {queueItems.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={4}>
              佇列為空
            </Typography>
          ) : (
            <TableContainer sx={{ maxHeight: 400 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>優先順序</TableCell>
                    <TableCell>URL</TableCell>
                    <TableCell align="center">狀態</TableCell>
                    <TableCell align="center">重試</TableCell>
                    <TableCell align="right">操作</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {queueItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <IconButton
                            size="small"
                            disabled={item.priority === 'high'}
                            onClick={() => updateQueuePriority(item.id, item.priority === 'low' ? 'normal' : 'high')}
                          >
                            <ChevronUp size={14} />
                          </IconButton>
                          <Chip
                            size="small"
                            label={item.priority === 'high' ? '高' : item.priority === 'low' ? '低' : '中'}
                            color={item.priority === 'high' ? 'error' : item.priority === 'low' ? 'default' : 'primary'}
                          />
                          <IconButton
                            size="small"
                            disabled={item.priority === 'low'}
                            onClick={() => updateQueuePriority(item.id, item.priority === 'high' ? 'normal' : 'low')}
                          >
                            <ChevronDown size={14} />
                          </IconButton>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                          {item.url}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          size="small"
                          label={item.status === 'queued' ? '等待' : item.status === 'processing' ? '處理中' : item.status === 'done' ? '完成' : '失敗'}
                          color={item.status === 'done' ? 'success' : item.status === 'failed' ? 'error' : item.status === 'processing' ? 'warning' : 'default'}
                        />
                      </TableCell>
                      <TableCell align="center">{item.retryCount}/{item.maxRetries}</TableCell>
                      <TableCell align="right">
                        <IconButton size="small" color="error" onClick={() => removeFromQueue(item.id)}>
                          <XCircle size={16} />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowQueuePanel(false)}>關閉</Button>
        </DialogActions>
      </Dialog>

      {/* 日誌匯出對話框 */}
      <Dialog open={showLogExport} onClose={() => setShowLogExport(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FileDown size={20} />
          匯出資料
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            選擇要匯出的資料格式
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* 完整資料 */}
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <FileJson size={16} />
                完整資料 (JSON)
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                包含所有爬取任務、統計數據和日誌
              </Typography>
              <Button size="small" variant="outlined" onClick={() => exportLogs('json')}>
                匯出 JSON
              </Button>
            </Paper>

            {/* CSV */}
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <FileSpreadsheet size={16} />
                任務清單 (CSV)
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                適合在 Excel 中查看的格式
              </Typography>
              <Button size="small" variant="outlined" onClick={() => exportLogs('csv')}>
                匯出 CSV
              </Button>
            </Paper>

            {/* 日誌 */}
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <FileTextIcon size={16} />
                操作日誌 (TXT)
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                純文字格式的操作日誌
              </Typography>
              <Button size="small" variant="outlined" onClick={() => exportLogs('txt')}>
                匯出 TXT
              </Button>
            </Paper>

            {/* 歷史記錄 */}
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <History size={16} />
                爬取歷史
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                包含解析結果的精簡歷史記錄
              </Typography>
              <Button size="small" variant="outlined" onClick={exportJobsHistory}>
                匯出歷史
              </Button>
            </Paper>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowLogExport(false)}>關閉</Button>
        </DialogActions>
      </Dialog>

      {/* 分析報表對話框 */}
      <Dialog open={showAnalyticsPanel} onClose={() => setShowAnalyticsPanel(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#f5f3ff' }}>
          <PieChart size={20} color="#7c3aed" />
          分析報表
        </DialogTitle>
        <DialogContent dividers>
          {!analyticsData ? (
            <Typography color="text.secondary" textAlign="center" py={8}>
              尚無資料可分析
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* 總覽 */}
              <Box sx={{ display: 'flex', gap: 2 }}>
                {[
                  { label: '總任務', value: analyticsData.totalJobs, color: 'primary' },
                  { label: '成功', value: analyticsData.successJobs, color: 'success' },
                  { label: '失敗', value: analyticsData.failedJobs, color: 'error' },
                  { label: '成功率', value: `${analyticsData.totalJobs > 0 ? Math.round((analyticsData.successJobs / analyticsData.totalJobs) * 100) : 0}%`, color: 'secondary' },
                  { label: '平均處理時間', value: `${analyticsData.avgProcessingTime}秒`, color: 'info' },
                ].map(({ label, value, color }) => (
                  <Paper key={label} sx={{ p: 2, flex: 1, textAlign: 'center' }}>
                    <Typography variant="h4" color={`${color}.main`}>{value}</Typography>
                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                  </Paper>
                ))}
              </Box>

              {/* 每日趨勢 */}
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LineChart size={16} />
                  每日爬取趨勢（最近7天）
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', height: 120 }}>
                  {analyticsData.dailyTrend.map((day) => {
                    const total = day.success + day.failed;
                    const maxHeight = 100;
                    const height = total > 0 ? Math.max(20, (total / Math.max(...analyticsData.dailyTrend.map(d => d.success + d.failed))) * maxHeight) : 10;
                    return (
                      <Box key={day.date} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <Tooltip title={`成功: ${day.success}, 失敗: ${day.failed}`}>
                          <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                            <Box sx={{ height: (day.failed / (total || 1)) * height, bgcolor: 'error.main', borderRadius: '4px 4px 0 0' }} />
                            <Box sx={{ height: (day.success / (total || 1)) * height, bgcolor: 'success.main', borderRadius: total > 0 ? '0 0 4px 4px' : '4px' }} />
                          </Box>
                        </Tooltip>
                        <Typography variant="caption" sx={{ mt: 0.5 }}>{day.date}</Typography>
                      </Box>
                    );
                  })}
                </Box>
              </Paper>

              <Box sx={{ display: 'flex', gap: 2 }}>
                {/* 網域成功率 */}
                <Paper sx={{ p: 2, flex: 1 }}>
                  <Typography variant="subtitle2" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Globe size={16} />
                    網域成功率
                  </Typography>
                  {analyticsData.domainSuccessRates.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">無資料</Typography>
                  ) : (
                    <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                      {analyticsData.domainSuccessRates.map((item) => (
                        <Box key={item.domain} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Typography variant="body2" sx={{ flex: 1, fontSize: 12 }} noWrap title={item.domain}>
                            {item.domain}
                          </Typography>
                          <Box sx={{ width: 80, height: 6, bgcolor: '#e5e7eb', borderRadius: 1, overflow: 'hidden' }}>
                            <Box
                              sx={{
                                height: '100%',
                                width: `${item.successRate}%`,
                                bgcolor: item.successRate >= 80 ? 'success.main' : item.successRate >= 50 ? 'warning.main' : 'error.main',
                              }}
                            />
                          </Box>
                          <Typography variant="caption" sx={{ width: 40, textAlign: 'right' }}>
                            {item.successRate}%
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ width: 30, textAlign: 'right' }}>
                            ({item.total})
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Paper>

                {/* 價格分布 */}
                <Paper sx={{ p: 2, flex: 1 }}>
                  <Typography variant="subtitle2" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <BarChart2 size={16} />
                    價格分布
                  </Typography>
                  <Box>
                    {Object.entries(analyticsData.priceRanges).map(([range, count]) => {
                      const total = Object.values(analyticsData.priceRanges).reduce((a, b) => a + b, 0);
                      return (
                        <Box key={range} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Typography variant="body2" sx={{ width: 80, fontSize: 12 }}>${range}</Typography>
                          <Box sx={{ flex: 1, height: 16, bgcolor: '#e5e7eb', borderRadius: 1, overflow: 'hidden' }}>
                            <Box
                              sx={{
                                height: '100%',
                                width: total > 0 ? `${(count / total) * 100}%` : '0%',
                                bgcolor: '#7c3aed',
                              }}
                            />
                          </Box>
                          <Typography variant="caption" sx={{ width: 30, textAlign: 'right' }}>{count}</Typography>
                        </Box>
                      );
                    })}
                  </Box>
                </Paper>
              </Box>

              {/* 廠商統計 */}
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Building2 size={16} />
                  廠商統計 Top 10
                </Typography>
                {analyticsData.topVendors.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">無資料</Typography>
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>廠商</TableCell>
                          <TableCell align="center">方案數</TableCell>
                          <TableCell align="right">平均價格</TableCell>
                          <TableCell align="right">最低價</TableCell>
                          <TableCell align="right">最高價</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {analyticsData.topVendors.map((vendor) => (
                          <TableRow key={vendor.vendor}>
                            <TableCell>
                              <Typography variant="body2" fontWeight={500}>{vendor.vendor}</Typography>
                            </TableCell>
                            <TableCell align="center">{vendor.count}</TableCell>
                            <TableCell align="right">${vendor.avgPrice.toLocaleString()}</TableCell>
                            <TableCell align="right">${vendor.minPrice.toLocaleString()}</TableCell>
                            <TableCell align="right">${vendor.maxPrice.toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Paper>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAnalyticsPanel(false)}>關閉</Button>
        </DialogActions>
      </Dialog>

      {/* E1: 排程管理對話框 */}
      <Dialog open={showScheduleManager} onClose={() => setShowScheduleManager(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#ecfdf5' }}>
          <CalendarClock size={20} color="#10b981" />
          定時排程管理
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>新增排程</Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                size="small"
                label="排程名稱"
                value={editingSchedule?.name || ''}
                onChange={(e) => setEditingSchedule(prev => prev ? { ...prev, name: e.target.value } : { id: Date.now().toString(), name: e.target.value, urls: [], cron: '0 9 * * *', enabled: true })}
                sx={{ width: 150 }}
              />
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Cron 預設</InputLabel>
                <Select
                  value=""
                  label="Cron 預設"
                  onChange={(e) => setEditingSchedule(prev => prev ? { ...prev, cron: e.target.value as string } : { id: Date.now().toString(), name: '', urls: [], cron: e.target.value as string, enabled: true })}
                >
                  {cronPresets.map(preset => (
                    <MenuItem key={preset.cron} value={preset.cron}>{preset.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                size="small"
                label="Cron 表達式"
                value={editingSchedule?.cron || '0 9 * * *'}
                onChange={(e) => setEditingSchedule(prev => prev ? { ...prev, cron: e.target.value } : { id: Date.now().toString(), name: '', urls: [], cron: e.target.value, enabled: true })}
                sx={{ width: 150 }}
              />
              <Button
                variant="contained"
                color="success"
                startIcon={<Plus size={16} />}
                onClick={() => editingSchedule && saveSchedule(editingSchedule)}
                disabled={!editingSchedule?.name}
              >
                新增
              </Button>
            </Box>
          </Box>

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" gutterBottom>現有排程</Typography>
          {schedules.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={4}>尚無排程</Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {schedules.map(schedule => (
                <Paper key={schedule.id} sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography fontWeight="bold">{schedule.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {parseCron(schedule.cron)} | {schedule.urls.length} 個網址
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    label={schedule.enabled ? '啟用' : '停用'}
                    color={schedule.enabled ? 'success' : 'default'}
                  />
                  <IconButton size="small" onClick={() => deleteSchedule(schedule.id)}>
                    <Trash2 size={16} />
                  </IconButton>
                </Paper>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowScheduleManager(false)}>關閉</Button>
        </DialogActions>
      </Dialog>

      {/* E2: Webhook 設定對話框 */}
      <Dialog open={showWebhookSettings} onClose={() => setShowWebhookSettings(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#eef2ff' }}>
          <Webhook size={20} color="#6366f1" />
          Webhook 設定
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography>啟用 Webhook</Typography>
              <input
                type="checkbox"
                checked={webhookConfig.enabled}
                onChange={(e) => setWebhookConfig(prev => ({ ...prev, enabled: e.target.checked }))}
              />
            </Box>

            <TextField
              fullWidth
              size="small"
              label="Webhook URL"
              placeholder="https://your-server.com/webhook"
              value={webhookConfig.url}
              onChange={(e) => setWebhookConfig(prev => ({ ...prev, url: e.target.value }))}
            />

            <TextField
              fullWidth
              size="small"
              label="Secret (選填)"
              type="password"
              value={webhookConfig.secret}
              onChange={(e) => setWebhookConfig(prev => ({ ...prev, secret: e.target.value }))}
            />

            <Box>
              <Typography variant="subtitle2" gutterBottom>觸發事件</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {['scrape_complete', 'scrape_failed', 'price_change'].map(event => (
                  <Chip
                    key={event}
                    label={event === 'scrape_complete' ? '爬取完成' : event === 'scrape_failed' ? '爬取失敗' : '價格變動'}
                    variant={webhookConfig.events.includes(event) ? 'filled' : 'outlined'}
                    color={webhookConfig.events.includes(event) ? 'primary' : 'default'}
                    onClick={() => setWebhookConfig(prev => ({
                      ...prev,
                      events: prev.events.includes(event)
                        ? prev.events.filter(e => e !== event)
                        : [...prev.events, event]
                    }))}
                  />
                ))}
              </Box>
            </Box>

            <Button
              variant="outlined"
              startIcon={<SendHorizonal size={16} />}
              onClick={testWebhook}
              disabled={!webhookConfig.url}
            >
              發送測試
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowWebhookSettings(false)}>取消</Button>
          <Button variant="contained" color="primary" onClick={saveWebhookConfig}>儲存</Button>
        </DialogActions>
      </Dialog>

      {/* E3: 代理池對話框 */}
      <Dialog open={showProxyPool} onClose={() => setShowProxyPool(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#fffbeb' }}>
          <Network size={20} color="#f59e0b" />
          代理池管理
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>新增代理</Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                size="small"
                label="主機 (Host)"
                placeholder="proxy.example.com"
                value={newProxy.host}
                onChange={(e) => setNewProxy(prev => ({ ...prev, host: e.target.value }))}
                sx={{ width: 180 }}
              />
              <TextField
                size="small"
                label="埠號 (Port)"
                placeholder="8080"
                value={newProxy.port}
                onChange={(e) => setNewProxy(prev => ({ ...prev, port: e.target.value }))}
                sx={{ width: 100 }}
              />
              <TextField
                size="small"
                label="使用者名稱"
                value={newProxy.username}
                onChange={(e) => setNewProxy(prev => ({ ...prev, username: e.target.value }))}
                sx={{ width: 130 }}
              />
              <TextField
                size="small"
                label="密碼"
                type="password"
                value={newProxy.password}
                onChange={(e) => setNewProxy(prev => ({ ...prev, password: e.target.value }))}
                sx={{ width: 130 }}
              />
              <Button
                variant="contained"
                color="warning"
                startIcon={<Plus size={16} />}
                onClick={addProxy}
                disabled={!newProxy.host || !newProxy.port}
              >
                新增
              </Button>
            </Box>
          </Box>

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" gutterBottom>代理清單 ({proxyList.filter(p => p.enabled).length}/{proxyList.length} 啟用)</Typography>
          {proxyList.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={4}>尚無代理</Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>狀態</TableCell>
                    <TableCell>主機:埠號</TableCell>
                    <TableCell>認證</TableCell>
                    <TableCell>成功率</TableCell>
                    <TableCell>操作</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {proxyList.map(proxy => (
                    <TableRow key={proxy.id}>
                      <TableCell>
                        <Chip
                          size="small"
                          label={proxy.enabled ? '啟用' : '停用'}
                          color={proxy.enabled ? 'success' : 'default'}
                          onClick={() => toggleProxy(proxy.id)}
                        />
                      </TableCell>
                      <TableCell>{proxy.host}:{proxy.port}</TableCell>
                      <TableCell>{proxy.username ? '有' : '無'}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LinearProgress
                            variant="determinate"
                            value={proxy.successRate}
                            sx={{ width: 60, height: 6, borderRadius: 3 }}
                            color={proxy.successRate > 80 ? 'success' : proxy.successRate > 50 ? 'warning' : 'error'}
                          />
                          <Typography variant="caption">{proxy.successRate}%</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => deleteProxy(proxy.id)}>
                          <Trash2 size={16} />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <Alert severity="info" sx={{ mt: 2 }}>
            代理會在爬取時自動輪換使用，避免被目標網站封鎖 IP。
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowProxyPool(false)}>關閉</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar 通知 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}
