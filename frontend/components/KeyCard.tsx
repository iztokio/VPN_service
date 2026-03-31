'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { KeyRound, Copy, Check, Loader2 } from 'lucide-react';

export default function KeyCard({ token }: { token: string }) {
  const [vlessUrl, setVlessUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const generateKey = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ tg_id: 0 }),
      });
      if (!res.ok) throw new Error('API server returned an error.');
      const data = await res.json();
      setVlessUrl(data.vless_url);
    } catch (err) {
      setError('Failed. Check console.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!vlessUrl) return;
    try {
      const el = document.createElement('textarea');
      el.value = vlessUrl;
      el.style.position = 'fixed';
      el.style.left = '-9999px';
      el.style.top = '-9999px';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.focus();
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    } catch (e) {
      console.error('Copy failed:', e);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-[#121214] border border-white/5 rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl transition-opacity group-hover:bg-indigo-500/20"></div>

      {!vlessUrl ? (
        <div className="flex flex-col items-center justify-center py-8 space-y-6 relative z-10 animate-in fade-in duration-500">
          <button
            onClick={generateKey}
            disabled={isLoading}
            className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white px-6 py-4 rounded-xl font-medium transition-all shadow-[0_0_20px_rgba(99,102,241,0.2)]"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <KeyRound className="w-5 h-5" />
                <span>Issue New Key</span>
              </>
            )}
          </button>
          {error && <p className="text-red-400 text-sm font-medium">{error}</p>}
        </div>
      ) : (
        <div className="flex flex-col items-center space-y-6 relative z-10 animate-in zoom-in-95 duration-300">
          <div className="bg-white p-4 rounded-2xl shadow-lg ring-1 ring-white/10">
            <QRCodeSVG value={vlessUrl} size={200} level="M" includeMargin={false} />
          </div>

          <div className="w-full space-y-3">
            <div className="bg-black/40 border border-white/5 rounded-xl p-3 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-mono truncate mr-4 selection:bg-indigo-500/30">
                {vlessUrl.slice(0, 32)}...
              </span>
              <button
                onClick={copyToClipboard}
                className="flex-shrink-0 bg-white/5 hover:bg-white/10 p-2 rounded-lg transition-colors group/btn"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4 text-slate-300 group-hover/btn:text-white" />
                )}
              </button>
            </div>
          </div>

          <button
            onClick={() => setVlessUrl(null)}
            className="w-full text-sm text-slate-500 hover:text-slate-300 transition-colors py-2 font-medium"
          >
            Generate another
          </button>
        </div>
      )}
    </div>
  );
}
