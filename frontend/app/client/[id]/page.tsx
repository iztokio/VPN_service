'use client';
import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ShieldCheck, Copy, Check, Clock, Globe, ShieldAlert } from 'lucide-react';

interface ClientConfig {
  uuid: string;
  status: string;
  expires_at: string;
  vless_tcp: string;
  vless_grpc: string;
}

export default function ClientPage({ params }: { params: { id: string } }) {
  const [config, setConfig] = useState<ClientConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`/api/client/${params.id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then((data) => {
        setConfig(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [params.id]);

  const copyStr = (str: string, type: string) => {
    navigator.clipboard.writeText(str);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] text-slate-200 flex flex-col items-center justify-center p-6">
        <div className="bg-red-500/10 border border-red-500/20 p-8 rounded-2xl max-w-sm text-center">
          <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-slate-400">Invalid or expired connection link.</p>
        </div>
      </div>
    );
  }

  const daysLeft = Math.ceil((new Date(config.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const isExpiring = daysLeft < 5;

  return (
    <main className="min-h-screen bg-[#0A0A0B] text-slate-200 flex flex-col items-center py-12 px-4 selection:bg-indigo-500/30">
      <div className="w-full max-w-md space-y-6">
        
        {/* Header Ribbon */}
        <div className="text-center space-y-2 mb-8">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-indigo-500/20 to-fuchsia-500/20 rounded-2xl flex items-center justify-center border border-indigo-500/30 shadow-[0_0_30px_rgba(99,102,241,0.2)] mb-4">
            <ShieldCheck className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Your VPN Access</h1>
          <p className="text-slate-400 text-sm">Scan or copy to connect immediately.</p>
        </div>

        {/* Subscription Status Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
          <div className={`absolute top-0 left-0 w-full h-1 ${isExpiring ? "bg-gradient-to-r from-rose-500 to-orange-500" : "bg-gradient-to-r from-emerald-400 to-teal-500"}`}></div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-300 font-medium flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400"/>
              Subscription
            </h3>
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${isExpiring ? "bg-rose-500/10 text-rose-400" : "bg-emerald-500/10 text-emerald-400"}`}>
              {daysLeft > 0 ? `${daysLeft} days left` : "Expired"}
            </span>
          </div>
          <div className="text-sm text-slate-400">
            Valid until: <span className="text-slate-200">{new Date(config.expires_at).toLocaleDateString()}</span>
          </div>
          <button className="mt-5 w-full bg-slate-800 hover:bg-slate-700 text-indigo-400 font-medium py-2.5 rounded-xl border border-slate-700 transition">
            Renew Subscription
          </button>
        </div>

        {/* Primary Connection Form (gRPC/RU bypass optimized) */}
        <div className="bg-gradient-to-b from-[#121214] to-[#0A0A0B] border border-white/5 rounded-3xl p-6 shadow-2xl relative">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Globe className="w-5 h-5 text-indigo-400" />
              Stealth Network
            </h3>
            <span className="bg-indigo-500/20 text-indigo-300 text-[10px] uppercase font-bold px-2 py-0.5 rounded border border-indigo-500/20">Recommended</span>
          </div>
          
          <div className="bg-white p-3 rounded-2xl mx-auto w-max shadow-lg mb-6">
             <QRCodeSVG value={config.vless_grpc} size={160} />
          </div>

          <button 
            onClick={() => copyStr(config.vless_grpc, 'grpc')}
            className="group w-full relative flex items-center justify-center gap-2 overflow-hidden rounded-xl bg-indigo-600 px-4 py-3.5 text-white font-semibold transition hover:bg-indigo-500 active:scale-95"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
            {copiedType === 'grpc' ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            {copiedType === 'grpc' ? 'Copied Link!' : 'Copy VPN Link (Stealth)'}
          </button>
        </div>

        {/* Standard Connection */}
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-3xl p-5 shadow-lg">
           <h3 className="text-sm font-semibold text-slate-300 mb-1">Standard Network</h3>
           <p className="text-xs text-slate-500 mb-4">Use this only if Stealth connection is slow outside restricted regions.</p>
           
           <button 
            onClick={() => copyStr(config.vless_tcp, 'tcp')}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-300 hover:bg-slate-700 transition"
          >
            {copiedType === 'tcp' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span className="text-sm">{copiedType === 'tcp' ? 'Copied!' : 'Copy Standard Link'}</span>
          </button>
        </div>

      </div>
    </main>
  );
}
