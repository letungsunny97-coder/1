import React from 'react';
import {
  ShieldCheck,
  Zap,
  Sparkles,
  CheckCircle,
  HelpCircle,
  Film,
  Music,
  Download,
} from 'lucide-react';
import { PLATFORMS } from '../utils/detector.ts';

export const PlatformFeatures: React.FC = () => {
  return (
    <div className="w-full space-y-8 mt-12 pt-8 border-t border-slate-800/80">
      {/* 3 Core Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-all">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-3 border border-indigo-500/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white mb-1">
            Không Logo & Watermark Gốc
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Thuật toán bóc tách trực tiếp luồng video từ CDN nguồn, tự động loại bỏ watermark chuyển động và logo góc của Douyin & TikTok.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-all">
          <div className="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-400 flex items-center justify-center mb-3 border border-pink-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white mb-1">
            Chất Lượng Tối Đa (4K / 1080p 60fps)
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Giữ nguyên độ sắc nét cao nhất của video gốc, âm thanh MP3 320kbps nguyên bản, không bị nén mờ hay giảm bitrate.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-all">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-3 border border-cyan-500/20">
            <Zap className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white mb-1">
            Tự Động Nhận Diện & Tải Siêu Tốc
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Chỉ cần dán văn bản sao chép bất kỳ, hệ thống tự động lọc ra URL chuẩn, nhận diện nền tảng và trả về link tải trong vòng 1 giây.
          </p>
        </div>
      </div>

      {/* Guide: How to copy link on mobile */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/50 to-slate-950 border border-slate-800">
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-indigo-400" />
          <span>Hướng dẫn lấy liên kết video trên điện thoại & máy tính</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
            <div className="font-bold text-pink-400 mb-1 flex items-center gap-1.5">
              <span>Douyin (抖音) & TikTok</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Bấm biểu tượng <strong>Chia sẻ (Mũi tên cong)</strong> &rarr; chọn <strong>Sao chép liên kết</strong>. Bạn có thể dán toàn bộ đoạn văn bản tiếng Trung hoặc tiếng Việt vào ô tải, app sẽ tự lọc link!
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
            <div className="font-bold text-blue-400 mb-1 flex items-center gap-1.5">
              <span>Facebook & Instagram</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Mở video hoặc Reel &rarr; bấm biểu tượng <strong>Ba chấm (...)</strong> hoặc <strong>Chia sẻ</strong> &rarr; chọn <strong>Sao chép liên kết (Copy Link)</strong> rồi dán vào Seraph.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
            <div className="font-bold text-sky-400 mb-1 flex items-center gap-1.5">
              <span>X (Twitter) & Bilibili</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Tại bài đăng X hoặc video Bilibili, chọn nút <strong>Share / 分享</strong> &rarr; <strong>Copy Link</strong> (hỗ trợ cả link rút gọn như b23.tv và x.com).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
