import React, { useState } from 'react';
import { VideoItemMetadata, VideoQualityOption } from '../types/downloader.ts';
import { extractCleanUrl, detectPlatform, PLATFORMS } from '../utils/detector.ts';
import {
  Layers,
  Sparkles,
  Download,
  Check,
  AlertCircle,
  Loader2,
  Trash2,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { extractVideo } from '../server/extractor.ts';
import { getApiEndpoint } from '../utils/apiConfig.ts';

interface BatchDownloaderProps {
  onBatchItemDownloaded?: (item: VideoItemMetadata, option: VideoQualityOption) => void;
}

interface BatchItem {
  id: string;
  rawUrl: string;
  cleanUrl: string;
  status: 'pending' | 'scanning' | 'ready' | 'error';
  metadata?: VideoItemMetadata;
  error?: string;
  downloaded?: boolean;
}

export const BatchDownloader: React.FC<BatchDownloaderProps> = ({
  onBatchItemDownloaded,
}) => {
  const [inputText, setInputText] = useState('');
  const [items, setItems] = useState<BatchItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleStartBatch = async () => {
    const lines = inputText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) return;

    const initialItems: BatchItem[] = lines.map((line, idx) => ({
      id: `batch-${Date.now()}-${idx}`,
      rawUrl: line,
      cleanUrl: extractCleanUrl(line),
      status: 'pending',
    }));

    setItems(initialItems);
    setIsProcessing(true);

    // Process items sequentially or in small chunks
    for (let i = 0; i < initialItems.length; i++) {
      const current = initialItems[i];
      setItems((prev) =>
        prev.map((item, idx) => (idx === i ? { ...item, status: 'scanning' } : item))
      );

      try {
        let metadata: VideoItemMetadata | null = null;
        let serverError: string | undefined;
        let serverRespondedJson = false;
        try {
          const endpoint = getApiEndpoint('/api/extract');
          if (endpoint) {
            const resp = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: current.cleanUrl || current.rawUrl }),
            });
            const ct = resp.headers.get('content-type') || '';
            if (ct.includes('application/json')) {
              serverRespondedJson = true;
              const resJson = await resp.json();
              if (resJson.success && resJson.data) {
                metadata = resJson.data;
              } else if (resJson.error) {
                serverError = resJson.error;
              }
            }
          }
        } catch {}

        if (!metadata && !serverRespondedJson) {
          metadata = await extractVideo(current.cleanUrl || current.rawUrl);
        }

        if (metadata) {
          setItems((prev) =>
            prev.map((item, idx) =>
              idx === i ? { ...item, status: 'ready', metadata: metadata! } : item
            )
          );
        } else {
          setItems((prev) =>
            prev.map((item, idx) =>
              idx === i
                ? {
                    ...item,
                    status: 'error',
                    error: serverError || 'Không thể quét liên kết này.',
                  }
                : item
            )
          );
        }
      } catch (err: any) {
        setItems((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: 'error', error: err.message } : item
          )
        );
      }
    }

    setIsProcessing(false);
  };

  const handleDownloadItem = async (batchItem: BatchItem) => {
    if (!batchItem.metadata) return;
    const option =
      batchItem.metadata.options.find((o) => o.isRecommended) ||
      batchItem.metadata.options[0];
    if (!option) return;

    const safeTitle = (batchItem.metadata.title || 'video')
      .replace(/[^\w\s-]/gi, '')
      .trim()
      .substring(0, 25)
      .replace(/\s+/g, '_') || 'batch_video';
    const filename = `${batchItem.metadata.platform}_${safeTitle}.${option.format}`;
    const downloadUrl = option.directUrl || option.url;

    // 1. Android APK Native Bridge check
    try {
      const androidBridge = (window as any).AndroidBridge;
      if (androidBridge && typeof androidBridge.downloadFile === 'function') {
        const mime = option.format === 'mp3' ? 'audio/mpeg' : option.format === 'jpg' ? 'image/jpeg' : 'video/mp4';
        androidBridge.downloadFile(downloadUrl, filename, mime);
        setItems((prev) =>
          prev.map((it) => (it.id === batchItem.id ? { ...it, downloaded: true } : it))
        );
        if (onBatchItemDownloaded) {
          onBatchItemDownloaded(batchItem.metadata, option);
        }
        return;
      }
    } catch {}

    const needsProxy = /etacloud\.org|vidsnap|akamaized\.net|upos-|bilivideo|xhscdn|rednotecdn|xiaohongshu|rapidcdn\.app|snapcdn\.app|fbcdn\.net|cdninstagram\.com|twimg\.com|tikwm\.com|tiktokcdn|douyinvod|amemv/i.test(downloadUrl);
    const proxyEndpoint = getApiEndpoint(
      `/api/proxy-download?url=${encodeURIComponent(downloadUrl)}&filename=${encodeURIComponent(
        filename
      )}&format=${option.format}`
    );

    // 2. Fetch as Blob
    try {
      if (needsProxy && proxyEndpoint) {
        throw new Error('Use proxy');
      }
      const response = await fetch(downloadUrl, { mode: 'cors' });
      if (response.ok) {
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(blobUrl);
        }, 1500);
      } else {
        throw new Error('Blob failed');
      }
    } catch {
      // 3. Fallback server proxy or direct link
      const link = document.createElement('a');
      link.href = proxyEndpoint || downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        try { document.body.removeChild(link); } catch {}
      }, 1000);
    }

    setItems((prev) =>
      prev.map((it) => (it.id === batchItem.id ? { ...it, downloaded: true } : it))
    );

    if (onBatchItemDownloaded) {
      onBatchItemDownloaded(batchItem.metadata, option);
    }
  };

  const handleDownloadAllReady = () => {
    const readyItems = items.filter((it) => it.status === 'ready' && it.metadata);
    readyItems.forEach((it, index) => {
      setTimeout(() => {
        handleDownloadItem(it);
      }, index * 800); // Stagger downloads slightly so browser doesn't block popup
    });
  };

  const handleFillSampleBatch = () => {
    const sampleBatchUrls = [
      PLATFORMS.youtube.sampleUrl,
      PLATFORMS.douyin.sampleUrl,
      PLATFORMS.tiktok.sampleUrl,
      PLATFORMS.x.sampleUrl,
      PLATFORMS.bilibili.sampleUrl,
    ].join('\n');
    setInputText(sampleBatchUrls);
  };

  const readyCount = items.filter((it) => it.status === 'ready').length;

  return (
    <div className="w-full space-y-6">
      {/* Intro box */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Tải Hàng Loạt Video (Batch Downloader)
              </h2>
              <p className="text-xs text-slate-400">
                Dán nhiều liên kết từ Douyin, TikTok, Facebook, X, Instagram, Bilibili cùng lúc
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleFillSampleBatch}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium px-2.5 py-1 rounded-lg bg-indigo-950/40 border border-indigo-800/40"
          >
            Nạp danh sách mẫu 📋
          </button>
        </div>

        {/* Textarea */}
        <textarea
          rows={5}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={`Dán các đường dẫn vào đây (mỗi link 1 dòng)...
https://v.douyin.com/i8Kq7W8/
https://vt.tiktok.com/ZS6M8d9qa/
https://x.com/SpaceX/status/1768262705573425514
https://www.bilibili.com/video/BV1xx411c7mD`}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs sm:text-sm font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/80 resize-y"
        />

        <div className="mt-3 flex items-center justify-between flex-wrap gap-3">
          <span className="text-xs text-slate-500">
            Hỗ trợ phân tích đồng thời tối đa 20 liên kết
          </span>

          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <button
                type="button"
                onClick={() => setItems([])}
                className="px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa kết quả</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleStartBatch}
              disabled={isProcessing || !inputText.trim()}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs sm:text-sm font-semibold shadow-md shadow-indigo-500/20 disabled:opacity-50 flex items-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang quét danh sách...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Bắt Đầu Quét Hàng Loạt</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Scanned batch items list */}
      {items.length > 0 && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white">Kết quả phân tích:</span>
              <span className="text-xs text-emerald-400 font-semibold bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-800/40">
                {readyCount}/{items.length} Sẵn sàng
              </span>
            </div>

            {readyCount > 1 && (
              <button
                type="button"
                onClick={handleDownloadAllReady}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-2"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tải tất cả {readyCount} video ({'>'}1080p Không logo)</span>
              </button>
            )}
          </div>

          <div className="space-y-3">
            {items.map((it, idx) => {
              const platform = detectPlatform(it.cleanUrl || it.rawUrl);
              const pInfo = PLATFORMS[platform];

              return (
                <div
                  key={it.id}
                  className="p-3 bg-slate-950/50 border border-slate-800/80 rounded-xl flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-mono font-bold text-slate-500 w-5">
                      #{idx + 1}
                    </span>

                    {/* Thumbnail preview if ready */}
                    {it.metadata ? (
                      <img
                        src={it.metadata.thumbnail}
                        alt="thumb"
                        className="w-12 h-12 rounded-lg object-cover border border-slate-700 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center text-slate-500 flex-shrink-0">
                        {it.status === 'scanning' ? (
                          <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                        ) : (
                          <span className="text-xs font-bold">{pInfo.shortName.charAt(0)}</span>
                        )}
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold">
                          {pInfo.shortName}
                        </span>
                        {it.metadata && (
                          <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
                            <ShieldCheck className="w-3 h-3" /> Không logo
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-medium text-slate-200 truncate max-w-sm mt-0.5">
                        {it.metadata?.title || it.cleanUrl || it.rawUrl}
                      </p>
                      {it.error && <p className="text-[11px] text-rose-400">{it.error}</p>}
                    </div>
                  </div>

                  {/* Actions / Status */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {it.status === 'scanning' && (
                      <span className="text-xs text-indigo-400 flex items-center gap-1">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Đang quét...
                      </span>
                    )}

                    {it.status === 'error' && (
                      <span className="text-xs text-rose-400 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> Lỗi link
                      </span>
                    )}

                    {it.status === 'ready' && (
                      <button
                        type="button"
                        onClick={() => handleDownloadItem(it)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                          it.downloaded
                            ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm'
                        }`}
                      >
                        {it.downloaded ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Đã tải</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5" />
                            <span>
                              {(it.metadata?.options.find((o) => o.isRecommended) || it.metadata?.options[0])?.format === 'jpg'
                                ? 'Tải Ảnh'
                                : 'Tải MP4'}
                            </span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
