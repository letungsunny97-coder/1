import React from 'react';
import { Sparkles, History, Layers, ShieldCheck, Zap, Download } from 'lucide-react';

interface HeaderProps {
  activeTab: 'single' | 'batch' | 'history';
  setActiveTab: (tab: 'single' | 'batch' | 'history') => void;
  historyCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  historyCount,
}) => {
  return (
    <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 h-16 sm:h-18 flex items-center justify-between gap-2">
        {/* Brand / Logo */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <div className="relative group cursor-pointer" onClick={() => setActiveTab('single')}>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 p-0.5 shadow-lg shadow-indigo-500/20 group-hover:shadow-indigo-500/40 transition-all">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400 group-hover:scale-110 transition-transform" />
              </div>
            </div>
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-emerald-500 rounded-full border-2 border-slate-950 animate-pulse" />
          </div>

          <div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-extrabold text-lg sm:text-2xl tracking-tight bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
                Seraph
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-wide uppercase px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Sparkles className="w-2.5 h-2.5" /> No Logo
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden md:block">
              Tải video không logo siêu tốc
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 flex-shrink-0">
          <button
            onClick={() => setActiveTab('single')}
            aria-label="Tải video đơn"
            className={`flex items-center gap-1 sm:gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'single'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Tải nhanh</span>
          </button>

          <button
            onClick={() => setActiveTab('batch')}
            aria-label="Tải hàng loạt link"
            className={`hidden sm:flex items-center gap-1 sm:gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'batch'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Hàng loạt</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            aria-label="Lịch sử tải về"
            className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all relative ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Lịch sử</span>
            {historyCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-pink-500 text-[10px] text-white flex items-center justify-center font-bold">
                {historyCount > 9 ? '9+' : historyCount}
              </span>
            )}
          </button>
        </nav>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Server Settings button */}
          <button
            type="button"
            onClick={() => {
              const ev = new CustomEvent('open-server-settings-modal');
              window.dispatchEvent(ev);
            }}
            title="Cài đặt địa chỉ máy chủ API"
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="hidden sm:inline">Máy chủ API</span>
          </button>

          {/* Action Button: Export Web & APK */}
          <button
            type="button"
            onClick={() => {
              const ev = new CustomEvent('open-apk-build-modal');
              window.dispatchEvent(ev);
            }}
            title="Xuất bản Build Web hoặc Code Android APK"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:to-pink-600 text-white text-xs font-bold shadow-md shadow-indigo-500/25 transition-all transform active:scale-95 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất Web & APK</span>
          </button>
        </div>

        {/* Status badges */}
        <div className="hidden lg:flex items-center gap-2 text-xs font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-3 py-1.5 rounded-full">
          <ShieldCheck className="w-4 h-4" />
          <span>Sẵn sàng • Tốc độ tối đa</span>
        </div>
      </div>
    </header>
  );
};
