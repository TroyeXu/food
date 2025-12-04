'use client';

import { useState } from 'react';
import { X, Link, Upload, Loader2, AlertCircle } from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  mode: 'url' | 'image';
  onClose: () => void;
  onImport: (data: { url?: string; files?: FileList }) => Promise<void>;
}

export default function ImportModal({ isOpen, mode, onClose, onImport }: ImportModalProps) {
  const [url, setUrl] = useState('');
  const [files, setFiles] = useState<FileList | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (mode === 'url') {
        if (!url.trim()) {
          throw new Error('請輸入網址');
        }
        await onImport({ url: url.trim() });
      } else {
        if (!files || files.length === 0) {
          throw new Error('請選擇圖片');
        }
        await onImport({ files });
      }
      onClose();
      setUrl('');
      setFiles(null);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-[var(--card-bg)] rounded-xl shadow-xl max-w-lg w-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
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
            onClick={onClose}
            className="p-2 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          {mode === 'url' ? (
            <div className="space-y-4">
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
              <p className="text-sm text-[var(--muted)]">
                系統將自動抓取頁面資料並嘗試解析年菜資訊。若解析不完整，可在校正面板補充。
              </p>
            </div>
          ) : (
            <div className="space-y-4">
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
              <p className="text-sm text-[var(--muted)]">
                支援 DM、菜單、價目表等圖片。系統將使用 OCR 辨識文字內容。
              </p>
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-center gap-2 text-sm text-[var(--danger)]">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
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
              {mode === 'url' ? '擷取資料' : '開始辨識'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
