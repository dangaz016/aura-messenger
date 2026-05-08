import { useState, useEffect } from 'react';
import { X, Shield, Users, MessageCircle, BarChart3, Ban, Snowflake, Check, Search, AlertTriangle, Trash2 } from 'lucide-react';
import { api } from '../../services/api';
import { getInitials } from '../../utils/formatters';

interface AdminUser {
  id: string;
  username: string;
  displayName: string;
  avatarColor: string;
  isAdmin: boolean;
  isBanned: boolean;
  isFrozen: boolean;
  banReason: string | null;
  createdAt: number;
  lastSeen: number;
  email: string | null;
}

interface Stats {
  users: number;
  messages: number;
  chats: number;
  banned: number;
  frozen: number;
  reports: number;
}

interface AdminPanelProps {
  onClose: () => void;
}

export function AdminPanel({ onClose }: AdminPanelProps) {
  const [tab, setTab] = useState<'stats' | 'users' | 'reports'>('stats');
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [reports, setReports] = useState<unknown[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [banningUserId, setBanningUserId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState('');

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    if (tab === 'users') loadUsers();
    if (tab === 'reports') loadReports();
  }, [tab]);

  async function loadStats() {
    try {
      const data = await api.adminStats();
      setStats(data);
    } catch { setStats(null); }
  }

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await api.adminUsers(search);
      setUsers(Array.isArray(data) ? data : []);
    } catch { setUsers([]); }
    setLoading(false);
  }

  async function loadReports() {
    setLoading(true);
    try {
      const data = await api.adminGetReports();
      setReports(Array.isArray(data) ? data : []);
    } catch { setReports([]); }
    setLoading(false);
  }

  function showMsg(msg: string) {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(''), 2500);
  }

  async function handleBan(userId: string) {
    const reason = prompt('Ban reason:');
    if (!reason) return;
    try {
      await api.adminBanUser(userId, reason);
      showMsg('User banned');
      loadUsers();
    } catch { showMsg('Error'); }
  }

  async function handleUnban(userId: string) {
    try {
      await api.adminUnbanUser(userId);
      showMsg('User unbanned');
      loadUsers();
    } catch { showMsg('Error'); }
  }

  async function handleFreeze(userId: string) {
    try {
      await api.adminFreezeUser(userId);
      showMsg('User frozen');
      loadUsers();
    } catch { showMsg('Error'); }
  }

  async function handleUnfreeze(userId: string) {
    try {
      await api.adminUnfreezeUser(userId);
      showMsg('User unfrozen');
      loadUsers();
    } catch { showMsg('Error'); }
  }

  async function handleMakeAdmin(userId: string) {
    if (!confirm('Make this user admin?')) return;
    try {
      await api.adminMakeAdmin(userId);
      showMsg('Admin granted');
      loadUsers();
    } catch { showMsg('Error'); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-aura-surface border border-aura-border rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-scale-in">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-aura-border">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Shield className="w-5 h-5 text-aura-primary" />
            Admin Panel
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-aura-elevated rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-3 border-b border-aura-border">
          {(['stats', 'users', 'reports'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors capitalize ${
                tab === t ? 'bg-aura-elevated text-aura-primary border-b-2 border-aura-primary' : 'text-aura-text-muted hover:text-aura-text'
              }`}>
              {t}
            </button>
          ))}
        </div>

        {/* Action message */}
        {actionMsg && (
          <div className="mx-5 mt-3 px-3 py-2 rounded-lg bg-aura-online/10 border border-aura-online/30 text-aura-online text-sm flex items-center gap-2">
            <Check className="w-4 h-4" /> {actionMsg}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5">
          {/* Stats tab */}
          {tab === 'stats' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { label: 'Total Users', value: stats?.users, icon: <Users className="w-5 h-5" />, color: 'text-aura-primary' },
                { label: 'Messages', value: stats?.messages, icon: <MessageCircle className="w-5 h-5" />, color: 'text-blue-400' },
                { label: 'Chats', value: stats?.chats, icon: <BarChart3 className="w-5 h-5" />, color: 'text-green-400' },
                { label: 'Banned', value: stats?.banned, icon: <Ban className="w-5 h-5" />, color: 'text-aura-dnd' },
                { label: 'Frozen', value: stats?.frozen, icon: <Snowflake className="w-5 h-5" />, color: 'text-cyan-400' },
                { label: 'Reports', value: stats?.reports, icon: <AlertTriangle className="w-5 h-5" />, color: 'text-aura-ghost' },
              ].map(stat => (
                <div key={stat.label} className="bg-aura-surface2 rounded-xl p-4 border border-aura-border">
                  <div className={`mb-2 ${stat.color}`}>{stat.icon}</div>
                  <div className="text-2xl font-bold">{stat.value ?? '...'}</div>
                  <div className="text-xs text-aura-text-muted mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Users tab */}
          {tab === 'users' && (
            <div>
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-aura-text-muted" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && loadUsers()}
                    placeholder="Search users..."
                    className="input-aura w-full pl-10"
                  />
                </div>
                <button onClick={loadUsers} className="btn-primary px-4">Search</button>
              </div>

              {loading ? (
                <div className="text-center py-8 text-aura-text-muted">Loading...</div>
              ) : (
                <div className="space-y-2">
                  {users.map(u => (
                    <div key={u.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                      u.isBanned ? 'border-aura-dnd/30 bg-aura-dnd/5' :
                      u.isFrozen ? 'border-cyan-500/30 bg-cyan-500/5' :
                      'border-aura-border bg-aura-surface2'
                    }`}>
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
                        style={{ background: `linear-gradient(135deg, ${u.avatarColor} 0%, ${u.avatarColor}cc 100%)` }}>
                        {getInitials(u.displayName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{u.displayName}</span>
                          {u.isAdmin && <span className="text-xs px-1.5 py-0.5 rounded bg-aura-primary/20 text-aura-primary-light">Admin</span>}
                          {u.isBanned && <span className="text-xs px-1.5 py-0.5 rounded bg-aura-dnd/20 text-aura-dnd">Banned</span>}
                          {u.isFrozen && <span className="text-xs px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400">Frozen</span>}
                        </div>
                        <div className="text-xs text-aura-text-muted">@{u.username}</div>
                        {u.banReason && <div className="text-xs text-aura-dnd mt-0.5">Reason: {u.banReason}</div>}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        {u.isBanned ? (
                          <button onClick={() => handleUnban(u.id)}
                            className="p-1.5 rounded-lg bg-aura-online/10 hover:bg-aura-online/20 text-aura-online text-xs transition-colors" title="Unban">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button onClick={() => handleBan(u.id)}
                            className="p-1.5 rounded-lg hover:bg-aura-dnd/10 text-aura-text-muted hover:text-aura-dnd transition-colors" title="Ban">
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {u.isFrozen ? (
                          <button onClick={() => handleUnfreeze(u.id)}
                            className="p-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 transition-colors" title="Unfreeze">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button onClick={() => handleFreeze(u.id)}
                            className="p-1.5 rounded-lg hover:bg-cyan-500/10 text-aura-text-muted hover:text-cyan-400 transition-colors" title="Freeze">
                            <Snowflake className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {!u.isAdmin && (
                          <button onClick={() => handleMakeAdmin(u.id)}
                            className="p-1.5 rounded-lg hover:bg-aura-primary/10 text-aura-text-muted hover:text-aura-primary transition-colors" title="Make Admin">
                            <Shield className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {users.length === 0 && !loading && (
                    <div className="text-center py-8 text-aura-text-muted">No users found</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Reports tab */}
          {tab === 'reports' && (
            <div className="space-y-3">
              {loading ? (
                <div className="text-center py-8 text-aura-text-muted">Loading...</div>
              ) : reports.length === 0 ? (
                <div className="text-center py-8 text-aura-text-muted">No pending reports</div>
              ) : (
                (reports as any[]).map((r: any) => (
                  <div key={r.id} className="p-4 rounded-xl border border-aura-ghost/30 bg-aura-ghost/5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium">
                          <span className="text-aura-text-muted">From:</span> @{r.reporter_username}
                          {r.target_username && <> <span className="text-aura-text-muted">→</span> @{r.target_username}</>}
                        </div>
                        <div className="text-sm mt-1 text-aura-dnd">{r.reason}</div>
                        <div className="text-xs text-aura-text-muted mt-1">
                          {new Date(r.created_at * 1000).toLocaleString()}
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          await fetch(`/api/admin/reports/${r.id}/resolve`, {
                            method: 'POST',
                            headers: { Authorization: `Bearer ${api.getToken()}` }
                          });
                          loadReports();
                          showMsg('Report resolved');
                        }}
                        className="px-3 py-1.5 bg-aura-online/10 hover:bg-aura-online/20 text-aura-online rounded-lg text-xs transition-colors flex-shrink-0"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
