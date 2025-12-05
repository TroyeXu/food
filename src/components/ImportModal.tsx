'use client';

import { useState, useEffect } from 'react';
import { X, Link, Upload, Loader2, AlertCircle, Copy, Check, ArrowRight, Sparkles, Zap, Settings } from 'lucide-react';
import { parseAIResponse } from '@/lib/aiPrompt';
import type { Plan } from '@/types';

interface ScrapeResult {
  url: string;
  title: string;
  content: string;
  contentLength: number;
  images: string[];
  hints: {
    prices: number[];
    servings: string[];
    dates: string[];
    phones: string[];
  };
  prompt: string;
}

interface ImportModalProps {
  isOpen: boolean;
  mode: 'url' | 'image';
  onClose: () => void;
  onImport: (data: { url?: string; files?: FileList; parsedPlan?: Partial<Plan> }) => Promise<void>;
}

type Step = 'input' | 'processing' | 'scraping' | 'prompt' | 'response' | 'success';
type CLITool = 'claude' | 'gemini' | 'gpt';
type ProcessMode = 'auto' | 'manual';
type ScraperService = 'jina' | 'firecrawl' | 'local' | 'crawl4ai' | 'scrapegraph';

export default function ImportModal({ isOpen, mode, onClose, onImport }: ImportModalProps) {
  const [url, setUrl] = useState('');
  const [files, setFiles] = useState<FileList | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 處理模式
  const [processMode, setProcessMode] = useState<ProcessMode>('auto');
  const [selectedCLI, setSelectedCLI] = useState<CLITool>('claude');
  const [availableCLIs, setAvailableCLIs] = useState<Record<string, boolean>>({});
  const [selectedService, setSelectedService] = useState<ScraperService>('jina');
  const [availableServices, setAvailableServices] = useState<Record<string, { available: boolean; hasApiKey: boolean }>>({});

  // 工作流狀態
  const [step, setStep] = useState<Step>('input');
  const [scrapeResult, setScrapeResult] = useState<ScrapeResult | null>(null);
  const [aiResponse, setAiResponse] = useState('');
  const [copied, setCopied] = useState(false);
  const [extractedData, setExtractedData] = useState<Partial<Plan> | null>(null);

  // 檢查可用的 CLI 工具和爬取服務
  useEffect(() => {
    if (isOpen && mode === 'url') {
      fetch('/api/ai-extract')
        .then(res => res.json())
        .then(data => {
          setAvailableCLIs(data.available || {});
          if (data.default) {
            setSelectedCLI(data.default);
          }
          // 設定可用的爬取服務
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
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const resetState = () => {
    setUrl('');
    setFiles(null);
    setError(null);
    setStep('input');
    setScrapeResult(null);
    setAiResponse('');
    setCopied(false);
    setExtractedData(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  // 自動模式：一鍵完成全部流程
  const handleAutoProcess = async () => {
    if (!url.trim()) {
      setError('請輸入網址');
      return;
    }

    setError(null);
    setIsLoading(true);
    setStep('processing');

    try {
      const response = await fetch('/api/ai-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), cli: selectedCLI, service: selectedService }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '處理失敗');
      }

      setExtractedData(data.data.parsed);
      setAiResponse(data.data.rawResponse);
      setStep('success');
    } catch (err) {
      setError((err as Error).message);
      setStep('input');
    } finally {
      setIsLoading(false);
    }
  };

  // 確認匯入
  const handleConfirmImport = async () => {
    if (!extractedData) return;

    setIsLoading(true);
    try {
      await onImport({ url, parsedPlan: extractedData });
      handleClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  // 手動模式：步驟 1 爬取網頁
  const handleScrape = async () => {
    if (!url.trim()) {
      setError('請輸入網址');
      return;
    }

    setError(null);
    setIsLoading(true);
    setStep('scraping');

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), service: selectedService }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '爬取失敗');
      }

      setScrapeResult(data.data);
      setStep('prompt');
    } catch (err) {
      setError((err as Error).message);
      setStep('input');
    } finally {
      setIsLoading(false);
    }
  };

  // 複製 Prompt
  const handleCopyPrompt = async () => {
    if (!scrapeResult?.prompt) return;

    try {
      await navigator.clipboard.writeText(scrapeResult.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = scrapeResult.prompt;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // 手動模式：步驟 3 解析 AI 回應並匯入
  const handleParseAndImport = async () => {
    if (!aiResponse.trim()) {
      setError('請貼上 AI 回應');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const parsed = parseAIResponse(aiResponse);

      if (!parsed) {
        throw new Error('無法解析 AI 回應，請確認格式正確');
      }

      if (!parsed.vendorName || !parsed.title) {
        throw new Error('缺少必要欄位：餐廳名稱或方案名稱');
      }

      parsed.sourceUrl = scrapeResult?.url || url;

      await onImport({ url: scrapeResult?.url || url, parsedPlan: parsed });
      handleClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  // 圖片上傳處理
  const handleImageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!files || files.length === 0) {
      setError('請選擇圖片');
      return;
    }
    setIsLoading(true);
    try {
      await onImport({ files });
      handleClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      setFiles(droppedFiles);
    }
  };

  // URL 模式的步驟顯示
  const renderUrlMode = () => {
    switch (step) {
      case 'input':
        return (
          <div className="space-y-4">
            {/* URL 輸入 */}
            <div>
              <label className="block text-sm font-medium mb-2">年菜頁面網址</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-4 py-3 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                autoFocus
              />
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
                  // local, crawl4ai, scrapegraph 總是可用
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
                  使用 Playwright + Readability + Turndown，完全在本地執行
                </p>
              )}
              {selectedService === 'crawl4ai' && (
                <p className="mt-2 text-xs text-[var(--muted)]">
                  使用 Crawl4AI Python 庫，需要 Python 環境
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
                      {availableCLIs[cli] === false && ' (未安裝)'}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  使用 {selectedService === 'jina' ? 'Jina AI' : selectedService === 'firecrawl' ? 'Firecrawl' : '本地爬取'} → {selectedCLI} 處理 → 自動匯入
                </p>
              </div>
            )}

            {/* 手動模式說明 */}
            {processMode === 'manual' && (
              <p className="text-sm text-[var(--muted)]">
                爬取網頁後，手動複製 Prompt 到 AI CLI，再貼回結果。
              </p>
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
                  disabled={isLoading || !url.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50"
                >
                  <Zap className="w-4 h-4" />
                  一鍵匯入
                </button>
              ) : (
                <button
                  onClick={handleScrape}
                  disabled={isLoading || !url.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50"
                >
                  爬取網頁
                </button>
              )}
            </div>
          </div>
        );

      case 'processing':
      case 'scraping':
        return (
          <div className="py-8 text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-[var(--primary)]" />
            <p className="text-sm font-medium mb-2">
              {step === 'processing' ? '正在自動處理...' : '正在爬取網頁...'}
            </p>
            <p className="text-xs text-[var(--muted)]">
              {step === 'processing'
                ? `使用 ${selectedCLI} CLI 擷取資料中`
                : '使用 Jina AI 轉換網頁內容'}
            </p>
          </div>
        );

      case 'success':
        return (
          <div className="space-y-4">
            {/* 成功訊息 */}
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-700 font-medium mb-2">
                <Check className="w-5 h-5" />
                擷取成功！
              </div>
              {extractedData && (
                <div className="text-sm text-green-600 space-y-1">
                  <p><strong>餐廳：</strong>{extractedData.vendorName}</p>
                  <p><strong>方案：</strong>{extractedData.title}</p>
                  <p><strong>價格：</strong>${extractedData.priceDiscount?.toLocaleString()}</p>
                  {extractedData.dishes && extractedData.dishes.length > 0 && (
                    <p><strong>菜色：</strong>{extractedData.dishes.slice(0, 3).join('、')}{extractedData.dishes.length > 3 ? '...' : ''}</p>
                  )}
                </div>
              )}
            </div>

            {/* AI 原始回應（可收合） */}
            <details className="text-xs">
              <summary className="cursor-pointer text-[var(--muted)] hover:text-[var(--foreground)]">
                查看 AI 原始回應
              </summary>
              <pre className="mt-2 p-3 bg-gray-50 border border-[var(--border)] rounded-lg overflow-auto max-h-48 whitespace-pre-wrap">
                {aiResponse}
              </pre>
            </details>

            {/* 操作按鈕 */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setStep('input');
                  setExtractedData(null);
                }}
                className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--background)] transition-colors"
              >
                重新處理
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={isLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[var(--success)] text-white text-sm hover:opacity-90 transition-colors disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                確認匯入
              </button>
            </div>
          </div>
        );

      case 'prompt':
        return (
          <div className="space-y-4">
            {/* 爬取結果摘要 */}
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-700 text-sm font-medium mb-1">
                <Check className="w-4 h-4" />
                爬取成功
              </div>
              <p className="text-sm text-green-600 truncate">{scrapeResult?.title}</p>
              <p className="text-xs text-green-500">
                內容長度: {scrapeResult?.contentLength?.toLocaleString()} 字元
                {scrapeResult?.hints.prices.length ? ` | 偵測價格: ${scrapeResult.hints.prices.map(p => `$${p.toLocaleString()}`).join(', ')}` : ''}
              </p>
            </div>

            {/* Prompt 預覽 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">AI Prompt</label>
                <button
                  onClick={handleCopyPrompt}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? '已複製' : '複製 Prompt'}
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto p-3 bg-gray-50 border border-[var(--border)] rounded-lg text-xs font-mono whitespace-pre-wrap">
                {scrapeResult?.prompt.slice(0, 1000)}...
              </div>
            </div>

            {/* 使用說明 */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
              <p className="font-medium mb-1">下一步：</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>複製上方 Prompt</li>
                <li>貼到你的 AI CLI（claude / gemini / gpt）</li>
                <li>將 AI 回傳的 JSON 貼到下方</li>
              </ol>
            </div>

            <button
              onClick={() => setStep('response')}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--background)] transition-colors"
            >
              <ArrowRight className="w-4 h-4" />
              我已用 AI 處理，貼上回應
            </button>
          </div>
        );

      case 'response':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">貼上 AI 回應（JSON）</label>
              <textarea
                value={aiResponse}
                onChange={(e) => setAiResponse(e.target.value)}
                placeholder='{"vendorName": "...", "title": "...", ...}'
                rows={10}
                className="w-full px-4 py-3 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('prompt')}
                className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--background)] transition-colors"
              >
                返回
              </button>
              <button
                onClick={handleParseAndImport}
                disabled={isLoading || !aiResponse.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                解析並匯入
              </button>
            </div>
          </div>
        );
    }
  };

  // 進度指示器
  const getProgressSteps = () => {
    if (processMode === 'auto') {
      return ['輸入網址', '自動處理', '確認匯入'];
    }
    return ['輸入網址', '複製 Prompt', '貼上回應'];
  };

  const getCurrentStepIndex = () => {
    if (processMode === 'auto') {
      if (step === 'input') return 0;
      if (step === 'processing') return 1;
      if (step === 'success') return 2;
      return 0;
    }
    if (step === 'input' || step === 'scraping') return 0;
    if (step === 'prompt') return 1;
    if (step === 'response') return 2;
    return 0;
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
            {mode === 'url' ? (
              <>
                <Link className="w-5 h-5" />
                匯入網址
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                上傳圖片
              </>
            )}
          </h2>
          <button
            onClick={handleClose}
            className="p-2 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress indicator for URL mode */}
        {mode === 'url' && step !== 'input' && (
          <div className="px-6 pt-4">
            <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
              {getProgressSteps().map((label, index) => (
                <span key={label}>
                  {index > 0 && <span className="mx-2">→</span>}
                  <span className={getCurrentStepIndex() === index ? 'text-[var(--primary)] font-medium' : ''}>
                    {index + 1}. {label}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-6">
          {mode === 'url' ? (
            renderUrlMode()
          ) : (
            <form onSubmit={handleImageSubmit} className="space-y-4">
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-[var(--border)] rounded-lg p-8 text-center hover:border-[var(--primary)] transition-colors cursor-pointer"
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <Upload className="w-12 h-12 mx-auto mb-4 text-[var(--muted)]" />
                <p className="text-sm font-medium mb-1">拖放圖片到這裡</p>
                <p className="text-xs text-[var(--muted)]">或點擊選擇檔案</p>
                <input
                  id="file-input"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setFiles(e.target.files)}
                  className="hidden"
                />
              </div>
              {files && files.length > 0 && (
                <div className="text-sm text-[var(--muted)]">
                  已選擇 {files.length} 個檔案
                </div>
              )}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--background)] transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50"
                >
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  開始辨識
                </button>
              </div>
            </form>
          )}

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
