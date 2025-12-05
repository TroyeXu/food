'use client';

import { useState, useEffect } from 'react';
import { X, Link, Loader2, AlertCircle, Check, Zap, Settings, Copy, ArrowRight, RefreshCw } from 'lucide-react';
import { parseAIResponse } from '@/lib/aiPrompt';
import type { Plan } from '@/types';

interface ExtractedItem {
  url: string;
  status: 'pending' | 'processing' | 'success' | 'error' | 'imported';
  title?: string;
  parsed?: Partial<Plan>;
  error?: string;
  rawResponse?: string;
}

interface BatchImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: { url?: string; parsedPlan?: Partial<Plan> }) => Promise<void>;
}

type Step = 'input' | 'processing' | 'review';
type CLITool = 'claude' | 'gemini' | 'gpt';
type ProcessMode = 'auto' | 'manual';
type ScraperService = 'jina' | 'firecrawl' | 'local' | 'crawl4ai' | 'scrapegraph';

export default function BatchImportModal({ isOpen, onClose, onImport }: BatchImportModalProps) {
  const [urls, setUrls] = useState('');
  const [step, setStep] = useState<Step>('input');
  const [items, setItems] = useState<ExtractedItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 處理模式
  const [processMode, setProcessMode] = useState<ProcessMode>('auto');
  const [selectedCLI, setSelectedCLI] = useState<CLITool>('claude');
  const [availableCLIs, setAvailableCLIs] = useState<Record<string, boolean>>({});
  const [selectedService, setSelectedService] = useState<ScraperService>('jina');
  const [availableServices, setAvailableServices] = useState<Record<string, { available: boolean; hasApiKey: boolean }>>({});

  // 手動模式
  const [copiedAll, setCopiedAll] = useState(false);
  const [manualResponses, setManualResponses] = useState<Record<string, string>>({});

  // 目前處理進度
  const [currentIndex, setCurrentIndex] = useState(0);

  // 檢查可用的 CLI 工具和爬取服務
  useEffect(() => {
    if (isOpen) {
      fetch('/api/ai-extract')
        .then(res => res.json())
        .then(data => {
          setAvailableCLIs(data.available || {});
          if (data.default) {
            setSelectedCLI(data.default);
          }
          if (data.services) {
            setAvailableServices(data.services);
          }
          if (data.defaultService) {
            setSelectedService(data.defaultService);
          }
        })
        .catch(() => {
          setAvailableCLIs({ claude: true, gemini: true, gpt: true });
          setAvailableServices({
            jina: { available: true, hasApiKey: false },
            firecrawl: { available: false, hasApiKey: false },
          });
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const resetState = () => {
    setUrls('');
    setStep('input');
    setItems([]);
    setError(null);
    setCopiedAll(false);
    setManualResponses({});
    setCurrentIndex(0);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  // 解析 URL 清單
  const parseUrls = (text: string): string[] => {
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => {
        if (!line) return false;
        try {
          new URL(line);
          return true;
        } catch {
          return false;
        }
      });
  };

  // 自動模式：批次處理
  const handleAutoProcess = async () => {
    const urlList = parseUrls(urls);

    if (urlList.length === 0) {
      setError('請輸入至少一個有效的網址');
      return;
    }

    setError(null);
    setIsLoading(true);
    setStep('processing');

    const initialItems: ExtractedItem[] = urlList.map(url => ({
      url,
      status: 'pending' as const,
    }));
    setItems(initialItems);

    // 逐一處理
    for (let i = 0; i < initialItems.length; i++) {
      setCurrentIndex(i);
      setItems(prev => prev.map((item, idx) =>
        idx === i ? { ...item, status: 'processing' } : item
      ));

      try {
        const response = await fetch('/api/ai-extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: initialItems[i].url, cli: selectedCLI, service: selectedService }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || '處理失敗');
        }

        setItems(prev => prev.map((item, idx) =>
          idx === i ? {
            ...item,
            status: 'success',
            title: data.data.parsed?.title || data.data.scraped?.title,
            parsed: data.data.parsed,
            rawResponse: data.data.rawResponse,
          } : item
        ));
      } catch (err) {
        setItems(prev => prev.map((item, idx) =>
          idx === i ? {
            ...item,
            status: 'error',
            error: (err as Error).message,
          } : item
        ));
      }
    }

    setIsLoading(false);
    setStep('review');
  };

  // 手動模式：先爬取
  const handleManualScrape = async () => {
    const urlList = parseUrls(urls);

    if (urlList.length === 0) {
      setError('請輸入至少一個有效的網址');
      return;
    }

    setError(null);
    setIsLoading(true);
    setStep('processing');

    const initialItems: ExtractedItem[] = urlList.map(url => ({
      url,
      status: 'pending' as const,
    }));
    setItems(initialItems);

    // 逐一爬取
    for (let i = 0; i < initialItems.length; i++) {
      setCurrentIndex(i);
      setItems(prev => prev.map((item, idx) =>
        idx === i ? { ...item, status: 'processing' } : item
      ));

      try {
        const response = await fetch('/api/scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: initialItems[i].url, service: selectedService }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || '爬取失敗');
        }

        setItems(prev => prev.map((item, idx) =>
          idx === i ? {
            ...item,
            status: 'success',
            title: data.data.title,
            rawResponse: data.data.prompt, // 儲存 prompt 以便複製
          } : item
        ));
      } catch (err) {
        setItems(prev => prev.map((item, idx) =>
          idx === i ? {
            ...item,
            status: 'error',
            error: (err as Error).message,
          } : item
        ));
      }
    }

    setIsLoading(false);
    setStep('review');
  };

  // 複製全部 Prompts（手動模式）
  const handleCopyAllPrompts = async () => {
    const allPrompts = items
      .filter(item => item.status === 'success' && item.rawResponse)
      .map((item, idx) => `=== [${idx + 1}] ${item.url} ===\n\n${item.rawResponse}`)
      .join('\n\n' + '='.repeat(60) + '\n\n');

    try {
      await navigator.clipboard.writeText(allPrompts);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = allPrompts;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    }
  };

  // 手動模式：解析回應
  const handleParseManualResponse = (index: number) => {
    const item = items[index];
    const response = manualResponses[item.url];

    if (!response?.trim()) return;

    try {
      const parsed = parseAIResponse(response);
      if (!parsed || !parsed.vendorName || !parsed.title) {
        throw new Error('無法解析');
      }
      parsed.sourceUrl = item.url;

      setItems(prev => prev.map((it, idx) =>
        idx === index ? {
          ...it,
          parsed,
          status: 'success',
        } : it
      ));
    } catch {
      setItems(prev => prev.map((it, idx) =>
        idx === index ? {
          ...it,
          error: '解析失敗，請確認 JSON 格式',
        } : it
      ));
    }
  };

  // 匯入單一項目
  const handleImportItem = async (index: number) => {
    const item = items[index];
    if (!item.parsed) return;

    try {
      await onImport({ url: item.url, parsedPlan: item.parsed });
      setItems(prev => prev.map((it, idx) =>
        idx === index ? { ...it, status: 'imported' } : it
      ));
    } catch (err) {
      setItems(prev => prev.map((it, idx) =>
        idx === index ? { ...it, error: (err as Error).message } : it
      ));
    }
  };

  // 批次匯入全部成功項目
  const handleImportAll = async () => {
    setIsLoading(true);
    const successItems = items.filter(item => item.status === 'success' && item.parsed);

    for (const item of successItems) {
      try {
        await onImport({ url: item.url, parsedPlan: item.parsed });
        setItems(prev => prev.map(it =>
          it.url === item.url ? { ...it, status: 'imported' } : it
        ));
      } catch (err) {
        setItems(prev => prev.map(it =>
          it.url === item.url ? { ...it, error: (err as Error).message } : it
        ));
      }
    }

    setIsLoading(false);
  };

  // 重試失敗項目
  const handleRetryFailed = async () => {
    const failedItems = items.filter(item => item.status === 'error');
    if (failedItems.length === 0) return;

    setIsLoading(true);

    for (const failedItem of failedItems) {
      const index = items.findIndex(it => it.url === failedItem.url);

      setItems(prev => prev.map((item, idx) =>
        idx === index ? { ...item, status: 'processing', error: undefined } : item
      ));

      try {
        const response = await fetch('/api/ai-extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: failedItem.url, cli: selectedCLI, service: selectedService }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || '處理失敗');
        }

        setItems(prev => prev.map((item, idx) =>
          idx === index ? {
            ...item,
            status: 'success',
            title: data.data.parsed?.title,
            parsed: data.data.parsed,
            rawResponse: data.data.rawResponse,
          } : item
        ));
      } catch (err) {
        setItems(prev => prev.map((item, idx) =>
          idx === index ? {
            ...item,
            status: 'error',
            error: (err as Error).message,
          } : item
        ));
      }
    }

    setIsLoading(false);
  };

  // 統計
  const stats = {
    total: items.length,
    success: items.filter(i => i.status === 'success').length,
    imported: items.filter(i => i.status === 'imported').length,
    error: items.filter(i => i.status === 'error').length,
    pending: items.filter(i => i.status === 'pending' || i.status === 'processing').length,
  };

  // 渲染內容
  const renderContent = () => {
    switch (step) {
      case 'input':
        return (
          <div className="space-y-4">
            {/* URL 輸入 */}
            <div>
              <label className="block text-sm font-medium mb-2">
                貼上多個網址（每行一個）
              </label>
              <textarea
                value={urls}
                onChange={(e) => setUrls(e.target.value)}
                placeholder="https://example1.com/menu&#10;https://example2.com/newyear&#10;https://example3.com/set"
                rows={6}
                className="w-full px-4 py-3 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                autoFocus
              />
              <p className="mt-1 text-xs text-[var(--muted)]">
                偵測到 {parseUrls(urls).length} 個有效網址
              </p>
            </div>

            {/* 處理模式選擇 */}
            <div className="flex gap-2">
              <button
                onClick={() => setProcessMode('auto')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border text-sm transition-colors ${
                  processMode === 'auto'
                    ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
                    : 'border-[var(--border)] hover:border-[var(--primary)]'
                }`}
              >
                <Zap className="w-4 h-4" />
                自動處理
              </button>
              <button
                onClick={() => setProcessMode('manual')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border text-sm transition-colors ${
                  processMode === 'manual'
                    ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
                    : 'border-[var(--border)] hover:border-[var(--primary)]'
                }`}
              >
                <Settings className="w-4 h-4" />
                手動處理
              </button>
            </div>

            {/* 爬取服務選擇 */}
            <div>
              <label className="block text-sm font-medium mb-2">爬取服務</label>
              <div className="grid grid-cols-3 gap-2">
                {(['jina', 'firecrawl', 'local', 'crawl4ai', 'scrapegraph'] as ScraperService[]).map((service) => {
                  const serviceInfo = availableServices[service];
                  const alwaysAvailable = ['local', 'crawl4ai', 'scrapegraph'].includes(service);
                  const isAvailable = alwaysAvailable || serviceInfo?.available !== false;
                  const serviceLabels: Record<ScraperService, string> = {
                    jina: 'Jina AI',
                    firecrawl: 'Firecrawl',
                    local: '本地爬取',
                    crawl4ai: 'Crawl4AI',
                    scrapegraph: 'ScrapeGraph',
                  };
                  return (
                    <button
                      key={service}
                      onClick={() => setSelectedService(service)}
                      disabled={!isAvailable}
                      className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                        selectedService === service
                          ? 'border-[var(--primary)] bg-[var(--primary)] text-white'
                          : !isAvailable
                          ? 'border-[var(--border)] opacity-50 cursor-not-allowed'
                          : 'border-[var(--border)] hover:border-[var(--primary)]'
                      }`}
                    >
                      {serviceLabels[service]}
                      {!isAvailable && ' (未設定)'}
                    </button>
                  );
                })}
              </div>
              {selectedService === 'local' && (
                <p className="mt-2 text-xs text-[var(--muted)]">
                  使用 Playwright + Readability，完全在本地執行
                </p>
              )}
              {selectedService === 'crawl4ai' && (
                <p className="mt-2 text-xs text-[var(--muted)]">
                  使用 Crawl4AI Python 庫
                </p>
              )}
              {selectedService === 'scrapegraph' && (
                <p className="mt-2 text-xs text-[var(--muted)]">
                  使用 ScrapeGraphAI，結合 LLM 智能爬取
                </p>
              )}
            </div>

            {/* 自動模式：CLI 選擇 */}
            {processMode === 'auto' && (
              <div>
                <label className="block text-sm font-medium mb-2">AI CLI</label>
                <div className="flex gap-2">
                  {(['claude', 'gemini', 'gpt'] as CLITool[]).map((cli) => (
                    <button
                      key={cli}
                      onClick={() => setSelectedCLI(cli)}
                      disabled={availableCLIs[cli] === false}
                      className={`flex-1 px-4 py-2 rounded-lg border text-sm transition-colors ${
                        selectedCLI === cli
                          ? 'border-[var(--primary)] bg-[var(--primary)] text-white'
                          : availableCLIs[cli] === false
                          ? 'border-[var(--border)] opacity-50 cursor-not-allowed'
                          : 'border-[var(--border)] hover:border-[var(--primary)]'
                      }`}
                    >
                      {cli}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 操作按鈕 */}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--background)] transition-colors"
              >
                取消
              </button>
              {processMode === 'auto' ? (
                <button
                  onClick={handleAutoProcess}
                  disabled={parseUrls(urls).length === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50"
                >
                  <Zap className="w-4 h-4" />
                  開始批次處理
                </button>
              ) : (
                <button
                  onClick={handleManualScrape}
                  disabled={parseUrls(urls).length === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50"
                >
                  爬取全部網頁
                </button>
              )}
            </div>
          </div>
        );

      case 'processing':
        return (
          <div className="py-8">
            <div className="text-center mb-6">
              <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-[var(--primary)]" />
              <p className="text-sm font-medium mb-1">
                正在處理 {currentIndex + 1} / {items.length}
              </p>
              <p className="text-xs text-[var(--muted)]">
                {processMode === 'auto' ? `使用 ${selectedCLI} CLI 處理中` : '爬取網頁中'}
              </p>
            </div>

            {/* 進度清單 */}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {items.map((item, index) => (
                <div
                  key={index}
                  className={`p-2 rounded-lg border text-sm flex items-center gap-2 ${
                    item.status === 'processing' ? 'border-blue-300 bg-blue-50' :
                    item.status === 'success' ? 'border-green-300 bg-green-50' :
                    item.status === 'error' ? 'border-red-300 bg-red-50' :
                    'border-[var(--border)]'
                  }`}
                >
                  {item.status === 'processing' && <Loader2 className="w-4 h-4 animate-spin text-blue-500 flex-shrink-0" />}
                  {item.status === 'success' && <Check className="w-4 h-4 text-green-500 flex-shrink-0" />}
                  {item.status === 'error' && <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                  {item.status === 'pending' && <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />}
                  <span className="truncate flex-1">{item.title || item.url}</span>
                </div>
              ))}
            </div>
          </div>
        );

      case 'review':
        return (
          <div className="space-y-4">
            {/* 統計摘要 */}
            <div className="flex items-center gap-4 text-sm">
              <span className="text-green-600">成功: {stats.success}</span>
              <span className="text-blue-600">已匯入: {stats.imported}</span>
              {stats.error > 0 && <span className="text-red-600">失敗: {stats.error}</span>}
            </div>

            {/* 手動模式：複製全部 Prompt */}
            {processMode === 'manual' && stats.success > 0 && !items.some(i => i.parsed) && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700 mb-2">
                  請複製 Prompts，用 AI CLI 處理後貼回結果。
                </p>
                <button
                  onClick={handleCopyAllPrompts}
                  className="flex items-center gap-2 px-3 py-2 text-sm bg-[var(--primary)] text-white rounded-lg"
                >
                  {copiedAll ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiedAll ? '已複製' : '複製全部 Prompts'}
                </button>
              </div>
            )}

            {/* 結果清單 */}
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {items.map((item, index) => (
                <div key={index} className="p-3 border border-[var(--border)] rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {item.status === 'success' && <Check className="w-4 h-4 text-green-500 flex-shrink-0" />}
                      {item.status === 'imported' && <Check className="w-4 h-4 text-blue-500 flex-shrink-0" />}
                      {item.status === 'error' && <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                      <span className="text-sm font-medium truncate">
                        {item.parsed?.vendorName || item.title || item.url}
                      </span>
                    </div>
                    {item.status === 'imported' && (
                      <span className="text-xs text-blue-600 flex-shrink-0">已匯入</span>
                    )}
                  </div>

                  {/* 已解析的資料預覽 */}
                  {item.parsed && (
                    <div className="text-xs text-[var(--muted)] mb-2">
                      {item.parsed.title} | ${item.parsed.priceDiscount?.toLocaleString()}
                    </div>
                  )}

                  {/* 錯誤訊息 */}
                  {item.error && (
                    <p className="text-xs text-red-500 mb-2">{item.error}</p>
                  )}

                  {/* 手動模式：貼上回應 */}
                  {processMode === 'manual' && item.status === 'success' && !item.parsed && (
                    <div className="space-y-2">
                      <textarea
                        value={manualResponses[item.url] || ''}
                        onChange={(e) => setManualResponses(prev => ({
                          ...prev,
                          [item.url]: e.target.value,
                        }))}
                        placeholder="貼上 AI 回應 JSON..."
                        rows={2}
                        className="w-full px-2 py-1 text-xs rounded border border-[var(--border)] bg-[var(--background)]"
                      />
                      <button
                        onClick={() => handleParseManualResponse(index)}
                        disabled={!manualResponses[item.url]?.trim()}
                        className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
                      >
                        解析
                      </button>
                    </div>
                  )}

                  {/* 匯入按鈕 */}
                  {item.status === 'success' && item.parsed && (
                    <button
                      onClick={() => handleImportItem(index)}
                      className="w-full mt-2 px-3 py-1.5 text-xs bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)]"
                    >
                      匯入此項目
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* 操作按鈕 */}
            <div className="flex gap-3">
              {stats.error > 0 && processMode === 'auto' && (
                <button
                  onClick={handleRetryFailed}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--background)]"
                >
                  <RefreshCw className="w-4 h-4" />
                  重試失敗
                </button>
              )}
              {stats.success > 0 && (
                <button
                  onClick={handleImportAll}
                  disabled={isLoading || stats.success === stats.imported}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[var(--success)] text-white text-sm hover:opacity-90 disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  全部匯入 ({stats.success - stats.imported})
                </button>
              )}
              <button
                onClick={handleClose}
                className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--background)]"
              >
                完成
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Modal */}
      <div className="relative bg-[var(--card-bg)] rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--card-bg)]">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Link className="w-5 h-5" />
            批次匯入網址
          </h2>
          <button
            onClick={handleClose}
            className="p-2 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress indicator */}
        {step !== 'input' && (
          <div className="px-6 pt-4">
            <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
              <span>1. 輸入網址</span>
              <span>→</span>
              <span className={step === 'processing' ? 'text-[var(--primary)] font-medium' : ''}>
                2. {processMode === 'auto' ? '自動處理' : '爬取網頁'}
              </span>
              <span>→</span>
              <span className={step === 'review' ? 'text-[var(--primary)] font-medium' : ''}>
                3. 確認匯入
              </span>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-6">
          {renderContent()}

          {error && (
            <div className="mt-4 flex items-center gap-2 text-sm text-[var(--danger)]">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
