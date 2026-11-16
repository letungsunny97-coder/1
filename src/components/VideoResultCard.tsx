import React, { useState } from 'react';
import {
  VideoItemMetadata,
  VideoQualityOption,
} from '../types/downloader.ts';
import { PLATFORMS } from '../utils/detector.ts';
import { getApiEndpoint } from '../utils/apiConfig.ts';
import {
  Download,
  Copy,
  Check,
  ShieldCheck,
  FileVideo,
  Music,
  RotateCw,
  Image as ImageIcon,
} from 'lucide-react';

interface VideoResultCardProps {
  metadata: VideoItemMetadata;
  onDownloadCompleted?: (item: VideoItemMetadata, option: VideoQualityOption) => void;
}

export const VideoResultCard: React.FC<VideoResultCardProps> = ({
  metadata,
  onDownloadCompleted,
}) => {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const platformInfo = PLATFORMS[metadata.platform] || PLATFORMS.unknown;

  const handleDownload = async (option: VideoQualityOption) => {
    setDownloadingId(option.id);
    setDownloadSuccess(null);

    const safeTitle = (metadata.title || 'video')
      .replace(/[^\w\s-]/gi, '')
      .trim()
      .substring(0, 25)
      .replace(/\s+/g, '_') || 'video';
    const extension = option.format || 'mp4';
    const filename = `${metadata.platform}_${safeTitle}_${option.quality}.${extension}`;
    const downloadUrl = option.directUrl || option.url;

    // 1. Android APK Native Bridge check (Native DownloadManager)
    try {
      const androidBridge = (window as any).AndroidBridge;
      if (androidBridge && typeof androidBridge.downloadFile === 'function') {
        const mime = extension === 'mp3' ? 'audio/mpeg' : extension === 'jpg' ? 'image/jpeg' : 'video/mp4';
        androidBridge.downloadFile(downloadUrl, filename, mime);
        setDownloadingId(null);
        setDownloadSuccess(option.id);
        if (onDownloadCompleted) onDownloadCompleted(metadata, option);
        setTimeout(() => setDownloadSuccess(null), 3000);
        return;
      }
    } catch {
      // Fallback
    }

    const needsProxy = /etacloud\.org|vidsnap|akamaized\.net|upos-|bilivideo|xhscdn|rednotecdn|xiaohongshu|rapidcdn\.app|snapcdn\.app|fbcdn\.net|cdninstagram\.com|twimg\.com|tikwm\.com|tiktokcdn|douyinvod|amemv/i.test(downloadUrl);
    const proxyEndpoint = getApiEndpoint(
      `/api/proxy-download?url=${encodeURIComponent(downloadUrl)}&filename=${encodeURIComponent(
        filename
      )}&format=${extension}`
    );

    // 2. Fetch as Blob directly (skip if upstream requires server Referer/Origin headers)
    try {
      if (needsProxy && proxyEndpoint) {
        throw new Error('Use server proxy');
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
        throw new Error('Direct blob failed');
      }
    } catch {
      // 3. Fallback to server proxy-download to avoid CORS errors
      try {
        const proxyUrl = proxyEndpoint || getApiEndpoint(
          `/api/proxy-download?url=${encodeURIComponent(downloadUrl)}&filename=${encodeURIComponent(
            filename
          )}&format=${extension}`
        );
        const link = document.createElement('a');
        link.href = proxyUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          document.body.removeChild(link);
        }, 1500);
      } catch {
        // Direct link fallback
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          document.body.removeChild(link);
        }, 1000);
      }
    }

    setTimeout(() => {
      setDownloadingId(null);
      setDownloadSuccess(option.id);
      if (onDownloadCompleted) onDownloadCompleted(metadata, option);
      setTimeout(() => setDownloadSuccess(null), 3000);
    }, 800);
  };

  const handleCopy = async (option: VideoQualityOption) => {
    try {
      await navigator.clipboard.writeText(option.url);
      setCopiedId(option.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = option.url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopiedId(option.id);
        setTimeout(() => setCopiedId(null), 2000);
      } catch {}
    }
  };

  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadAllProgress, setDownloadAllProgress] = useState<{ current: number; total: number } | null>(null);
  const [downloadAllDone, setDownloadAllDone] = useState(false);
  const [downloadingImageIdx, setDownloadingImageIdx] = useState<number | null>(null);

  const downloadSingleImage = async (imgUrl: string, index: number) => {
    setDownloadingImageIdx(index);
    const safeTitle = (metadata.title || 'photo')
      .replace(/[^\w\s-]/gi, '')
      .trim()
      .substring(0, 25)
      .replace(/\s+/g, '_') || 'photo';
    const filename = `${metadata.platform}_${safeTitle}_photo_${index + 1}.jpg`;

    // 1. Android APK Native Bridge check
    try {
      const androidBridge = (window as any).AndroidBridge;
      if (androidBridge && typeof androidBridge.downloadFile === 'function') {
        androidBridge.downloadFile(imgUrl, filename, 'image/jpeg');
        setDownloadingImageIdx(null);
        return;
      }
    } catch {}

    const needsProxy = /etacloud\.org|vidsnap|akamaized\.net|upos-|bilivideo|xhscdn|rednotecdn|xiaohongshu|rapidcdn\.app|fbcdn\.net|cdninstagram\.com|twimg\.com|tikwm\.com|tiktokcdn|douyinvod|amemv/i.test(imgUrl);
    const proxyEndpoint = getApiEndpoint(
      `/api/proxy-download?url=${encodeURIComponent(imgUrl)}&filename=${encodeURIComponent(
        filename
      )}&format=jpg`
    );

    // 2. Web Blob download (use server proxy directly if upstream blocks CORS/Referer)
    try {
      if (needsProxy && proxyEndpoint) {
        throw new Error('Use server proxy');
      }
      const response = await fetch(imgUrl, { mode: 'cors' });
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
        throw new Error('fetch blob failed');
      }
    } catch {
      // 3. Fallback proxy
      try {
        const proxyUrl = getApiEndpoint(
          `/api/proxy-download?url=${encodeURIComponent(imgUrl)}&filename=${encodeURIComponent(
            filename
          )}&format=jpg`
        );
        const link = document.createElement('a');
        link.href = proxyUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => document.body.removeChild(link), 1500);
      } catch {
        const link = document.createElement('a');
        link.href = imgUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => document.body.removeChild(link), 1000);
      }
    }
    setTimeout(() => setDownloadingImageIdx(null), 800);
  };

  const handleDownloadAllImages = async () => {
    if (!metadata.images || metadata.images.length === 0 || downloadingAll) return;
    setDownloadingAll(true);
    setDownloadAllDone(false);

    const total = metadata.images.length;
    for (let i = 0; i < total; i++) {
      setDownloadAllProgress({ current: i + 1, total });
      await downloadSingleImage(metadata.images[i], i);
      // Brief pause between downloads for smooth queueing
      await new Promise((r) => setTimeout(r, 400));
    }

    setDownloadingAll(false);
    setDownloadAllProgress(null);
    setDownloadAllDone(true);
    setTimeout(() => setDownloadAllDone(false), 4000);
  };

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4">
      {/* Platform & Title Bar */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`w-2.5 h-2.5 rounded-full bg-gradient-to-r ${platformInfo.gradient} flex-shrink-0`}
          />
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            {platformInfo.name}
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold flex items-center gap-1 flex-shrink-0">
            <ShieldCheck className="w-3 h-3" /> Không Logo
          </span>
        </div>
        <span className="text-xs text-slate-400 font-mono flex-shrink-0">
          {metadata.durationFormatted}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-sm sm:text-base font-bold text-white line-clamp-2 leading-snug">
        {metadata.title}
      </h3>

      {/* Album Photos Preview (Xiaohongshu, TikTok, Douyin, X/Twitter, Instagram) */}
      {metadata.images && metadata.images.length > 0 && (
        <div className="space-y-3 pt-1 p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <span className="font-bold text-sm text-pink-400 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4" />
                <span>Album ảnh gốc không logo ({metadata.images.length} ảnh):</span>
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Độ phân giải siêu nét (Gốc 4K / HD), không dính watermark/logo
              </p>
            </div>

            {/* 1-Click Download Entire Album Button */}
            <button
              type="button"
              onClick={handleDownloadAllImages}
              disabled={downloadingAll}
              className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 flex-shrink-0 ${
                downloadAllDone
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gradient-to-r from-pink-500 via-rose-500 to-indigo-600 hover:from-pink-600 hover:to-indigo-700 text-white shadow-pink-500/20'
              }`}
            >
              {downloadingAll ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  <span>
                    Đang lưu ảnh {downloadAllProgress?.current || 1}/{downloadAllProgress?.total || metadata.images.length}...
                  </span>
                </>
              ) : downloadAllDone ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Đã tải trọn bộ album!</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>TẢI TOÀN BỘ ALBUM ({metadata.images.length} ẢNH)</span>
                </>
              )}
            </button>
          </div>

          {/* Horizontal scroll thumbnails with 1-tap download per image */}
          <div className="flex gap-2.5 overflow-x-auto pb-2 pt-1 scrollbar-thin">
            {metadata.images.map((imgUrl, i) => {
              const isItemDownloading = downloadingImageIdx === i;
              return (
                <div
                  key={i}
                  className="relative flex-shrink-0 w-24 h-32 sm:w-28 sm:h-36 rounded-xl overflow-hidden border border-slate-800 bg-slate-900 group"
                >
                  <img
                    src={imgUrl}
                    alt={`Ảnh ${i + 1}`}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                  <span className="absolute top-1.5 left-1.5 text-[10px] bg-black/80 px-1.5 py-0.5 rounded text-white font-mono font-bold shadow">
                    #{i + 1}
                  </span>

                  {/* 1-Tap Download Overlay Button */}
                  <button
                    type="button"
                    onClick={() => downloadSingleImage(imgUrl, i)}
                    disabled={isItemDownloading}
                    title={`Tải ảnh #${i + 1}`}
                    className="absolute bottom-1.5 right-1.5 p-1.5 rounded-lg bg-black/85 hover:bg-indigo-600 text-white transition-all shadow-md group-hover:scale-110 active:scale-95 flex items-center justify-center"
                  >
                    {isItemDownloading ? (
                      <RotateCw className="w-3.5 h-3.5 animate-spin text-pink-400" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Direct 1-Click Download Options Grid */}
      <div className="space-y-2.5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Chọn định dạng bấm tải ngay:
        </p>

        {metadata.options.map((opt) => {
          const isDownloading = downloadingId === opt.id;
          const isDone = downloadSuccess === opt.id;
          const isCopied = copiedId === opt.id;
          const isAudio = opt.quality === 'audio';
          const isImage = opt.quality === 'image' || opt.format === 'jpg' || opt.format === 'png';

          return (
            <div
              key={opt.id}
              className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                opt.isRecommended
                  ? 'bg-indigo-950/40 border-indigo-500/50 hover:border-indigo-400'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-slate-800 text-indigo-400 flex items-center justify-center flex-shrink-0">
                  {isAudio ? (
                    <Music className="w-4 h-4 text-emerald-400" />
                  ) : isImage ? (
                    <ImageIcon className="w-4 h-4 text-rose-400" />
                  ) : (
                    <FileVideo className="w-4 h-4 text-indigo-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-bold text-white truncate">
                      {opt.label}
                    </span>
                    {opt.isRecommended && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-pink-500/20 text-pink-300 font-bold border border-pink-500/30">
                        GỐC
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {opt.resolution || 'Âm thanh chất lượng cao'} • {opt.sizeFormatted}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleCopy(opt)}
                  title="Sao chép link"
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                >
                  {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={() => handleDownload(opt)}
                  disabled={isDownloading}
                  className="px-3.5 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-pink-500 hover:from-indigo-600 hover:to-pink-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-500/20 active:scale-95 transition-all"
                >
                  {isDownloading ? (
                    <>
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : isDone ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Đã tải!</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>Tải về</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
