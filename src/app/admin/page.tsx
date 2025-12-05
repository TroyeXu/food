'use client';

import { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  Download,
  Upload,
  Link,
  CheckCircle,
  AlertCircle,
  FileWarning,
  ArrowLeft,
  Eye,
  CheckSquare,
  Square,
  X,
  Rocket,
} from 'lucide-react';
import { usePlanStore } from '@/stores/planStore';
import { seedMockData } from '@/lib/mockData';
import EditPanel from '@/components/EditPanel';
import ImportModal from '@/components/ImportModal';
import BatchImportModal from '@/components/BatchImportModal';
import type { Plan } from '@/types';
import { REGION_LABELS } from '@/types';

export default function AdminPage() {
  const { plans, loadPlans, addPlan, deletePlan, batchUpdateStatus, batchDelete, clearAllData } = usePlanStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft' | 'needs_review'>('all');
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [isNewPlan, setIsNewPlan] = useState(false);
  const [importMode, setImportMode] = useState<'url' | 'image' | null>(null);
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

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

  const filteredPlans = plans.filter((plan) => {
    const matchesSearch =
      plan.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plan.vendorName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || plan.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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

  // 批量操作
  const handleBatchPublish = async () => {
    if (!window.confirm(`確定要上架 ${selectedIds.length} 個方案嗎？`)) return;
    setIsBatchProcessing(true);
    try {
      await batchUpdateStatus(selectedIds, 'published');
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

  const handleImport = async (data: { url?: string; files?: FileList; parsedPlan?: Partial<Plan> }) => {
    // 如果有 AI 解析的資料，使用解析結果
    if (data.parsedPlan) {
      const newPlanId = await addPlan({
        vendorId: '',
        vendorName: data.parsedPlan.vendorName || '（待填寫）',
        title: data.parsedPlan.title || '匯入的方案',
        description: data.parsedPlan.description,
        sourceUrl: data.parsedPlan.sourceUrl || data.url,
        priceOriginal: data.parsedPlan.priceOriginal,
        priceDiscount: data.parsedPlan.priceDiscount || 0,
        shippingFee: data.parsedPlan.shippingFee,
        shippingType: data.parsedPlan.shippingType || 'delivery',
        storageType: data.parsedPlan.storageType || 'frozen',
        servingsMin: data.parsedPlan.servingsMin || 4,
        servingsMax: data.parsedPlan.servingsMax,
        orderDeadline: data.parsedPlan.orderDeadline,
        fulfillStart: data.parsedPlan.fulfillStart,
        fulfillEnd: data.parsedPlan.fulfillEnd,
        region: data.parsedPlan.region,
        city: data.parsedPlan.city,
        address: data.parsedPlan.address,
        tags: data.parsedPlan.tags || [],
        dishes: data.parsedPlan.dishes || [],
        imageUrl: data.parsedPlan.imageUrl,
        status: 'needs_review',
      });
      await loadPlans();
      const updatedPlans = usePlanStore.getState().plans;
      const newPlan = updatedPlans.find(p => p.id === newPlanId);
      if (newPlan) {
        setEditingPlan(newPlan);
      }
    } else if (data.url) {
      // 舊的純 URL 匯入（備用）
      const newPlanId = await addPlan({
        vendorId: '',
        vendorName: '（待填寫）',
        title: '從網址匯入的方案',
        sourceUrl: data.url,
        priceDiscount: 0,
        shippingType: 'delivery',
        storageType: 'frozen',
        servingsMin: 4,
        tags: [],
        dishes: [],
        status: 'needs_review',
      });
      await loadPlans();
      const updatedPlans = usePlanStore.getState().plans;
      const newPlan = updatedPlans.find(p => p.id === newPlanId);
      if (newPlan) {
        setEditingPlan(newPlan);
      }
    } else if (data.files) {
      const newPlanId = await addPlan({
        vendorId: '',
        vendorName: '（待填寫）',
        title: '從圖片匯入的方案',
        priceDiscount: 0,
        shippingType: 'delivery',
        storageType: 'frozen',
        servingsMin: 4,
        tags: [],
        dishes: [],
        status: 'needs_review',
      });
      await loadPlans();
      const updatedPlans = usePlanStore.getState().plans;
      const newPlan = updatedPlans.find(p => p.id === newPlanId);
      if (newPlan) {
        setEditingPlan(newPlan);
      }
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
            <a
              href="/"
              target="_blank"
              className="flex items-center gap-2 px-3 py-2 text-sm border border-[var(--border)] rounded-lg hover:bg-[var(--background)] transition-colors"
            >
              <Eye className="w-4 h-4" />
              預覽前台
            </a>
            <button
              onClick={() => setImportMode('url')}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
            >
              <Link className="w-4 h-4" />
              貼網址
            </button>
            <button
              onClick={() => setShowBatchImport(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-[var(--primary)] text-[var(--primary)] rounded-lg hover:bg-[var(--primary)]/10 transition-colors"
            >
              <Upload className="w-4 h-4" />
              批次匯入
            </button>
            <button
              onClick={() => setImportMode('image')}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-[var(--border)] rounded-lg hover:bg-[var(--background)] transition-colors"
            >
              <Upload className="w-4 h-4" />
              上傳圖片
            </button>
            <button
              onClick={() => {
                setEditingPlan(null);
                setIsNewPlan(true);
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-[var(--success)] text-white rounded-lg hover:opacity-90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              新增方案
            </button>
          </div>
        </div>
      </header>

      <div className="p-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
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
              onClick={handleClearAllData}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              清除所有資料
            </button>
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
            <button
              onClick={handleExportToPublic}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:opacity-90 transition-colors"
            >
              <Rocket className="w-4 h-4" />
              發布到網站
            </button>
          </div>
        </div>

        {/* Batch Actions Bar */}
        {selectedIds.length > 0 && (
          <div className="mb-4 flex items-center gap-4 p-4 bg-[var(--primary)]/10 border border-[var(--primary)]/30 rounded-xl">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-[var(--primary)]" />
              <span className="font-medium">已選取 {selectedIds.length} 個方案</span>
            </div>
            <div className="flex items-center gap-2 ml-auto">
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
                title="取消選取"
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
                <th className="px-4 py-3 text-left">
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
                <th className="px-4 py-3 text-left text-sm font-medium text-[var(--muted)]">方案</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-[var(--muted)]">價格</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-[var(--muted)]">份量</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-[var(--muted)]">地區</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-[var(--muted)]">截止日</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-[var(--muted)]">狀態</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-[var(--muted)]">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlans.map((plan) => (
                <tr
                  key={plan.id}
                  className={`border-b border-[var(--border)] hover:bg-[var(--background)]/50 ${
                    selectedIds.includes(plan.id) ? 'bg-[var(--primary)]/5' : ''
                  }`}
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
                        <p className="text-xs text-[var(--muted)]">{plan.vendorName}</p>
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
                  <td className="px-4 py-3 text-sm">
                    {plan.region ? REGION_LABELS[plan.region] : '-'}
                    {plan.city && <span className="text-[var(--muted)] ml-1">({plan.city})</span>}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {plan.orderDeadline || '-'}
                  </td>
                  <td className="px-4 py-3">
                    {getStatusBadge(plan.status)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
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
                        onClick={() => handleDelete(plan)}
                        className="p-2 text-[var(--muted)] hover:text-[var(--danger)] transition-colors"
                        title="刪除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
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

      {/* Import Modal */}
      <ImportModal
        isOpen={importMode !== null}
        mode={importMode || 'url'}
        onClose={() => setImportMode(null)}
        onImport={handleImport}
      />

      {/* Batch Import Modal */}
      <BatchImportModal
        isOpen={showBatchImport}
        onClose={() => setShowBatchImport(false)}
        onImport={handleImport}
      />
    </div>
  );
}
