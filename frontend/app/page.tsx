import KeyCard from '../components/KeyCard';
import { ShieldCheck, Download, Users } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0A0A0B] text-slate-200 flex flex-col items-center justify-center p-6">
      <div className="absolute top-0 w-full h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent opacity-50"></div>

      <div className="max-w-md w-full space-y-8 z-10">
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center border border-indigo-500/20 shadow-[0_0_30px_rgba(99,102,241,0.15)] backdrop-blur-sm">
            <ShieldCheck className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">VPN Dashboard</h1>
          <p className="text-sm text-slate-400">Secure connection via Xray Reality.</p>
        </div>

        <KeyCard />

        <div className="flex gap-3">
          <a
            href="/api/logs/download"
            download="server-logs.txt"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-300 hover:bg-slate-700/50 hover:text-white transition-all duration-200 text-sm"
          >
            <Download className="w-4 h-4" />
            Logs
          </a>
          <a
            href="/api/users"
            target="_blank"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-300 hover:bg-slate-700/50 hover:text-white transition-all duration-200 text-sm"
          >
            <Users className="w-4 h-4" />
            Users
          </a>
        </div>
      </div>
    </main>
  );
}
