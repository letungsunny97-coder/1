/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header.tsx';
import { PlatformBadges } from './components/PlatformBadges.tsx';
import { LinkInputSection } from './components/LinkInputSection.tsx';
import { VideoResultCard } from './components/VideoResultCard.tsx';
import { BatchDownloader } from './components/BatchDownloader.tsx';
import { DownloadHistory } from './components/DownloadHistory.tsx';
import { PlatformFeatures } from './components/PlatformFeatures.tsx';
import { PhoneModal } from './components/PhoneModal.tsx';
import { ApkBuildModal } from './components/ApkBuildModal.tsx';
import { ServerSettingsModal } from './components/ServerSettingsModal.tsx';
import {
  VideoItemMetadata,
  VideoQualityOption,
  DownloadHistoryItem,
  PlatformId,
} from './types/downloader.ts';
import { PLATFORMS, extractCleanUrl, detectPlatform } from './utils/detector.ts';
import { Sparkles, Shield, Zap, Heart } from 'lucide-react';

import { extractVideo } from './server/extractor.ts';
import { getApiEndpoint } from './utils/apiConfig.ts';

const STORAGE_KEY = 'omnisnap_download_history_v1';

export default function App() {
  const [activeTab, setActiveTab] = useState<'single' | 'batch' | 'history'>('single');
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [currentVideo, setCurrentVideo] = useState<VideoItemMetadata | null>(null);
  const [historyItems, setHistoryItems] = useState<DownloadHistoryItem[]>([]);
  const [selectedPlatformSample, setSelectedPlatformSample] = useState<PlatformId | undefined>();

  // Load history from localStorage and setup Android Native Bridge listeners
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setHistoryItems(JSON.parse(saved));
      }
    } catch {
      // Ignore storage read error
    }

    // Android Native Bridge callback for auto-pasted text
    (window as any).__handleNativePastedText = (text: string) => {
      if (text && text.trim()) {
        setInputValue(text.trim());
        const clean = extractCleanUrl(text.trim());
        if (clean) {
          handleScan(clean);
        }
      }
    };

    // Android Native Share intent callback
    (window as any).__handleIncomingShare = (text: string) => {
      if (text && text.trim()) {
        setInputValue(text.trim());
        const clean = extractCleanUrl(text.trim());
        if (clean) {
          handleScan(clean);
        }
      }
    };
  }, []);

  // Save history to localStorage
  const saveHistory = (items: DownloadHistoryItem[]) => {
    setHistoryItems(items);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignore storage write error
    }
  };

  const handleScan = async (urlToScan: string) => {
    const cleanUrl = extractCleanUrl(urlToScan);
    if (!cleanUrl) {
      setErrorMessage('Vui lòng nhập đường dẫn hợp lệ từ YouTube, TikTok, Douyin, Tiểu Hồng Thư (Xiaohongshu), Facebook, X, Instagram hoặc Bilibili.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(undefined);

    try {
      let data: VideoItemMetadata | null = null;

      // 1. If running inside Android APK (has AndroidBridge), use native device extraction first:
      const hasAndroidBridge = typeof window !== 'undefined' && !!(window as any).AndroidBridge;
      if (hasAndroidBridge) {
        try {
          data = await extractVideo(cleanUrl);
        } catch (nativeErr) {
          console.warn('Native extraction skipped, fallback to API:', nativeErr);
        }
      }

      // 2. If not Android or native didn't produce data, try server API endpoint if available:
      if (!data) {
        const endpoint = getApiEndpoint('/api/extract');
        if (endpoint) {
          let serverRespondedJson = false;
          try {
            const resp = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: cleanUrl }),
            });

            const contentType = resp.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
              serverRespondedJson = true;
              const resJson = await resp.json();
              if (resJson.success && resJson.data) {
                data = resJson.data;
              } else if (resJson.error) {
                throw new Error(resJson.error);
              }
            } else {
              // Server did not return JSON (e.g. HTML 502/404/redirect), fallback to client extraction
              data = await extractVideo(cleanUrl);
            }
          } catch (apiErr: any) {
            // Only fall back to client extraction when the backend endpoint wasn't reachable / non-JSON
            if (!data && !serverRespondedJson) {
              try {
                data = await extractVideo(cleanUrl);
              } catch {
                const msg =
                  apiErr?.message?.includes('JSON') || apiErr?.message?.includes('token')
                    ? 'Không thể phân tích video từ liên kết này. Vui lòng kiểm tra lại liên kết video có ở chế độ công khai không.'
                    : apiErr?.message || 'Có lỗi khi phân tích liên kết. Vui lòng thử lại sau ít giây.';
                throw new Error(msg);
              }
            } else if (!data && apiErr) {
              throw apiErr;
            }
          }
        } else {
          // No remote server endpoint (running offline in standalone APK), extract directly on device
          data = await extractVideo(cleanUrl);
        }
      }

      if (data) {
        setCurrentVideo(data);
      } else {
        setErrorMessage('Không thể phân tích video từ liên kết này. Vui lòng kiểm tra lại liên kết video có ở chế độ công khai không.');
      }
    } catch (err: any) {
      const displayMsg =
        err?.message?.includes('JSON') || err?.message?.includes('token') || err?.message?.includes('doctype')
          ? 'Không thể phân tích video từ liên kết này. Vui lòng kiểm tra lại liên kết video có ở chế độ công khai không.'
          : err?.message || 'Có lỗi khi phân tích liên kết. Vui lòng thử lại.';
      setErrorMessage(displayMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectSample = (platformId: PlatformId) => {
    setSelectedPlatformSample(platformId);
    const sample = PLATFORMS[platformId];
    if (sample && sample.sampleUrl) {
      setInputValue(sample.sampleUrl);
      setActiveTab('single');
      handleScan(sample.sampleUrl);
    }
  };

  const handleDownloadCompleted = (item: VideoItemMetadata, option: VideoQualityOption) => {
    const safeTitle = (item.title || 'video')
      .replace(/[^\w\s-]/gi, '')
      .trim()
      .substring(0, 30)
      .replace(/\s+/g, '_') || 'video';
    const fileName = `${item.platform}_${safeTitle}_${option.quality}.${option.format}`;

    const newHistoryItem: DownloadHistoryItem = {
      id: `hist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      metadata: item,
      selectedOptionId: option.id,
      downloadedAt: Date.now(),
      fileName,
    };

    const updated = [newHistoryItem, ...historyItems.slice(0, 49)]; // Keep max 50
    saveHistory(updated);
  };

  const handleClearHistory = () => {
    if (window.confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử tải về không?')) {
      saveHistory([]);
    }
  };

  const handleRemoveHistoryItem = (id: string) => {
    const updated = historyItems.filter((i) => i.id !== id);
    saveHistory(updated);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-indigo-600/15 rounded-full blur-[140px]" />
        <div className="absolute top-1/3 -left-40 w-[450px] h-[350px] bg-pink-600/10 rounded-full blur-[130px]" />
        <div className="absolute bottom-10 -right-40 w-[450px] h-[350px] bg-cyan-600/10 rounded-full blur-[130px]" />
      </div>

      {/* Main Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        historyCount={historyItems.length}
      />

      {/* Body content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        {activeTab === 'single' && (
          <div className="space-y-6 max-w-2xl mx-auto">
            {/* Minimal Header */}
            <div className="text-center space-y-1">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Dán link ➔ Tải video & album ảnh không logo
              </h1>
              <p className="text-xs text-slate-400">
                Hỗ trợ YouTube, TikTok, Douyin, Tiểu Hồng Thư (Xiaohongshu), X (Twitter), Instagram, Facebook • Ảnh 4K/HD & Video gốc
              </p>
            </div>

            {/* Input Form Section */}
            <LinkInputSection
              inputValue={inputValue}
              setInputValue={setInputValue}
              onScan={handleScan}
              isLoading={isLoading}
              errorMessage={errorMessage}
              onClearError={() => setErrorMessage(undefined)}
            />

            {/* Quick Test Sample Chips */}
            <div className="flex items-center justify-center gap-1.5 flex-wrap text-[11px]">
              <span className="text-slate-500 mr-1">Thử nhanh:</span>
              {(['youtube', 'tiktok', 'douyin', 'xiaohongshu', 'facebook', 'x', 'instagram', 'bilibili'] as PlatformId[]).map((pid) => (
                <button
                  key={pid}
                  type="button"
                  onClick={() => handleSelectSample(pid)}
                  className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800/80 transition-colors"
                >
                  {PLATFORMS[pid].shortName}
                </button>
              ))}
            </div>

            {/* Scanned Video Result Section: Direct, Compact, No-Scroll */}
            <div id="scan-result-section">
              {currentVideo && (
                <div className="animate-in fade-in zoom-in-95 duration-200">
                  <VideoResultCard
                    metadata={currentVideo}
                    onDownloadCompleted={handleDownloadCompleted}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Batch Tab */}
        {activeTab === 'batch' && (
          <BatchDownloader onBatchItemDownloaded={handleDownloadCompleted} />
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <DownloadHistory
            historyItems={historyItems}
            onClearHistory={handleClearHistory}
            onRemoveItem={handleRemoveHistoryItem}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/90 py-6 text-center text-xs text-slate-500">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300">Seraph Video Downloader</span>
            <span>•</span>
            <span>Không lưu trữ video trên máy chủ</span>
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <span>Hỗ trợ tải không logo 8 nền tảng hàng đầu thế giới</span>
          </div>
        </div>
      </footer>
      {/* Phone QR Code Modal */}
      <PhoneModal />
      {/* APK Build and Download Code Modal */}
      <ApkBuildModal />
      {/* API Server Settings Modal */}
      <ServerSettingsModal />
    </div>
  );
}
