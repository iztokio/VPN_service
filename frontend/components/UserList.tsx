'use client';
import { useState, useEffect } from 'react';
import { Trash2, Calendar } from 'lucide-react';

interface User {
  id: number;
  uuid: string;
  tg_id: number;
  status: string;
  created_at: string;
  expires_at: string | null;
}

export default function UserList({ token }: { token: string }) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    try {
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
    if (!confirm('Are you sure you want to revoke this key?')) return;
    try {
      const res = await fetch(`/api/keys/${uuid}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchUsers();
      } else {
        alert('Failed to revoke key');
      }
    } catch (e) {
      alert('Error revoking key');
    }
  };

  const handleRevokeAll = async () => {
    if (!confirm('Are you ABSOLUTELY sure you want to delete ALL users? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/users`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchUsers();
      } else {
        alert('Failed to revoke all keys');
      }
    } catch (e) {
      alert('Error revoking all keys');
    }
  };

  const copyClientUrl = (uuid: string) => {
    const url = `http://${window.location.hostname}:8080/client/${uuid}`;
    navigator.clipboard.writeText(url);
    alert('Client Link copied! Send this to the user.');
  };

  useEffect(() => {
    if (token) fetchUsers();
  }, [token]);

  if (loading) return <div className="text-slate-400 text-sm p-4 text-center">Loading users...</div>;

  return (
    <div className="space-y-3 mt-8">
      <div className="flex justify-between items-center px-2">
        <h3 className="text-lg font-medium text-white">Active Users ({users.length})</h3>
        {users.length > 0 && (
          <button 
            onClick={handleRevokeAll}
            className="px-3 py-1.5 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-lg text-xs font-semibold transition"
          >
            Delete All
          </button>
        )}
      </div>
      {users.length === 0 ? (
        <div className="text-slate-500 text-sm p-4 text-center bg-slate-900/50 rounded-xl border border-slate-800">No active users</div>
      ) : (
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
          {users.map(u => (
            <div key={u.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl hover:bg-slate-800/60 transition-colors">
              <div className="flex flex-col">
                <span className="font-mono text-xs text-indigo-400">user_{u.uuid.substring(0,6)}</span>
                <div className="mt-1 flex items-center text-[10px] text-slate-500 gap-1 font-mono">
                  <Calendar className="w-3 h-3" />
                  Exp: {u.expires_at ? new Date(u.expires_at).toLocaleDateString() : 'Never'}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2 sm:mt-0">
                <button
                  onClick={() => copyClientUrl(u.uuid)}
                  className="px-3 py-1.5 text-xs text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500 hover:text-white rounded-lg transition-colors border border-indigo-500/20"
                >
                  Copy Portal Link
                </button>
                <button
                  onClick={() => handleRevoke(u.uuid)}
                  className="p-2.5 text-rose-500/70 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                  title="Revoke Key"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
