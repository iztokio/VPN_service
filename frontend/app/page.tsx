'use client';
import { useState, useEffect } from 'react';
import KeyCard from '../components/KeyCard';
import UserList from '../components/UserList';
import { ShieldCheck, Download, Lock } from 'lucide-react';

export default function Home() {
  const [token, setToken] = useState('');
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('adminToken');
    if (saved) {
      setToken(saved);
      setIsAuth(true); // Assuming valid for now
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (token.trim()) {
      localStorage.setItem('adminToken', token);
      setIsAuth(true);
    }
  };

  const handleDownloadLogs = async () => {
    try {
      const res = await fetch('/api/logs/download', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        alert('Failed to download logs (Unauthorized or not found)');
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'server-logs.txt';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert('Error downloading logs');
    }
  };

  if (!isAuth) {
    return (
      <main className="min-h-screen bg-[#0A0A0B] text-slate-200 flex flex-col items-center justify-center p-6">
        <form onSubmit={handleLogin} className="max-w-sm w-full space-y-6 bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl">
          <div className="flex justify-center mb-4">
            <Lock className="w-12 h-12 text-indigo-500" />
          </div>
          <h2 className="text-xl font-semibold text-center text-white">Admin Authentication</h2>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Enter ADMIN_TOKEN"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-lg transition-colors">
            Login
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0A0A0B] text-slate-200 flex flex-col items-center py-12 px-6">
      <div className="max-w-md w-full space-y-8 z-10">
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center border border-indigo-500/20 shadow-[0_0_30px_rgba(99,102,241,0.15)] backdrop-blur-sm">
            <ShieldCheck className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">VPN Dashboard</h1>
          <p className="text-sm text-slate-400">Secure connection via Xray Reality.</p>
        </div>

        <KeyCard token={token} />

        <div className="flex gap-3">
          <button
            onClick={handleDownloadLogs}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-300 hover:bg-slate-700/50 hover:text-white transition-all duration-200 text-sm"
          >
            <Download className="w-4 h-4" />
            Download Server Logs
          </button>
        </div>

        <UserList token={token} />
        
        <div className="pt-8 flex justify-center">
          <button 
            onClick={() => { localStorage.removeItem('adminToken'); setIsAuth(false); }} 
            className="text-xs text-slate-600 hover:text-slate-400"
          >
            Logout
          </button>
        </div>
      </div>
    </main>
  );
}
