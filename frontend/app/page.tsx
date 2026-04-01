'use client';
import { useState, useEffect, useCallback } from 'react';
import KeyCard from '../components/KeyCard';
import UserList from '../components/UserList';
import {
  ShieldCheck, Download, Lock, Users, Activity,
  TrendingUp, TrendingDown, Server, LogOut, RefreshCw
} from 'lucide-react';

interface Stats {
  total_users: number;
  active_users: number;
  total_uplink_bytes: number;
  total_downlink_bytes: number;
  user_traffic: Array<{ email: string; uplink_bytes: number; downlink_bytes: number; }>;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function Home() {
  const [token, setToken] = useState('');
  const [isAuth, setIsAuth] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [nodeOnline, setNodeOnline] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchStats = useCallback(async (t: string) => {
    setStatsLoading(true);
    try {
      const res = await fetch('/api/stats', {
        headers: { Authorization: `Bearer ${t}` }
      });
      if (res.ok) {
        const data: Stats = await res.json();
        setStats(data);
      }
      // Also check health
      const health = await fetch('/api/health');
      setNodeOnline(health.ok);
    } catch {
      setNodeOnline(false);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('adminToken');
    if (saved) {
      setToken(saved);
      setIsAuth(true);
      fetchStats(saved);
    }
  }, [fetchStats]);

  // Auto-refresh stats every 30s
  useEffect(() => {
    if (!isAuth || !token) return;
    const interval = setInterval(() => fetchStats(token), 30000);
    return () => clearInterval(interval);
  }, [isAuth, token, fetchStats]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (token.trim()) {
      localStorage.setItem('adminToken', token);
      setIsAuth(true);
      fetchStats(token);
    }
  };

  const handleDownloadLogs = async () => {
    try {
      const res = await fetch('/api/logs/download', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) { alert('Failed to download logs (Unauthorized or not found)'); return; }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'server-logs.txt';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch { alert('Error downloading logs'); }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setIsAuth(false);
    setToken('');
    setStats(null);
  };

  const handleRefresh = () => {
    fetchStats(token);
    setRefreshKey(k => k + 1);
  };

  // ─── Login Screen ───────────────────────────────────────────────────────────
  if (!isAuth) {
    return (
      <main className="min-h-screen bg-[#0A0A0B] text-slate-200 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Background glow orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

        <form onSubmit={handleLogin} className="relative max-w-sm w-full space-y-5 bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-8 rounded-2xl shadow-2xl">
          <div className="flex flex-col items-center gap-3 mb-2">
            <div className="w-14 h-14 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center border border-indigo-500/30 shadow-[0_0_30px_rgba(99,102,241,0.2)]">
              <Lock className="w-7 h-7 text-indigo-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Admin Authentication</h2>
            <p className="text-xs text-slate-500">IzVPN Control Panel</p>
          </div>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Enter ADMIN_TOKEN"
            className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
          />
          <button type="submit" className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] active:scale-95">
            Login
          </button>
        </form>
      </main>
    );
  }

  // ─── Dashboard ──────────────────────────────────────────────────────────────
  const totalBandwidth = (stats?.total_uplink_bytes ?? 0) + (stats?.total_downlink_bytes ?? 0);

  return (
    <main className="min-h-screen bg-[#0A0A0B] text-slate-200 pb-16 relative">
      {/* Subtle grid background */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />

      {/* Top navigation bar */}
      <div className="sticky top-0 z-50 border-b border-slate-800/60 bg-[#0A0A0B]/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
            <span className="font-bold text-white text-sm tracking-tight">IzVPN</span>
            <span className="text-slate-600 text-xs font-mono">Control Panel</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${nodeOnline ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'bg-red-500'} animate-pulse`} />
              <span className="text-xs text-slate-400">{nodeOnline ? 'Node Online' : 'Node Offline'}</span>
            </div>
            <button onClick={handleRefresh} disabled={statsLoading} className="p-1.5 text-slate-500 hover:text-indigo-400 transition-colors rounded-lg hover:bg-slate-800">
              <RefreshCw className={`w-4 h-4 ${statsLoading ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
            <button onClick={handleLogout} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-500 hover:text-rose-400 transition-colors rounded-lg hover:bg-rose-500/5">
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 pt-8 space-y-8">

        {/* ── Stats Cards Row ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Users */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-indigo-500/30 hover:bg-slate-900/80 transition-all">
            <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-colors" />
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">Total Users</span>
              <div className="w-8 h-8 bg-indigo-500/10 rounded-lg flex items-center justify-center">
                <Users className="w-4 h-4 text-indigo-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-white">{stats?.total_users ?? '—'}</p>
            <p className="text-xs text-slate-500 mt-1">{stats?.active_users ?? 0} active now</p>
          </div>

          {/* Total Bandwidth */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-fuchsia-500/30 hover:bg-slate-900/80 transition-all">
            <div className="absolute top-0 right-0 w-20 h-20 bg-fuchsia-500/5 rounded-full blur-2xl group-hover:bg-fuchsia-500/10 transition-colors" />
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">Bandwidth</span>
              <div className="w-8 h-8 bg-fuchsia-500/10 rounded-lg flex items-center justify-center">
                <Activity className="w-4 h-4 text-fuchsia-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-white">{formatBytes(totalBandwidth)}</p>
            <p className="text-xs text-slate-500 mt-1">Total transferred</p>
          </div>

          {/* Uplink */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-emerald-500/30 hover:bg-slate-900/80 transition-all">
            <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors" />
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">Upload ↑</span>
              <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-white">{formatBytes(stats?.total_uplink_bytes ?? 0)}</p>
            <p className="text-xs text-slate-500 mt-1">Node uplink</p>
          </div>

          {/* Downlink */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-sky-500/30 hover:bg-slate-900/80 transition-all">
            <div className="absolute top-0 right-0 w-20 h-20 bg-sky-500/5 rounded-full blur-2xl group-hover:bg-sky-500/10 transition-colors" />
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">Download ↓</span>
              <div className="w-8 h-8 bg-sky-500/10 rounded-lg flex items-center justify-center">
                <TrendingDown className="w-4 h-4 text-sky-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-white">{formatBytes(stats?.total_downlink_bytes ?? 0)}</p>
            <p className="text-xs text-slate-500 mt-1">Node downlink</p>
          </div>
        </div>

        {/* ── Main Grid ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Left: Key Generation */}
          <div>
            <div className="flex items-center gap-2 mb-4 px-1">
              <Server className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-semibold text-slate-300">Issue Key</span>
            </div>
            <KeyCard token={token} />
            <div className="mt-3">
              <button
                onClick={handleDownloadLogs}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900/60 border border-slate-800 rounded-xl text-slate-400 hover:bg-slate-800/60 hover:text-white transition-all text-sm"
              >
                <Download className="w-4 h-4" />
                Download Server Logs
              </button>
            </div>
          </div>

          {/* Right: User List with traffic stats */}
          <div>
            <div className="flex items-center gap-2 mb-4 px-1">
              <Users className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-semibold text-slate-300">Active Users</span>
            </div>
            <UserList token={token} trafficStats={stats?.user_traffic ?? []} refreshKey={refreshKey} />
          </div>
        </div>

      </div>
    </main>
  );
}
