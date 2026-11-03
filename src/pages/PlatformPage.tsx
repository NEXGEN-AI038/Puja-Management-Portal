import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, PieChart, Pie, Cell,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { sendInvite } from '@/lib/invite';
import { LoadingOverlay } from '@/components/ui/Feedback';
import { ShieldCheck, Plus, RefreshCw, Building2, Users, CalendarDays, MailPlus, CreditCard, Search } from 'lucide-react';

const PALETTE = ['#1f6b4f', '#b8963e', '#4f9d7e', '#8a6d2b', '#2f4f4f', '#c9b37e', '#7fb89c', '#5c4a1c'];

interface NameCount { name: string; count: number }
interface CommitteeRow {
  id: string; name: string; city: string | null; state: string | null; created_at: string; members: number; events: number;
  plan: string | null; sub_status: string | null; trial_ends_at: string | null; last_activity: string | null;
  admins: { email: string; status: string }[];
}
interface Stats {
  totals: { committees: number; members: number; events: number; pending_invites: number; active_plans: number };
  base_committees: number; base_members: number;
  by_month: { key: string; month: string; committees: number; members: number }[];
  members_by_role: NameCount[]; subs_by_status: NameCount[]; events_by_type: NameCount[]; events_by_status: NameCount[];
  committees: CommitteeRow[];
}

const ago = (iso: string | null) => {
  if (!iso) return '—';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d <= 0 ? 'Today' : d === 1 ? 'Yesterday' : d < 30 ? `${d} days ago` : new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

function Kpi({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between text-brand-700">{icon}<span className="text-2xl font-semibold text-stone-800">{value}</span></div>
      <p className="mt-2 text-xs font-medium uppercase tracking-wide text-stone-500">{label}</p>
      {hint && <p className="text-xs text-gold-700">{hint}</p>}
    </div>
  );
}

function Donut({ title, data, empty }: { title: string; data: NameCount[]; empty: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.count, 0);
  const sel = hover != null ? data[hover] : null;
  return (
    <Card>
      <CardHeader title={title} />
      {data.length === 0 ? <p className="py-12 text-center text-sm text-stone-400">{empty}</p> : (
        <>
          <div className="relative h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="count" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={2}
                  onMouseEnter={(_, i) => setHover(i)} onMouseLeave={() => setHover(null)}>
                  {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} opacity={hover == null || hover === i ? 1 : 0.35} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-semibold text-stone-800">{sel ? sel.count : total}</span>
              <span className="max-w-[90px] truncate text-[11px] text-stone-500">{sel ? `${Math.round((sel.count / total) * 100)}% · ${sel.name}` : 'total'}</span>
            </div>
          </div>
          <ul className="mt-2 space-y-1">
            {data.map((d, i) => (
              <li key={d.name} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                className="flex cursor-default items-center justify-between rounded px-1 text-xs hover:bg-stone-50">
                <span className="flex items-center gap-2 text-stone-600"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />{d.name}</span>
                <span className="font-medium text-stone-700">{d.count}</span>
              </li>))}
          </ul>
        </>)}
    </Card>
  );
}

export function PlatformPage({ standalone = false }: { standalone?: boolean }) {
  const { signOut, committees } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState(12);
  const [cumulative, setCumulative] = useState(true);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'new' | 'members' | 'events'>('new');
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('platform_stats', { p_months: months });
    if (error) setError(error.message); else setStats(data as Stats);
    setLoading(false);
  }, [months]);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setError('');
    if (!name.trim() || !adminEmail.includes('@')) { setError('Committee name and a valid admin email are required'); return; }
    setBusy(true);
    const { data: newId, error } = await supabase.rpc('create_committee', { p_name: name.trim(), p_admin_email: adminEmail.trim(), p_city: city || null, p_state: state || null });
    if (error) { setBusy(false); setError(error.message); return; }
    const res = await sendInvite(newId as string, adminEmail, 'Committee Admin');
    setBusy(false);
    setNotice({ ok: res.ok, text: res.ok ? res.message : `Committee created. ${res.error}` });
    setName(''); setAdminEmail(''); setCity(''); setState(''); setShowForm(false);
    load();
  };

  const inviteAdmin = async (committeeId: string) => {
    const email = window.prompt('Email of the new Committee Admin?');
    if (!email || !email.includes('@')) return;
    const res = await sendInvite(committeeId, email, 'Committee Admin');
    setNotice({ ok: res.ok, text: res.ok ? res.message : res.error });
    load();
  };

  const series = useMemo(() => {
    if (!stats) return [];
    let c = stats.base_committees, m = stats.base_members;
    return stats.by_month.map((r) => {
      c += r.committees; m += r.members;
      return { month: r.month, Communities: cumulative ? c : r.committees, Members: cumulative ? m : r.members };
    });
  }, [stats, cumulative]);

  const rows = useMemo(() => {
    if (!stats) return [];
    const f = stats.committees.filter((c) => `${c.name} ${c.city || ''} ${c.state || ''} ${c.admins.map((a) => a.email).join(' ')}`.toLowerCase().includes(q.toLowerCase()));
    return [...f].sort((a, b) => sort === 'members' ? b.members - a.members : sort === 'events' ? b.events - a.events : b.created_at.localeCompare(a.created_at));
  }, [stats, q, sort]);

  if (loading) return <LoadingOverlay message="Loading platform..." />;

  const last = stats?.by_month[stats.by_month.length - 1];
  const body = (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-brand-700" />
          <div>
            <h1 className="text-2xl font-serif font-semibold text-stone-800">Platform overview</h1>
            <p className="text-sm text-stone-500">Communities onboarded, members added and platform health</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[6, 12, 24].map((n) => <Button key={n} size="sm" variant={months === n ? 'primary' : 'outline'} onClick={() => setMonths(n)}>{n}M</Button>)}
          <Button size="sm" variant="outline" onClick={load}><RefreshCw className="h-3.5 w-3.5" /></Button>
          <Button size="sm" onClick={() => setShowForm((v) => !v)}><Plus className="h-4 w-4" /> New committee</Button>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {notice && <div className={`rounded-lg p-3 text-sm ${notice.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{notice.text}</div>}

      {showForm && (
        <Card>
          <CardHeader title="New committee" subtitle="The admin gets access when they sign in with this email" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Committee name *" value={name} onChange={(e) => setName(e.target.value)} />
            <Input label="Committee admin email *" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
            <Input label="City" value={city} onChange={(e) => setCity(e.target.value)} />
            <Input label="State" value={state} onChange={(e) => setState(e.target.value)} />
          </div>
          <div className="mt-4 flex gap-2"><Button onClick={create} loading={busy}>Create committee</Button><Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button></div>
        </Card>
      )}

      {stats && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Kpi icon={<Building2 className="h-5 w-5" />} label="Communities" value={stats.totals.committees} hint={last?.committees ? `+${last.committees} this month` : undefined} />
            <Kpi icon={<Users className="h-5 w-5" />} label="Active members" value={stats.totals.members} hint={last?.members ? `+${last.members} this month` : undefined} />
            <Kpi icon={<CalendarDays className="h-5 w-5" />} label="Events" value={stats.totals.events} />
            <Kpi icon={<MailPlus className="h-5 w-5" />} label="Pending invites" value={stats.totals.pending_invites} />
            <Kpi icon={<CreditCard className="h-5 w-5" />} label="Paying plans" value={stats.totals.active_plans} />
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardHeader title="Growth" subtitle={cumulative ? 'Running totals' : 'Added each month'} action={
                <div className="flex gap-1">
                  <Button size="sm" variant={cumulative ? 'primary' : 'outline'} onClick={() => setCumulative(true)}>Total</Button>
                  <Button size="sm" variant={!cumulative ? 'primary' : 'outline'} onClick={() => setCumulative(false)}>Monthly</Button>
                </div>} />
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  {cumulative ? (
                    <AreaChart data={series}>
                      <defs>
                        <linearGradient id="gm" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#1f6b4f" stopOpacity={0.35} /><stop offset="95%" stopColor="#1f6b4f" stopOpacity={0} /></linearGradient>
                        <linearGradient id="gc" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#b8963e" stopOpacity={0.35} /><stop offset="95%" stopColor="#b8963e" stopOpacity={0} /></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip /><Legend />
                      <Area type="monotone" dataKey="Members" stroke="#1f6b4f" strokeWidth={2} fill="url(#gm)" />
                      <Area type="monotone" dataKey="Communities" stroke="#b8963e" strokeWidth={2} fill="url(#gc)" />
                    </AreaChart>
                  ) : (
                    <BarChart data={series}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip /><Legend />
                      <Bar dataKey="Members" fill="#1f6b4f" radius={[4, 4, 0, 0]} /><Bar dataKey="Communities" fill="#b8963e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </Card>
            <div className="lg:col-span-2"><Donut title="Members by role" data={stats.members_by_role} empty="No members yet" /></div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Donut title="Events by type" data={stats.events_by_type} empty="No events yet" />
            <Donut title="Events by status" data={stats.events_by_status} empty="No events yet" />
            <Donut title="Plans & subscriptions" data={stats.subs_by_status} empty="No subscriptions yet" />
          </div>

          <Card>
            <CardHeader title={`Communities (${rows.length})`} action={
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative"><Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-stone-400" /><Input className="pl-8" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
                {(['new', 'members', 'events'] as const).map((s) => <Button key={s} size="sm" variant={sort === s ? 'primary' : 'outline'} onClick={() => setSort(s)}>{s === 'new' ? 'Newest' : s === 'members' ? 'Most members' : 'Most events'}</Button>)}
              </div>} />
            {rows.length === 0 ? <p className="py-8 text-center text-sm text-stone-400">No communities match.</p> : (
              <ul className="divide-y divide-stone-100">
                {rows.map((c) => (
                  <li key={c.id} className="py-3">
                    <button className="flex w-full flex-wrap items-center justify-between gap-2 text-left" onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
                      <div>
                        <p className="font-medium text-stone-800">{c.name}</p>
                        <p className="text-xs text-stone-500">{[c.city, c.state].filter(Boolean).join(', ') || 'No location'} · onboarded {ago(c.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-stone-600">
                        <span>{c.members} members</span><span>{c.events} events</span>
                        {c.plan && <Badge color={c.sub_status === 'active' ? 'green' : 'gold'}>{c.plan} · {c.sub_status}</Badge>}
                      </div>
                    </button>
                    {expanded === c.id && (
                      <div className="mt-3 grid gap-3 rounded-lg bg-stone-50 p-3 text-xs text-stone-600 sm:grid-cols-3">
                        <div><p className="font-medium text-stone-700">Committee admins</p>
                          {c.admins.length === 0 ? '—' : c.admins.map((a) => <p key={a.email}>{a.email}{a.status === 'pending' ? ' (invite pending)' : ''}</p>)}
                          <button className="mt-1 text-brand-700 hover:underline" onClick={() => inviteAdmin(c.id)}>+ Invite admin</button></div>
                        <div><p className="font-medium text-stone-700">Last activity</p><p>{ago(c.last_activity)}</p></div>
                        <div><p className="font-medium text-stone-700">Trial ends</p><p>{c.trial_ends_at ? new Date(c.trial_ends_at).toLocaleDateString('en-IN') : '—'}</p></div>
                      </div>)}
                  </li>))}
              </ul>)}
          </Card>
        </>
      )}
    </div>
  );

  if (!standalone) return body;
  return (
    <div className="min-h-screen bg-stone-50">
      <header className="flex items-center justify-between border-b border-stone-200 bg-white px-6 py-3">
        <span className="flex items-center gap-2 font-serif font-semibold text-brand-800"><img src="/logo-green.png" alt="GD Solutions logo" className="h-8 w-8" />Festival Management Platform</span>
        <div className="flex gap-2">
          {committees.length > 0 && <Button variant="ghost" onClick={() => { window.location.hash = '/'; }}>Open committee app</Button>}
          <Button variant="outline" onClick={() => signOut()}>Sign out</Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-6">{body}</main>
    </div>
  );
}
