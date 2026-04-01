'use client';
import { useState, useEffect } from 'react';
import { Trash2, Calendar, TrendingUp, TrendingDown, Link2 } from 'lucide-react';

interface User {
  id: number;
  uuid: string;
  tg_id: number;
  status: string;
  created_at: string;
  expires_at: string | null;
}

interface TrafficStat {
  email: string;
  uplink_bytes: number;
  downlink_bytes: number;
}

interface Props {
  token: string;
  trafficStats: TrafficStat[];
  refreshKey?: number;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// Works on both HTTP and HTTPS
function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  // Fallback for HTTP (our admin panel runs on HTTP)
  return new Promise((resolve, reject) => {
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.setAttribute('readonly', '');
      el.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0';
      document.body.appendChild(el);
      el.focus();
      el.select();
      const success = document.execCommand('copy');
      document.body.removeChild(el);
      success ? resolve() : reject(new Error('execCommand failed'));
    } catch (e) {
      reject(e);
    }
  });
}

export default function UserList({ token, trafficStats, refreshKey }: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedUuid, setCopiedUuid] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (uuid: string) => {
    if (!confirm('Revoke this key?')) return;
    const res = await fetch(`/api/keys/${uuid}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) fetchUsers();
    else alert('Failed to revoke key');
  };

  const handleRevokeAll = async () => {
    if (!confirm('Delete ALL users? This cannot be undone.')) return;
    const res = await fetch('/api/users', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) fetchUsers();
    else alert('Failed to revoke all keys');
  };

  const handleCopyPortal = async (uuid: string) => {
    const url = `http://${window.location.hostname}:8080/client/${uuid}`;
    try {
      await copyToClipboard(url);
      setCopiedUuid(uuid);
      setTimeout(() => setCopiedUuid(null), 2000);
    } catch {
      // Last resort: prompt dialog
      window.prompt('Copy this link manually (Ctrl+C):', url);
    }
  };

  useEffect(() => {
    if (token) fetchUsers();
  }, [token, refreshKey]);

  const getTrafficForUser = (uuid: string): TrafficStat | null => {
    const email = `user_${uuid.substring(0, 6)}`;
    return trafficStats.find(t => t.email === email) ?? null;
  };

  const daysUntilExpiry = (expiresAt: string | null): number => {
    if (!expiresAt) return 9999;
    return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  };

  if (loading) return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8">
      <div className="flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800/60">
        <span className="text-sm text-slate-300 font-medium">{users.length} users registered</span>
        {users.length > 0 && (
          <button
            onClick={handleRevokeAll}
            className="px-3 py-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white rounded-lg text-xs font-semibold transition-all border border-rose-500/20 hover:border-rose-500"
          >
            Delete All
          </button>
        )}
      </div>

      {users.length === 0 ? (
        <div className="p-8 text-center text-slate-500 text-sm">No users yet</div>
      ) : (
        <div className="max-h-[480px] overflow-y-auto">
          {users.map((u) => {
            const traffic = getTrafficForUser(u.uuid);
            const days = daysUntilExpiry(u.expires_at);
            const isExpiring = days < 5;
            const isCopied = copiedUuid === u.uuid;

            return (
              <div key={u.id} className="p-4 border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors last:border-0">
                <div className="flex items-start justify-between gap-3">
                  {/* User info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-indigo-400">user_{u.uuid.substring(0, 6)}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        isExpiring
                          ? 'bg-rose-500/15 text-rose-400'
                          : 'bg-emerald-500/10 text-emerald-400'
                      }`}>
                        {days > 0 ? `${days}d` : 'Expired'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-500">
                      <Calendar className="w-3 h-3 flex-shrink-0" />
                      <span>Exp: {u.expires_at ? new Date(u.expires_at).toLocaleDateString() : '∞'}</span>
                    </div>

                    {/* Traffic stats */}
                    {traffic && (
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center gap-1 text-[10px] text-emerald-400">
                          <TrendingUp className="w-3 h-3" />
                          <span>{formatBytes(traffic.uplink_bytes)}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-sky-400">
                          <TrendingDown className="w-3 h-3" />
                          <span>{formatBytes(traffic.downlink_bytes)}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleCopyPortal(u.uuid)}
                      title="Copy Client Portal Link"
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border ${
                        isCopied
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20 hover:bg-indigo-500 hover:text-white hover:border-indigo-500'
                      }`}
                    >
                      <Link2 className="w-3 h-3" />
                      {isCopied ? 'Copied!' : 'Copy Link'}
                    </button>
                    <button
                      onClick={() => handleRevoke(u.uuid)}
                      title="Revoke Key"
                      className="p-1.5 text-rose-500/60 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
