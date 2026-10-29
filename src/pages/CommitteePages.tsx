import { useCallback, useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from '@/lib/router';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Table } from '@/components/ui/Table';
import { EmptyState, LoadingOverlay } from '@/components/ui/Feedback';
import { StatCard, StatusSelect, label, statusColor } from '@/components/modules/ModuleCrud';
import { Download, Wallet, Truck, Clock, CheckSquare } from 'lucide-react';

const inr = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
const PALETTE = ['#1f6b4f', '#b8963e', '#4f9d7e', '#8a6d2b', '#2f4f4f', '#c9b37e', '#7fb89c', '#5c4a1c'];
const fmtDate = (d?: string | null) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const EDIT_ROLES = ['Platform Owner', 'Committee Admin', 'Event Manager'];

interface EventLite { id: string; name: string; start_date: string }

function useCommitteeEvents() {
  const { activeCommittee } = useAuth();
  const [events, setEvents] = useState<EventLite[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!activeCommittee) { setReady(true); return; }
    supabase.from('events').select('id,name,start_date').eq('committee_id', activeCommittee.id).order('start_date', { ascending: false })
      .then(({ data }) => { setEvents((data as EventLite[]) || []); setReady(true); });
  }, [activeCommittee]);
  const nameOf = useMemo(() => new Map(events.map((e) => [e.id, e.name])), [events]);
  return { events, ready, nameOf, activeCommittee };
}

function useRows<T>(table: string, events: EventLite[], ready: boolean) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (events.length === 0) { setRows([]); setLoading(false); return; }
    const { data } = await supabase.from(table).select('*').in('event_id', events.map((e) => e.id));
    setRows((data as T[]) || []);
    setLoading(false);
  }, [table, events]);
  useEffect(() => { if (ready) load(); }, [ready, load]);
  return { rows, loading, reload: load };
}

function NoEvents() {
  const { navigate } = useRouter();
  return <Card padding="lg"><EmptyState title="No events yet" description="Create an event first — this view collects data across all of your events."
    action={<Button onClick={() => navigate('/events')}>Go to events</Button>} /></Card>;
}

const Header = ({ title, subtitle }: { title: string; subtitle: string }) => (
  <div><h1 className="text-2xl font-serif font-semibold text-stone-800">{title}</h1><p className="mt-0.5 text-sm text-stone-500">{subtitle}</p></div>
);

// ───────────────────────── Finance ─────────────────────────
interface Fin { id: string; event_id: string; type: 'income' | 'expense'; category: string; description: string | null; amount: number; date: string; payment_method: string; reference_no: string | null; party_name: string | null; flat_no: string | null; tower_phase: string | null; status: string }

export function FinancePage() {
  const { events, ready, nameOf } = useCommitteeEvents();
  const { rows, loading } = useRows<Fin>('event_finance', events, ready);
  const { navigate } = useRouter();
  const [eventId, setEventId] = useState('all');
  const [type, setType] = useState('all');
  const [mode, setMode] = useState('all');

  const live = useMemo(() => rows.filter((r) => r.status !== 'void' && (eventId === 'all' || r.event_id === eventId)), [rows, eventId]);
  const shown = useMemo(() => live.filter((r) => (type === 'all' || r.type === type) && (mode === 'all' || r.payment_method === mode))
    .sort((a, b) => b.date.localeCompare(a.date)), [live, type, mode]);

  const income = live.filter((r) => r.type === 'income').reduce((s, r) => s + Number(r.amount), 0);
  const expense = live.filter((r) => r.type === 'expense').reduce((s, r) => s + Number(r.amount), 0);

  const perEvent = useMemo(() => events.map((e) => {
    const rs = rows.filter((r) => r.event_id === e.id && r.status !== 'void');
    return { name: e.name, Income: rs.filter((r) => r.type === 'income').reduce((s, r) => s + Number(r.amount), 0), Expense: rs.filter((r) => r.type === 'expense').reduce((s, r) => s + Number(r.amount), 0) };
  }).filter((e) => e.Income || e.Expense), [events, rows]);

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    live.filter((r) => r.type === 'expense').forEach((r) => m.set(r.category, (m.get(r.category) || 0) + Number(r.amount)));
    return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [live]);

  const exportCsv = () => {
    const head = ['Date', 'Event', 'Type', 'Category', 'Description', 'Name', 'Flat no', 'Tower/Phase', 'Amount', 'Mode', 'Reference'];
    const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [head.join(','), ...shown.map((r) => [r.date, nameOf.get(r.event_id), r.type, r.category, r.description, r.party_name, r.flat_no, r.tower_phase, r.amount, r.payment_method, r.reference_no].map(q).join(','))];
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'finance-report.csv'; a.click(); URL.revokeObjectURL(url);
  };

  if (!ready || loading) return <LoadingOverlay message="Loading finances..." />;
  if (events.length === 0) return <NoEvents />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Header title="Finance" subtitle="Income and expenses across all events" />
        <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4" /> Export CSV</Button>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total income" value={<span className="text-green-700">{inr(income)}</span>} />
        <StatCard label="Total expenses" value={<span className="text-red-600">{inr(expense)}</span>} />
        <StatCard label="Net balance" value={<span className={income - expense < 0 ? 'text-red-600' : 'text-brand-700'}>{inr(income - expense)}</span>} />
        <StatCard label="Records" value={live.length} />
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Income vs expense by event" />
          <div className="h-64"><ResponsiveContainer width="100%" height="100%">
            <BarChart data={perEvent}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
              <Tooltip formatter={(v) => inr(Number(v))} /><Legend />
              <Bar dataKey="Income" fill="#1f6b4f" radius={[4, 4, 0, 0]} /><Bar dataKey="Expense" fill="#b8963e" radius={[4, 4, 0, 0]} /></BarChart>
          </ResponsiveContainer></div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Where the money goes" subtitle="Expenses by category" />
          {byCategory.length === 0 ? <p className="py-10 text-center text-sm text-stone-400">No expenses yet</p> : (
            <div className="h-64"><ResponsiveContainer width="100%" height="100%">
              <PieChart><Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                {byCategory.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}</Pie>
                <Tooltip formatter={(v) => inr(Number(v))} /><Legend wrapperStyle={{ fontSize: 11 }} /></PieChart>
            </ResponsiveContainer></div>)}
        </Card>
      </div>
      <Card>
        <CardHeader title="Transactions" action={
          <div className="flex flex-wrap gap-2">
            <Select value={eventId} onChange={(e) => setEventId(e.target.value)}><option value="all">All events</option>{events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</Select>
            <Select value={type} onChange={(e) => setType(e.target.value)}><option value="all">Income & expense</option><option value="income">Income</option><option value="expense">Expense</option></Select>
            <Select value={mode} onChange={(e) => setMode(e.target.value)}><option value="all">All modes</option>{['cash', 'upi', 'bank', 'cheque', 'online', 'other'].map((m) => <option key={m} value={m}>{label(m)}</option>)}</Select>
          </div>} />
        <Table
          columns={[
            { key: 'date', label: 'Date', render: (r: Fin) => fmtDate(r.date) },
            { key: 'event', label: 'Event', render: (r: Fin) => <button className="text-brand-700 hover:underline" onClick={() => navigate(`/event/${r.event_id}/finance`)}>{nameOf.get(r.event_id)}</button> },
            { key: 'category', label: 'Category', render: (r: Fin) => <div><p className="text-stone-800">{r.category}</p>{r.description && <p className="text-xs text-stone-400">{r.description}</p>}</div> },
            { key: 'party', label: 'Name / Flat', render: (r: Fin) => (
              <div><p className="text-stone-700">{r.party_name || '—'}</p>
                {(r.flat_no || r.tower_phase) && <p className="text-xs text-stone-400">{[r.flat_no && `Flat ${r.flat_no}`, r.tower_phase && `Tower/Phase ${r.tower_phase}`].filter(Boolean).join(' · ')}</p>}</div>) },
            { key: 'mode', label: 'Mode', render: (r: Fin) => <span className="text-xs uppercase text-stone-500">{r.payment_method}{r.reference_no ? ` · ${r.reference_no}` : ''}</span> },
            { key: 'amount', label: 'Amount', render: (r: Fin) => <span className={r.type === 'income' ? 'font-medium text-green-700' : 'font-medium text-red-600'}>{r.type === 'income' ? '+' : '−'}{inr(Number(r.amount))}</span> },
          ]}
          data={shown} rowKey={(r: Fin) => r.id}
          emptyState={<EmptyState icon={<Wallet className="h-10 w-10" />} title="No matching transactions" description="Adjust the filters or add records inside an event." />} />
      </Card>
    </div>
  );
}

// ───────────────────────── Vendors ─────────────────────────
interface Vendor { id: string; event_id: string; name: string; service_type: string | null; contact_person: string | null; phone: string | null; estimated_cost: number | null; actual_cost: number | null; status: string }

export function VendorsPage() {
  const { events, ready, nameOf } = useCommitteeEvents();
  const { rows, loading, reload } = useRows<Vendor>('event_vendors', events, ready);
  const { activeCommittee: ac } = useAuth();
  const canEditVendors = !!ac && EDIT_ROLES.includes(ac.role);
  const setVendorStatus = async (id: string, status: string) => { await supabase.from('event_vendors').update({ status }).eq('id', id); reload(); };
  const { navigate } = useRouter();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const shown = rows.filter((v) => (status === 'all' || v.status === status) && `${v.name} ${v.service_type || ''} ${nameOf.get(v.event_id) || ''}`.toLowerCase().includes(q.toLowerCase()));

  if (!ready || loading) return <LoadingOverlay message="Loading vendors..." />;
  if (events.length === 0) return <NoEvents />;
  return (
    <div className="space-y-6 animate-fade-in">
      <Header title="Vendors" subtitle="Suppliers and service providers across all events" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Vendors" value={rows.length} />
        <StatCard label="Confirmed" value={rows.filter((v) => v.status === 'confirmed').length} />
        <StatCard label="Estimated" value={inr(rows.reduce((s, v) => s + Number(v.estimated_cost || 0), 0))} />
        <StatCard label="Actual" value={inr(rows.reduce((s, v) => s + Number(v.actual_cost || 0), 0))} />
      </div>
      <Card>
        <CardHeader title="All vendors" action={<div className="flex gap-2">
          <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All statuses</option>{['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'].map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select></div>} />
        <Table
          columns={[
            { key: 'name', label: 'Vendor', render: (v: Vendor) => <div><p className="font-medium text-stone-800">{v.name}</p><p className="text-xs text-stone-400">{v.service_type || '—'}</p></div> },
            { key: 'event', label: 'Event', render: (v: Vendor) => <button className="text-brand-700 hover:underline" onClick={() => navigate(`/event/${v.event_id}/vendors`)}>{nameOf.get(v.event_id)}</button> },
            { key: 'contact', label: 'Contact', render: (v: Vendor) => <span className="text-stone-600">{[v.contact_person, v.phone].filter(Boolean).join(' · ') || '—'}</span> },
            { key: 'cost', label: 'Est. / Actual', render: (v: Vendor) => `${v.estimated_cost != null ? inr(Number(v.estimated_cost)) : '—'} / ${v.actual_cost != null ? inr(Number(v.actual_cost)) : '—'}` },
            { key: 'status', label: 'Status', render: (v: Vendor) => canEditVendors
              ? <StatusSelect value={v.status} options={['pending', 'confirmed', 'in_progress', 'completed', 'cancelled']} onChange={(x) => setVendorStatus(v.id, x)} />
              : <Badge color={statusColor(v.status)}>{label(v.status)}</Badge> },
          ]}
          data={shown} rowKey={(v: Vendor) => v.id}
          emptyState={<EmptyState icon={<Truck className="h-10 w-10" />} title="No vendors found" description="Add vendors from inside an event." />} />
      </Card>
    </div>
  );
}

// ───────────────────────── Schedule ─────────────────────────
interface Item { id: string; event_id: string; title: string; scheduled_date: string; start_time: string | null; end_time: string | null; location: string | null }

export function SchedulePage() {
  const { events, ready, nameOf } = useCommitteeEvents();
  const { rows, loading } = useRows<Item>('event_schedule_items', events, ready);
  const { navigate } = useRouter();
  const [upcomingOnly, setUpcomingOnly] = useState(true);
  const [eventId, setEventId] = useState('all');
  const today = new Date().toISOString().slice(0, 10);

  const grouped = useMemo(() => {
    const list = rows.filter((r) => (!upcomingOnly || r.scheduled_date >= today) && (eventId === 'all' || r.event_id === eventId))
      .sort((a, b) => (a.scheduled_date + (a.start_time || '')).localeCompare(b.scheduled_date + (b.start_time || '')));
    const m = new Map<string, Item[]>();
    list.forEach((r) => m.set(r.scheduled_date, [...(m.get(r.scheduled_date) || []), r]));
    return [...m.entries()];
  }, [rows, upcomingOnly, eventId, today]);

  if (!ready || loading) return <LoadingOverlay message="Loading schedule..." />;
  if (events.length === 0) return <NoEvents />;
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Header title="Schedule" subtitle="Day-by-day agenda across all events" />
        <div className="flex gap-2">
          <Select value={eventId} onChange={(e) => setEventId(e.target.value)}><option value="all">All events</option>{events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</Select>
          <Button variant={upcomingOnly ? 'primary' : 'outline'} size="sm" onClick={() => setUpcomingOnly(true)}>Upcoming</Button>
          <Button variant={!upcomingOnly ? 'primary' : 'outline'} size="sm" onClick={() => setUpcomingOnly(false)}>All</Button>
        </div>
      </div>
      {grouped.length === 0 ? (
        <Card padding="lg"><EmptyState icon={<Clock className="h-10 w-10" />} title="Nothing scheduled" description="Programme items added inside an event appear here." /></Card>
      ) : grouped.map(([date, items]) => (
        <Card key={date}>
          <CardHeader title={new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} />
          <ul className="divide-y divide-stone-100">
            {items.map((i) => (
              <li key={i.id} className="flex items-center gap-4 py-3">
                <span className="w-28 shrink-0 text-sm font-medium text-brand-700">{i.start_time ? `${i.start_time.slice(0, 5)}${i.end_time ? ' – ' + i.end_time.slice(0, 5) : ''}` : 'All day'}</span>
                <div className="min-w-0 flex-1"><p className="font-medium text-stone-800">{i.title}</p>{i.location && <p className="text-xs text-stone-400">{i.location}</p>}</div>
                <button className="text-xs text-brand-700 hover:underline" onClick={() => navigate(`/event/${i.event_id}/schedule`)}>{nameOf.get(i.event_id)}</button>
              </li>))}
          </ul>
        </Card>))}
    </div>
  );
}

// ───────────────────────── Tasks ─────────────────────────
interface Task { id: string; event_id: string; title: string; status: string; priority: string; due_date: string | null }
const PRIORITY_COLOR: Record<string, 'gray' | 'blue' | 'amber' | 'red'> = { low: 'gray', medium: 'blue', high: 'amber', urgent: 'red' };

export function TasksPage() {
  const { events, ready, nameOf, activeCommittee } = useCommitteeEvents();
  const { rows, loading, reload } = useRows<Task>('event_tasks', events, ready);
  const { navigate } = useRouter();
  const [status, setStatus] = useState('all');
  const [priority, setPriority] = useState('all');
  const canEdit = !!activeCommittee && EDIT_ROLES.includes(activeCommittee.role);
  const today = new Date().toISOString().slice(0, 10);
  const shown = rows.filter((t) => (status === 'all' || t.status === status) && (priority === 'all' || t.priority === priority))
    .sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'));
  const overdue = rows.filter((t) => t.status !== 'completed' && t.due_date && t.due_date < today).length;

  const setTaskStatus = async (id: string, s: string) => { await supabase.from('event_tasks').update({ status: s }).eq('id', id); reload(); };

  if (!ready || loading) return <LoadingOverlay message="Loading tasks..." />;
  if (events.length === 0) return <NoEvents />;
  return (
    <div className="space-y-6 animate-fade-in">
      <Header title="Tasks" subtitle="Everything that needs doing, across all events" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Open" value={rows.filter((t) => t.status !== 'completed').length} />
        <StatCard label="In progress" value={rows.filter((t) => t.status === 'in_progress').length} />
        <StatCard label="Overdue" value={<span className={overdue ? 'text-red-600' : ''}>{overdue}</span>} />
        <StatCard label="Completed" value={rows.filter((t) => t.status === 'completed').length} />
      </div>
      <Card>
        <CardHeader title="All tasks" action={<div className="flex gap-2">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All statuses</option>{['pending', 'in_progress', 'completed', 'blocked'].map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
          <Select value={priority} onChange={(e) => setPriority(e.target.value)}><option value="all">All priorities</option>{['low', 'medium', 'high', 'urgent'].map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select></div>} />
        <Table
          columns={[
            { key: 'title', label: 'Task', render: (t: Task) => <span className="font-medium text-stone-800">{t.title}</span> },
            { key: 'event', label: 'Event', render: (t: Task) => <button className="text-brand-700 hover:underline" onClick={() => navigate(`/event/${t.event_id}/tasks`)}>{nameOf.get(t.event_id)}</button> },
            { key: 'priority', label: 'Priority', render: (t: Task) => <Badge color={PRIORITY_COLOR[t.priority] || 'gray'}>{label(t.priority)}</Badge> },
            { key: 'due', label: 'Due', render: (t: Task) => <span className={t.status !== 'completed' && t.due_date && t.due_date < today ? 'font-medium text-red-600' : 'text-stone-600'}>{fmtDate(t.due_date)}</span> },
            { key: 'status', label: 'Status', render: (t: Task) => canEdit ? (
              <select className="rounded-md border border-stone-200 bg-white px-2 py-1 text-xs" value={t.status} onChange={(e) => setTaskStatus(t.id, e.target.value)}>
                {['pending', 'in_progress', 'completed', 'blocked'].map((s) => <option key={s} value={s}>{label(s)}</option>)}</select>
            ) : <Badge color={statusColor(t.status)}>{label(t.status)}</Badge> },
          ]}
          data={shown} rowKey={(t: Task) => t.id}
          emptyState={<EmptyState icon={<CheckSquare className="h-10 w-10" />} title="No tasks" description="Add tasks from inside an event." />} />
      </Card>
    </div>
  );
}
