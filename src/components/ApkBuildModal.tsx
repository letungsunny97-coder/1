import React, { useState, useEffect } from 'react';
import {
  Package,
  Download,
  X,
  Check,
  Smartphone,
  Globe,
} from 'lucide-react';
import {
  downloadAndroidZipInBrowser,
  downloadWebDistZipInBrowser,
} from '../utils/downloadAndroidZip.ts';

export const ApkBuildModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'web' | 'android'>('web');
  const [downloadingWeb, setDownloadingWeb] = useState(false);
  const [downloadingAndroid, setDownloadingAndroid] = useState(false);
  const [downloadDone, setDownloadDone] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
      setDownloadError(null);
    };
    window.addEventListener('open-apk-build-modal', handleOpen);
    return () => window.removeEventListener('open-apk-build-modal', handleOpen);
  }, []);

  if (!isOpen) return null;

  const handleDownloadWeb = async () => {
    setDownloadingWeb(true);
    setDownloadError(null);
    try {
      await downloadWebDistZipInBrowser();
      setDownloadDone('web');
      setTimeout(() => setDownloadDone(null), 4000);
    } catch (e: any) {
      setDownloadError(e?.message || 'Không thể tải file zip. Vui lòng thử lại sau.');
    } finally {
      setDownloadingWeb(false);
    }
  };

  const handleDownloadAndroid = async () => {
    setDownloadingAndroid(true);
    setDownloadError(null);
    try {
      await downloadAndroidZipInBrowser();
      setDownloadDone('android');
      setTimeout(() => setDownloadDone(null), 4000);
    } catch (e: any) {
      setDownloadError(e?.message || 'Không thể tải file zip. Vui lòng thử lại sau.');
    } finally {
      setDownloadingAndroid(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-left">
        {/* Close button */}
        <button
          onClick={() => setIsOpen(false)}
          aria-label="Đóng"
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500/20 to-pink-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">
              Xuất Bản Web & Code APK
            </h3>
            <p className="text-xs text-slate-400">
              Chọn định dạng bạn muốn tải về máy
            </p>
          </div>
        </div>

        {/* 2 Tabs: Web & Android only */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-2xl border border-slate-800 mb-5">
          <button
            type="button"
            onClick={() => setActiveTab('web')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'web'
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>1. Xuất Bản Web (.zip)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('android')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'android'
                ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>2. Xuất Code Android APK (.zip)</span>
          </button>
        </div>

        {downloadError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
            {downloadError}
          </div>
        )}

        {/* TAB 1: WEB BUILD */}
        {activeTab === 'web' && (
          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white flex items-center gap-2">
                  <Globe className="w-4 h-4 text-indigo-400" />
                  <span>Gói Web Đã Build Sẵn (HTML, CSS, JS)</span>
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono font-semibold">
                  ~6.6 MB
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                File nén <code className="text-indigo-300 font-mono">seraph-web-dist.zip</code> chứa toàn bộ mã nguồn web hoàn chỉnh đã được build sẵn (index.html, assets, thư viện bóc tách offline).
              </p>

              <button
                type="button"
                onClick={handleDownloadWeb}
                disabled={downloadingWeb}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:to-pink-600 text-white font-bold text-xs shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all transform active:scale-[0.98] cursor-pointer"
              >
                {downloadingWeb ? (
                  <span>Đang tải file zip về máy...</span>
                ) : downloadDone === 'web' ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>Đã tải thành công seraph-web-dist.zip! (Bấm để tải lại)</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>TẢI GÓI WEB ĐÃ BUILD (seraph-web-dist.zip)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: ANDROID STUDIO BUILD */}
        {activeTab === 'android' && (
          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  <span>Dự án Android Studio (Đầy đủ Gradle)</span>
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-semibold">
                  ~0.7 MB
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                File nén <code className="text-emerald-400 font-mono">seraph-android-project.zip</code> chứa đầy đủ build.gradle, settings.gradle, AndroidX, icon và mã nguồn để mở trong Android Studio và build file APK.
              </p>

              <button
                type="button"
                onClick={handleDownloadAndroid}
                disabled={downloadingAndroid}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold text-xs shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all transform active:scale-[0.98] cursor-pointer"
              >
                {downloadingAndroid ? (
                  <span>Đang tải file zip về máy...</span>
                ) : downloadDone === 'android' ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-200" />
                    <span>Đã tải thành công seraph-android-project.zip! (Bấm để tải lại)</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>TẢI GÓI CODE ANDROID STUDIO (.ZIP)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        <div className="mt-5 text-center">
          <button
            onClick={() => setIsOpen(false)}
            className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
          >
            Đóng cửa sổ này
          </button>
        </div>
      </div>
    </div>
  );
};
