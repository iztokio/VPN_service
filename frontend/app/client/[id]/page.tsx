'use client';
import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  ShieldCheck, Copy, Check, Clock, Globe, ShieldAlert,
  Smartphone, Download, Wifi, CreditCard,
  ChevronRight, Star
} from 'lucide-react';

interface ClientConfig {
  uuid: string;
  status: string;
  expires_at: string;
  vless_tcp: string;
  vless_grpc: string;
}

// ── Clipboard helper: works on HTTP AND HTTPS ──────────────────────────────
function copyText(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve, reject) => {
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.setAttribute('readonly', '');
      el.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;pointer-events:none';
      document.body.appendChild(el);
      el.focus();
      el.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(el);
      ok ? resolve() : reject(new Error('execCommand failed'));
    } catch (e) {
      reject(e);
    }
  });
}

const STEPS = [
  {
    n: '1',
    icon: Smartphone,
    title: 'Установите приложение',
    desc: 'Скачайте v2rayNG (Android) или Streisand (iOS/Mac) из официального магазина приложений.',
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/20',
  },
  {
    n: '2',
    icon: Download,
    title: 'Импортируйте конфиг',
    desc: 'Нажмите «Copy VPN Link» ниже, затем откройте приложение → «+» → «Вставить из буфера». ИЛИ — просто отсканируйте QR-код камерой приложения.',
    color: 'text-fuchsia-400',
    bg: 'bg-fuchsia-500/10',
    border: 'border-fuchsia-500/20',
  },
  {
    n: '3',
    icon: Wifi,
    title: 'Подключитесь',
    desc: 'Нажмите Connect/Подключить в приложении. Если находитесь в России — используйте «Stealth Network» (рекомендован). Интернет заработал — готово!',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  {
    n: '4',
    icon: CreditCard,
    title: 'Продлите подписку',
    desc: 'За 5 дней до окончания — нажмите кнопку «Продлить подписку» ниже. Оплата через Telegram — быстро и анонимно.',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
];

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
      .then((data) => { setConfig(data); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [params.id]);

  const handleCopy = async (str: string, type: string) => {
    try {
      await copyText(str);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2500);
    } catch {
      // Final fallback: show in prompt so user can copy manually
      window.prompt('Скопируйте ссылку вручную (Ctrl+C / Cmd+C):', str);
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Error / Not Found ─────────────────────────────────────────────────────
  if (error || !config) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] text-slate-200 flex flex-col items-center justify-center p-6">
        <div className="bg-red-500/10 border border-red-500/20 p-10 rounded-3xl max-w-sm text-center shadow-2xl">
          <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Доступ закрыт</h2>
          <p className="text-slate-400 text-sm">Недействительная или истёкшая ссылка. Обратитесь к администратору.</p>
        </div>
      </div>
    );
  }

  const daysLeft = Math.ceil((new Date(config.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const isExpiring = daysLeft <= 5;
  const isExpired = daysLeft <= 0;

  return (
    <main className="min-h-screen bg-[#0A0A0B] text-slate-200 selection:bg-indigo-500/30">
      {/* Gradient top bar */}
      <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-indigo-500" />

      <div className="flex flex-col items-center py-10 px-4">
        <div className="w-full max-w-md space-y-5">

          {/* ── Header ─────────────────────────────────────────────────────── */}
          <div className="text-center space-y-2 mb-4">
            <div className="mx-auto w-14 h-14 bg-gradient-to-br from-indigo-500/20 to-fuchsia-500/20 rounded-2xl flex items-center justify-center border border-indigo-500/30 shadow-[0_0_30px_rgba(99,102,241,0.25)] mb-3">
              <ShieldCheck className="w-7 h-7 text-indigo-400" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Доступ к VPN</h1>
            <p className="text-slate-500 text-sm">Ваш персональный ключ подключения</p>
          </div>

          {/* ── Subscription Card ──────────────────────────────────────────── */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-full h-1 rounded-t-3xl ${isExpired ? 'bg-red-500' : isExpiring ? 'bg-gradient-to-r from-rose-500 to-orange-400' : 'bg-gradient-to-r from-emerald-400 to-teal-500'}`} />
            
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-slate-300 font-semibold flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-slate-500" />
                Подписка
              </h3>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                isExpired ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                : isExpiring ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}>
                {isExpired ? 'Истекла' : `${daysLeft} дн. осталось`}
              </span>
            </div>

            <p className="text-sm text-slate-400 mb-5">
              Действительна до:{' '}
              <span className="text-white font-medium">
                {new Date(config.expires_at).toLocaleDateString('ru-RU')}
              </span>
            </p>

            {/* Renew Button — links to Telegram bot */}
            <a
              href="https://t.me/IzVPN_bot?start=renew"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold transition-all active:scale-95 bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:from-indigo-500 hover:to-fuchsia-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)]"
            >
              <Star className="w-4 h-4" />
              Продлить подписку
            </a>
          </div>

          {/* ── Stealth Network (Recommended) ──────────────────────────────── */}
          <div className="bg-[#0f0f12] border border-indigo-500/20 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Globe className="w-5 h-5 text-indigo-400" />
                Stealth Network
              </h3>
              <span className="bg-indigo-500/15 text-indigo-300 text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border border-indigo-500/30 tracking-wider">
                Рекомендован
              </span>
            </div>

            {/* QR Code */}
            <div className="bg-white p-3 rounded-2xl mx-auto w-max shadow-xl mb-5">
              <QRCodeSVG value={config.vless_grpc} size={168} level="M" />
            </div>

            {/* Copied feedback bar */}
            {copiedType === 'grpc' && (
              <div className="mb-3 py-2 px-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center text-emerald-400 text-sm font-medium animate-pulse">
                ✓ Ссылка скопирована! Вставьте в v2rayNG / Streisand
              </div>
            )}

            <button
              type="button"
              onClick={() => handleCopy(config.vless_grpc, 'grpc')}
              className="group w-full relative flex items-center justify-center gap-2.5 overflow-hidden rounded-xl bg-indigo-600 px-4 py-3.5 text-white font-semibold transition-all hover:bg-indigo-500 active:scale-95 select-none"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
              {copiedType === 'grpc'
                ? <Check className="w-5 h-5 text-emerald-300 flex-shrink-0" />
                : <Copy className="w-5 h-5 flex-shrink-0" />
              }
              {copiedType === 'grpc' ? 'Скопировано!' : 'Скопировать VPN ссылку (Stealth)'}
            </button>
          </div>

          {/* ── Standard Network ───────────────────────────────────────────── */}
          <div className="bg-slate-900/50 border border-slate-800/60 rounded-3xl p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-1">Стандартная сеть</h3>
            <p className="text-xs text-slate-600 mb-4">
              Используйте, если Stealth работает медленно вне РФ/Китая.
            </p>

            {copiedType === 'tcp' && (
              <div className="mb-3 py-2 px-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center text-emerald-400 text-xs font-medium">
                ✓ Ссылка скопирована!
              </div>
            )}

            <button
              type="button"
              onClick={() => handleCopy(config.vless_tcp, 'tcp')}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 rounded-xl text-slate-300 hover:text-white transition-all active:scale-95 select-none"
            >
              {copiedType === 'tcp'
                ? <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                : <Copy className="w-4 h-4 flex-shrink-0" />
              }
              <span className="text-sm">{copiedType === 'tcp' ? 'Скопировано!' : 'Скопировать стандартную ссылку'}</span>
            </button>
          </div>

          {/* ── How to Connect Guide ───────────────────────────────────────── */}
          <div className="bg-slate-900/40 border border-slate-800/40 rounded-3xl p-6">
            <h2 className="text-base font-bold text-white mb-5">Как подключиться?</h2>
            <div className="space-y-4">
              {STEPS.map((step) => {
                const Icon = step.icon;
                return (
                  <div key={step.n} className={`flex gap-4 p-4 rounded-2xl border ${step.bg} ${step.border} transition-all hover:brightness-110`}>
                    <div className={`flex-shrink-0 w-9 h-9 rounded-xl ${step.bg} border ${step.border} flex items-center justify-center`}>
                      <Icon className={`w-4.5 h-4.5 ${step.color}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold ${step.color} uppercase tracking-widest`}>Шаг {step.n}</span>
                      </div>
                      <p className="text-sm font-semibold text-white mb-1">{step.title}</p>
                      <p className="text-xs text-slate-400 leading-relaxed">{step.desc}</p>
                    </div>
                    <ChevronRight className={`flex-shrink-0 w-4 h-4 ${step.color} opacity-40 mt-1`} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Download Apps ──────────────────────────────────────────────── */}
          <div className="bg-slate-900/40 border border-slate-800/40 rounded-3xl p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Скачать приложение</h3>
            <div className="grid grid-cols-2 gap-2.5">
              <a
                href="https://play.google.com/store/apps/details?id=com.v2ray.ang"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 p-3 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 hover:border-slate-600 transition-all active:scale-95"
              >
                <span className="text-xl">🤖</span>
                <div>
                  <p className="text-xs font-semibold text-white">v2rayNG</p>
                  <p className="text-[10px] text-slate-500">Android</p>
                </div>
              </a>
              <a
                href="https://apps.apple.com/app/streisand/id6450534064"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 p-3 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 hover:border-slate-600 transition-all active:scale-95"
              >
                <span className="text-xl">🍎</span>
                <div>
                  <p className="text-xs font-semibold text-white">Streisand</p>
                  <p className="text-[10px] text-slate-500">iOS / Mac</p>
                </div>
              </a>
            </div>
          </div>

          {/* ── Footer ─────────────────────────────────────────────────────── */}
          <p className="text-center text-xs text-slate-700 pb-4">
            Если возникли проблемы — напишите нам в{' '}
            <a href="https://t.me/IzVPN_support" className="text-indigo-500 hover:text-indigo-400">Telegram</a>
          </p>

        </div>
      </div>
    </main>
  );
}
