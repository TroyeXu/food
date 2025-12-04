'use client';

import { useState } from 'react';
import {
  Search,
  Eye,
  Edit3,
  Link,
  Upload,
  Download,
  Share2,
  AlertCircle,
  CheckCircle,
  FileWarning,
} from 'lucide-react';
import { usePlanStore } from '@/stores/planStore';

interface ToolbarProps {
  onImportUrl: () => void;
  onImportImage: () => void;
  onExport: (format: 'csv' | 'json') => void;
}

export default function Toolbar({ onImportUrl, onImportImage, onExport }: ToolbarProps) {
  const { filters, setFilters, editMode, setEditMode, getStatusCounts } = usePlanStore();
  const [showExportMenu, setShowExportMenu] = useState(false);

  const counts = getStatusCounts();

  return (
    <header className="sticky top-0 z-50 bg-[var(--card-bg)] border-b border-[var(--border)] px-4 py-3">
      <div className="flex items-center gap-4 flex-wrap">
        {/* Logo / Title */}
        <h1 className="text-lg font-bold text-[var(--primary)] whitespace-nowrap">
          年菜比較
        </h1>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
          <input
            type="text"
            placeholder="搜尋餐廳、方案、菜名..."
            value={filters.searchQuery || ''}
            onChange={(e) => setFilters({ searchQuery: e.target.value })}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
          />
        </div>

        {/* Mode Toggle */}
        <div className="flex items-center bg-[var(--background)] rounded-lg p-1 border border-[var(--border)]">
          <button
            onClick={() => setEditMode('browse')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
              editMode === 'browse'
                ? 'bg-[var(--primary)] text-white'
                : 'text-[var(--secondary)] hover:text-[var(--foreground)]'
            }`}
          >
            <Eye className="w-4 h-4" />
            瀏覽
          </button>
          <button
            onClick={() => setEditMode('edit')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
              editMode === 'edit'
                ? 'bg-[var(--primary)] text-white'
                : 'text-[var(--secondary)] hover:text-[var(--foreground)]'
            }`}
          >
            <Edit3 className="w-4 h-4" />
            編輯
          </button>
        </div>

        {/* Import Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onImportUrl}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--primary)] text-white text-sm hover:bg-[var(--primary-hover)] transition-colors"
          >
            <Link className="w-4 h-4" />
            貼網址
          </button>
          <button
            onClick={onImportImage}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--background)] transition-colors"
          >
            <Upload className="w-4 h-4" />
            上傳圖片
          </button>
        </div>

        {/* Status Counts */}
        <div className="flex items-center gap-3 text-sm">
          {counts.needs_review > 0 && (
            <span className="flex items-center gap-1 text-[var(--warning)]">
              <FileWarning className="w-4 h-4" />
              待校正 {counts.needs_review}
            </span>
          )}
          {counts.draft > 0 && (
            <span className="flex items-center gap-1 text-[var(--muted)]">
              <AlertCircle className="w-4 h-4" />
              草稿 {counts.draft}
            </span>
          )}
          <span className="flex items-center gap-1 text-[var(--success)]">
            <CheckCircle className="w-4 h-4" />
            已上架 {counts.published}
          </span>
        </div>

        {/* Export */}
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--background)] transition-colors"
          >
            <Download className="w-4 h-4" />
            匯出
          </button>
          {showExportMenu && (
            <div className="absolute right-0 mt-2 w-40 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg shadow-lg overflow-hidden z-10">
              <button
                onClick={() => {
                  onExport('csv');
                  setShowExportMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--background)] transition-colors"
              >
                匯出 CSV
              </button>
              <button
                onClick={() => {
                  onExport('json');
                  setShowExportMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--background)] transition-colors"
              >
                匯出 JSON
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
