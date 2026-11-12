import React, { useState } from 'react';
import { DownloadHistoryItem } from '../types/downloader.ts';
import { PLATFORMS } from '../utils/detector.ts';
import {
  History,
  Trash2,
  Download,
  ExternalLink,
  Copy,
  Check,
  Clock,
  HardDrive,
  FileVideo,
} from 'lucide-react';

interface DownloadHistoryProps {
  historyItems: DownloadHistoryItem[];
  onClearHistory: () => void;
  onRemoveItem: (id: string) => void;
}

export const DownloadHistory: React.FC<DownloadHistoryProps> = ({
  historyItems,
  onClearHistory,
  onRemoveItem,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filterPlatform, setFilterPlatform] = useState<string>('all');

  const filteredItems = historyItems.filter((item) => {
    if (filterPlatform === 'all') return true;
    return item.metadata.platform === filterPlatform;
  });

  const handleCopy = async (id: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      window.prompt('Sao chép đường dẫn:', url);
    }
  };

  const handleReDownload = (item: DownloadHistoryItem) => {
    const option =
      item.metadata.options.find((o) => o.id === item.selectedOptionId) ||
      item.metadata.options[0];
    if (!option) return;

    const link = document.createElement('a');
    link.href = `/api/proxy-download?url=${encodeURIComponent(
      option.url
    )}&filename=${encodeURIComponent(item.fileName)}&format=${option.format}`;
    link.download = item.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (historyItems.length === 0) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-10 text-center shadow-xl">
        <div className="w-14 h-14 rounded-2xl bg-slate-800/80 text-slate-400 flex items-center justify-center mx-auto mb-4">
          <History className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-white mb-1">
          Chưa có video nào trong lịch sử tải về
        </h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
          Các video bạn quét và tải từ Douyin, TikTok, Facebook, X, Instagram hoặc Bilibili sẽ được tự động lưu tại đây để tiện xem lại và tải lại bất cứ lúc nào.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-indigo-400" />
          <h2 className="font-bold text-base text-white">Lịch Sử Video Đã Tải</h2>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
            {historyItems.length} video
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Platform filter */}
          <select
            value={filterPlatform}
            onChange={(e) => setFilterPlatform(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 px-2.5 py-1.5 focus:outline-none"
          >
            <option value="all">Tất cả nền tảng</option>
            <option value="douyin">Douyin (抖音)</option>
            <option value="tiktok">TikTok</option>
            <option value="facebook">Facebook</option>
            <option value="x">X (Twitter)</option>
            <option value="instagram">Instagram</option>
            <option value="bilibili">Bilibili</option>
          </select>

          <button
            type="button"
            onClick={onClearHistory}
            className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-rose-800/40 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Xóa lịch sử</span>
          </button>
        </div>
      </div>

      {/* Item list */}
      <div className="space-y-3">
        {filteredItems.map((item) => {
          const pInfo = PLATFORMS[item.metadata.platform];
          const option =
            item.metadata.options.find((o) => o.id === item.selectedOptionId) ||
            item.metadata.options[0];

          return (
            <div
              key={item.id}
              className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap hover:border-slate-700 transition-all"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <img
                  src={item.metadata.thumbnail}
                  alt={item.metadata.title}
                  className="w-14 h-14 rounded-lg object-cover border border-slate-700 flex-shrink-0"
                />

                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                      {pInfo.shortName}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {new Date(item.downloadedAt).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        day: '2-digit',
                        month: '2-digit',
                      })}
                    </span>
                  </div>

                  <h4 className="text-xs sm:text-sm font-semibold text-white truncate max-w-md">
                    {item.metadata.title}
                  </h4>

                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {option?.label} • {option?.sizeFormatted}
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 flex-shrink-0 ml-auto sm:ml-0">
                <button
                  type="button"
                  onClick={() => handleCopy(item.id, option?.url || '')}
                  title="Sao chép link tải"
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                >
                  {copiedId === item.id ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleReDownload(item)}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải lại</span>
                </button>

                <button
                  type="button"
                  onClick={() => onRemoveItem(item.id)}
                  title="Xóa mục này"
                  className="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
