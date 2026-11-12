import React from 'react';
import { PlatformId } from '../types/downloader.ts';
import { PLATFORMS } from '../utils/detector.ts';
import { CheckCircle2 } from 'lucide-react';

interface PlatformBadgesProps {
  selectedPlatform?: PlatformId;
  onSelectSample?: (platformId: PlatformId) => void;
}

export const PlatformBadges: React.FC<PlatformBadgesProps> = ({
  selectedPlatform,
  onSelectSample,
}) => {
  const platformsList = Object.values(PLATFORMS).filter((p) => p.id !== 'unknown');

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <span>8 Nền tảng được hỗ trợ chất lượng cao</span>
        </span>
        <span className="text-xs text-indigo-400 font-medium">Bấm để thử link mẫu ⚡</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        {platformsList.map((platform) => {
          const isSelected = selectedPlatform === platform.id;
          return (
            <button
              key={platform.id}
              onClick={() => onSelectSample && onSelectSample(platform.id)}
              className={`group text-left p-2.5 rounded-xl border transition-all duration-200 relative overflow-hidden ${
                isSelected
                  ? 'bg-slate-900 border-indigo-500 shadow-md shadow-indigo-500/10 ring-1 ring-indigo-500/30'
                  : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-850 hover:border-slate-700'
              }`}
              title={`Nhấp để thử link mẫu ${platform.name}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-200 group-hover:text-white flex items-center gap-1">
                  {platform.shortName}
                </span>
                {isSelected ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
                ) : (
                  <span className="text-[10px] text-slate-500 group-hover:text-indigo-400 transition-colors">
                    Thử ↗
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span className="truncate">{platform.maxQuality}</span>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
              </div>

              {/* Bottom decorative color bar */}
              <div
                className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r ${platform.gradient} opacity-75`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
};
