import React, { useState, useEffect } from 'react';
import { Server, Check, X, RefreshCw, Globe, AlertCircle } from 'lucide-react';
import { getServerHost, setServerHost, DEFAULT_CLOUD_HOST, getApiEndpoint } from '../utils/apiConfig.ts';

export const ServerSettingsModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    const handleOpen = () => {
      const current = getServerHost();
      setServerUrl(current || DEFAULT_CLOUD_HOST);
      setTestResult(null);
      setIsOpen(true);
    };

    window.addEventListener('open-server-settings-modal', handleOpen);
    return () => window.removeEventListener('open-server-settings-modal', handleOpen);
  }, []);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const target = serverUrl.trim().replace(/\/+$/, '');
      const healthUrl = `${target}/api/health`;
      const res = await fetch(healthUrl, { mode: 'cors' });
      if (res.ok) {
        setTestResult({ ok: true, message: 'Kết nối máy chủ API thành công!' });
      } else {
        setTestResult({ ok: false, message: `Máy chủ phản hồi mã lỗi: ${res.status}` });
      }
    } catch (err: any) {
      setTestResult({
        ok: false,
        message: 'Không thể kết nối. Kiểm tra lại đường dẫn máy chủ hoặc kết nối mạng.',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    setServerHost(serverUrl);
    setIsOpen(false);
  };

  const handleReset = () => {
    setServerUrl(DEFAULT_CLOUD_HOST);
    setServerHost(DEFAULT_CLOUD_HOST);
    setTestResult(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl text-left">
        <button
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Cấu hình Máy Chủ API</h3>
            <p className="text-xs text-slate-400">Dành cho bản Android APK hoặc tự host backend</p>
          </div>
        </div>

        <div className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Địa chỉ Máy Chủ API (Server Host):
            </label>
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://your-server-domain.run.app"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Bản Android APK sẽ gọi API trích xuất video trực tiếp về địa chỉ này.
            </p>
          </div>

          {testResult && (
            <div
              className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                testResult.ok
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
              }`}
            >
              {testResult.ok ? (
                <Check className="w-4 h-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              )}
              <span className="text-xs">{testResult.message}</span>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing}
              className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
              <span>{testing ? 'Đang thử...' : 'Kiểm tra kết nối'}</span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="py-2 px-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            >
              Mặc định
            </button>
          </div>

          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3.5 py-1.5 rounded-xl text-slate-400 hover:text-white"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-md shadow-indigo-600/30"
            >
              Lưu cấu hình
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
