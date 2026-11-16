import React, { useState, useEffect } from 'react';
import { Smartphone, X, Copy, Check, QrCode, Sparkles, ExternalLink } from 'lucide-react';

export const PhoneModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('open-phone-modal', handleOpen);
    return () => window.removeEventListener('open-phone-modal', handleOpen);
  }, []);

  if (!isOpen) return null;

  const currentUrl = window.location.href;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
    currentUrl
  )}&bgcolor=ffffff&color=0f172a&margin=10`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = currentUrl;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {}
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-center">
        {/* Close button */}
        <button
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon */}
        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto mb-3 border border-indigo-500/20">
          <Smartphone className="w-6 h-6" />
        </div>

        <h3 className="text-lg font-bold text-white mb-1">
          Mở Seraph Trên Điện Thoại
        </h3>
        <p className="text-xs text-slate-400 mb-5 leading-relaxed">
          Không cần tải file hay cài đặt phức tạp. Quét mã QR dưới đây bằng camera điện thoại để dùng ngay lập tức!
        </p>

        {/* QR Code Container */}
        <div className="p-3 bg-white rounded-2xl inline-block shadow-xl border-4 border-indigo-500/20 mb-4">
          <img
            src={qrCodeUrl}
            alt="QR Code"
            className="w-48 h-48 sm:w-52 sm:h-52 rounded-xl object-contain"
          />
        </div>

        {/* Copy Link Section */}
        <div className="flex items-center gap-2 p-1.5 bg-slate-950 border border-slate-800 rounded-xl mb-4">
          <input
            type="text"
            readOnly
            value={currentUrl}
            className="flex-1 bg-transparent text-xs text-slate-300 px-2.5 truncate focus:outline-none font-mono"
          />
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1 transition-all"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-300" />
                <span>Đã chép</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        {/* Instructions */}
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-left text-xs text-slate-400 space-y-1.5">
          <div className="flex items-center gap-1.5 font-semibold text-slate-300">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>2 bước để lưu thành App trên màn hình:</span>
          </div>
          <p>
            • <strong>iPhone (Safari)</strong>: Bấm nút Chia sẻ ➔ Chọn <strong>"Thêm vào MH chính"</strong>.
          </p>
          <p>
            • <strong>Android (Chrome)</strong>: Bấm 3 chấm góc trên ➔ Chọn <strong>"Thêm vào màn hình chính"</strong>.
          </p>
        </div>
      </div>
    </div>
  );
};
