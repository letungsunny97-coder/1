import React, { useState, useEffect } from 'react';
import {
  Link as LinkIcon,
  ClipboardPaste,
  Sparkles,
  X,
  Loader2,
  AlertCircle,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { PlatformId } from '../types/downloader.ts';
import { detectPlatform, extractCleanUrl, PLATFORMS } from '../utils/detector.ts';

interface LinkInputSectionProps {
  inputValue: string;
  setInputValue: (val: string) => void;
  onScan: (url: string) => void;
  isLoading: boolean;
  errorMessage?: string;
  onClearError?: () => void;
}

export const LinkInputSection: React.FC<LinkInputSectionProps> = ({
  inputValue,
  setInputValue,
  onScan,
  isLoading,
  errorMessage,
  onClearError,
}) => {
  const [detectedPlatform, setDetectedPlatform] = useState<PlatformId>('unknown');
  const [copiedClipboardState, setCopiedClipboardState] = useState(false);

  useEffect(() => {
    if (inputValue.trim()) {
      const p = detectPlatform(inputValue);
      setDetectedPlatform(p);
      if (errorMessage && onClearError) {
        onClearError();
      }
    } else {
      setDetectedPlatform('unknown');
    }
  }, [inputValue]);

  const handlePasteFromClipboard = async () => {
    let pastedText = '';

    // 1. Check if running inside Android APK Native Bridge
    try {
      const androidBridge = (window as any).AndroidBridge;
      if (androidBridge && typeof androidBridge.getClipboardText === 'function') {
        const nativeText = androidBridge.getClipboardText();
        if (nativeText && typeof nativeText === 'string' && nativeText.trim()) {
          pastedText = nativeText;
        }
      }
    } catch {
      // Ignore Android bridge exception
    }

    // 2. Standard navigator.clipboard (Desktop & Modern mobile browsers)
    if (!pastedText) {
      try {
        if (navigator.clipboard && navigator.clipboard.readText) {
          const text = await navigator.clipboard.readText();
          if (text && text.trim()) {
            pastedText = text;
          }
        }
      } catch {
        // Fallback below
      }
    }

    // 3. Fallback: focus input and trigger execCommand or manual prompt if browser blocks permissions
    if (!pastedText) {
      const inputEl = document.querySelector('input[aria-label="Đường dẫn video cần tải"]') as HTMLInputElement;
      if (inputEl) {
        inputEl.focus();
        try {
          // Attempt document paste
          const success = document.execCommand('paste');
          if (success && inputEl.value) {
            pastedText = inputEl.value;
          }
        } catch {
          // Ignore execCommand fail
        }
      }
    }

    // Process pasted text if found
    if (pastedText && pastedText.trim()) {
      setInputValue(pastedText.trim());
      setCopiedClipboardState(true);
      setTimeout(() => setCopiedClipboardState(false), 2000);

      // Auto scan clean URL
      const clean = extractCleanUrl(pastedText.trim());
      if (clean) {
        onScan(clean);
      }
    } else {
      // Focus directly into input so user keyboard shows "Paste / Dán" suggestion immediately without any annoying alert popup
      const inputEl = document.querySelector('input[aria-label="Đường dẫn video cần tải"]') as HTMLInputElement;
      if (inputEl) {
        inputEl.focus();
        inputEl.select();
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    onScan(inputValue.trim());
  };

  const platformInfo = PLATFORMS[detectedPlatform];

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex flex-col md:flex-row items-stretch gap-2.5 p-2 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl shadow-indigo-500/5 focus-within:border-indigo-500/80 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
          {/* Main Input Container */}
          <div className="flex-1 flex items-center min-w-0 px-3 py-2">
            <div className="mr-3 text-slate-500 flex-shrink-0">
              <LinkIcon className="w-5 h-5 text-indigo-400" />
            </div>

            <div className="flex-1 min-w-0">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Dán link Video hoặc Album ảnh: TikTok, Tiểu Hồng Thư, X, Instagram, Douyin..."
                disabled={isLoading}
                aria-label="Đường dẫn video cần tải"
                className="w-full bg-transparent text-sm sm:text-base text-white placeholder-slate-500 focus:outline-none"
              />
            </div>

            {/* Quick detected platform badge if recognized */}
            {detectedPlatform !== 'unknown' && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs font-semibold text-slate-300 mr-2 flex-shrink-0">
                <span
                  className={`w-2 h-2 rounded-full bg-gradient-to-r ${platformInfo.gradient}`}
                />
                <span>{platformInfo.shortName}</span>
              </div>
            )}

            {/* Clear button if has value */}
            {inputValue && !isLoading && (
              <button
                type="button"
                onClick={() => setInputValue('')}
                aria-label="Xóa nội dung đã nhập"
                className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors mr-1 flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Paste from clipboard button */}
            <button
              type="button"
              onClick={handlePasteFromClipboard}
              disabled={isLoading}
              title="Dán nhanh từ bảng tạm"
              aria-label="Dán nhanh từ bảng tạm"
              className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/60 transition-all flex-shrink-0"
            >
              <ClipboardPaste className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">
                {copiedClipboardState ? 'Đã dán!' : 'Dán'}
              </span>
            </button>
          </div>

          {/* Action Button */}
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            aria-label="Quét và tải video"
            className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-600 hover:from-indigo-600 hover:via-purple-700 hover:to-pink-700 text-white font-semibold text-sm sm:text-base shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none transition-all transform active:scale-[0.98] flex-shrink-0"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Đang quét video...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Quét & Tải về</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        {/* Dynamic scanner status banner when loading */}
        {isLoading && (
          <div className="mt-2.5 p-3 rounded-xl bg-indigo-950/40 border border-indigo-800/40 flex items-center justify-between text-xs text-indigo-300 animate-pulse">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
              <span>
                Đang kết nối API máy chủ để phân tích luồng không logo cho nền tảng{' '}
                <strong className="text-white">{platformInfo.name}</strong>...
              </span>
            </div>
            <span className="text-[11px] text-indigo-400/80">Tự động chọn độ phân giải cao nhất</span>
          </div>
        )}

        {/* Error message with 1-click in-app reload button */}
        {errorMessage && !isLoading && (
          <div className="mt-2.5 p-3 rounded-xl bg-rose-950/50 border border-rose-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs text-rose-300">
            <div className="flex items-start gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="font-semibold text-rose-200">Không thể quét liên kết:</p>
                <p className="mt-0.5 text-rose-300/90 truncate">{errorMessage}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => {
                  if (onClearError) onClearError();
                  if (inputValue.trim()) onScan(inputValue.trim());
                }}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>Thử lại ngay</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  window.location.reload();
                }}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition-colors cursor-pointer"
              >
                <span>Làm mới app 🔄</span>
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};
