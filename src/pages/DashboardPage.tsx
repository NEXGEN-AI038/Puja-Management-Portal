import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { useAuth } from '@/contexts/AuthContext';
import { canCreateEvent } from '@/lib/permissions';
import { useRouter } from '@/lib/router';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { LoadingOverlay, EmptyState } from '@/components/ui/Feedback';
import {
  CalendarDays, Wallet, TrendingUp, TrendingDown, CheckSquare,
  ArrowRight, Plus, MapPin, Clock, Building2,
} from 'lucide-react';
import type { EventItem, EventTask, EventFinance } from '@/types';
import { EVENT_STATUSES } from '@/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const inr = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

// PostgREST returns at most 1000 rows per request, so read in pages to keep totals correct.
async function fetchAllFinance(eventIds: string[]): Promise<EventFinance[]> {
  const out: EventFinance[] = [];
  if (eventIds.length === 0) return out;
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from('event_finance')
      .select('id,event_id,type,category,description,amount,date,status')
      .in('event_id', eventIds)
      .order('date', { ascending: false })
      .order('id')
      .range(from, from + 999);
    if (!data) break;
    out.push(...(data as unknown as EventFinance[]));
    if (data.length < 1000) break;
  }
  return out;
}

export function DashboardPage() {
  const { activeCommittee } = useAuth();
  const { navigate } = useRouter();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [tasks, setTasks] = useState<EventTask[]>([]);
  const [finance, setFinance] = useState<EventFinance[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState<string>(String(new Date().getFullYear()));
  const yearChosen = useRef(false);

  const loadData = useCallback(async () => {
    if (!activeCommittee) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: ev } = await supabase
      .from('events')
      .select('*')
      .eq('committee_id', activeCommittee.id)
      .order('start_date', { ascending: true });
    const evList = (ev as EventItem[]) || [];
    const ids = evList.map((e) => e.id);

    const [tasksRes, fin] = await Promise.all([
      ids.length
        ? supabase.from('event_tasks').select('*, event:events(id, name)').in('event_id', ids).order('due_date', { ascending: true }).limit(10)
        : Promise.resolve({ data: [] as any[] }),
      fetchAllFinance(ids),
    ]);

    setEvents(evList);
    setTasks((tasksRes.data as any[]) || []);
    setFinance(fin.filter((f) => f.status !== 'void'));
    setLoading(false);
  }, [activeCommittee]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const eventName = useMemo(() => new Map(events.map((e) => [e.id, e.name])), [events]);

  // Years that actually have data (plus the current year), newest first.
  const years = useMemo(() => {
    const set = new Set<string>([String(new Date().getFullYear())]);
    events.forEach((e) => set.add(e.start_date.slice(0, 4)));
    finance.forEach((f) => set.add(f.date.slice(0, 4)));
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [events, finance]);

  // On first load, if this year is empty but earlier years have data, open on the latest year with data.
  useEffect(() => {
    if (yearChosen.current || loading) return;
    const cur = String(new Date().getFullYear());
    const has = (y: string) => events.some((e) => e.start_date.startsWith(y)) || finance.some((f) => f.date.startsWith(y));
    if (!has(cur)) {
      const latest = years.find(has);
      if (latest) setYear(latest);
    }
    yearChosen.current = true;
  }, [loading, events, finance, years]);

  const inYear = (d: string) => year === 'all' || d.startsWith(year);
  const yearEvents = useMemo(() => events.filter((e) => inYear(e.start_date)), [events, year]);
  const yearFinance = useMemo(() => finance.filter((f) => inYear(f.date)), [finance, year]);

  const chartData = useMemo(() => {
    if (year === 'all') {
      return [...years].reverse().map((y) => ({
        name: y,
        Income: finance.filter((f) => f.type === 'income' && f.date.startsWith(y)).reduce((s, f) => s + Number(f.amount), 0),
        Expense: finance.filter((f) => f.type === 'expense' && f.date.startsWith(y)).reduce((s, f) => s + Number(f.amount), 0),
      }));
    }
    return MONTHS.map((m, i) => {
      const prefix = `${year}-${String(i + 1).padStart(2, '0')}`;
      return {
        name: m,
        Income: yearFinance.filter((f) => f.type === 'income' && f.date.startsWith(prefix)).reduce((s, f) => s + Number(f.amount), 0),
        Expense: yearFinance.filter((f) => f.type === 'expense' && f.date.startsWith(prefix)).reduce((s, f) => s + Number(f.amount), 0),
      };
    });
  }, [year, years, finance, yearFinance]);

  const expenseByCategory = useMemo(() => {
    const m = new Map<string, number>();
    yearFinance.filter((f) => f.type === 'expense').forEach((f) => m.set(f.category, (m.get(f.category) || 0) + Number(f.amount)));
    return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [yearFinance]);

  if (loading) return <LoadingOverlay message="Loading dashboard..." />;

  if (!activeCommittee) {
    return (
      <EmptyState
        icon={<Building2 className="h-12 w-12" />}
        title="No committee selected"
        description="Create a committee or ask to be invited to one."
      />
    );
  }

  const now = new Date();
  const upcoming = events.filter((e) => new Date(e.start_date) >= now && e.status !== 'cancelled' && e.status !== 'completed').slice(0, 5);
  const pendingTasks = tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress');
  const totalIncome = yearFinance.filter((f) => f.type === 'income').reduce((sum, f) => sum + Number(f.amount), 0);
  const totalExpense = yearFinance.filter((f) => f.type === 'expense').reduce((sum, f) => sum + Number(f.amount), 0);
  const balance = totalIncome - totalExpense;
  const recent = yearFinance.slice(0, 5);
  const periodLabel = year === 'all' ? 'All years' : year;
  const maxCat = expenseByCategory[0]?.value || 1;

  const statusInfo = (status: string) => EVENT_STATUSES.find((s) => s.value === status);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-stone-800">{activeCommittee.name}</h1>
          <p className="text-sm text-stone-500 mt-0.5">Dashboard overview · {periodLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select aria-label="Year" value={year} onChange={(e) => { yearChosen.current = true; setYear(e.target.value); }}>
            <option value="all">All years</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </Select>
          {canCreateEvent(activeCommittee.role) && (
            <Button onClick={() => navigate('/events')}>
              <Plus className="h-4 w-4" /> New Event
            </Button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card padding="md">
          <div className="flex items-center justify-between mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
              <CalendarDays className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-xs text-stone-400">{periodLabel}</span>
          </div>
          <p className="text-2xl font-semibold text-stone-800">{yearEvents.length}</p>
          <p className="text-xs text-stone-500 mt-1">Events</p>
        </Card>

        <Card padding="md">
          <div className="flex items-center justify-between mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-xs text-stone-400">{periodLabel}</span>
          </div>
          <p className="text-2xl font-semibold text-stone-800">₹{totalIncome.toLocaleString('en-IN')}</p>
          <p className="text-xs text-stone-500 mt-1">Total income</p>
        </Card>

        <Card padding="md">
          <div className="flex items-center justify-between mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50">
              <TrendingDown className="h-5 w-5 text-red-600" />
            </div>
            <span className="text-xs text-stone-400">{periodLabel}</span>
          </div>
          <p className="text-2xl font-semibold text-stone-800">₹{totalExpense.toLocaleString('en-IN')}</p>
          <p className="text-xs text-stone-500 mt-1">Total spent</p>
        </Card>

        <Card padding="md">
          <div className="flex items-center justify-between mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50">
              <Wallet className="h-5 w-5 text-brand-600" />
            </div>
            <span className={`text-xs ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {balance >= 0 ? 'Surplus' : 'Deficit'}
            </span>
          </div>
          <p className={`text-2xl font-semibold ${balance >= 0 ? 'text-stone-800' : 'text-red-600'}`}>
            ₹{Math.abs(balance).toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-stone-500 mt-1">Balance for {periodLabel}</p>
        </Card>
      </div>

      {/* Year-wise income & expense */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card padding="md" className="lg:col-span-2">
          <h3 className="text-base font-semibold text-stone-800">{year === 'all' ? 'Income & expenses by year' : `Income & expenses by month — ${year}`}</h3>
          <div className="mt-3 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
                <Tooltip formatter={(v) => inr(Number(v))} />
                <Legend />
                <Bar dataKey="Income" fill="#1f6b4f" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Expense" fill="#b8963e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card padding="md">
          <h3 className="text-base font-semibold text-stone-800">Where the money went</h3>
          <p className="text-xs text-stone-400">Expenses by category · {periodLabel}</p>
          {expenseByCategory.length === 0 ? (
            <p className="py-10 text-center text-sm text-stone-400">No expenses recorded</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {expenseByCategory.map((c) => (
                <li key={c.name}>
                  <div className="flex justify-between text-sm"><span className="truncate text-stone-700">{c.name}</span><span className="font-medium text-stone-800">{inr(c.value)}</span></div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-gold-500" style={{ width: `${(c.value / maxCat) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming events */}
        <div className="lg:col-span-2">
          <Card padding="none">
            <div className="p-5 border-b border-stone-200">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-stone-800">Upcoming Events</h3>
                <button onClick={() => navigate('/events')} className="text-xs font-medium text-brand-600 hover:text-brand-700 flex items-center gap-1">
                  View all <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
            {upcoming.length === 0 ? (
              <EmptyState
                icon={<CalendarDays className="h-10 w-10" />}
                title="No upcoming events"
                description={canCreateEvent(activeCommittee.role) ? 'Create a new event to start planning.' : 'Upcoming events will appear here.'}
                action={canCreateEvent(activeCommittee.role) ? <Button size="sm" onClick={() => navigate('/events')}><Plus className="h-3.5 w-3.5" /> Create event</Button> : undefined}
              />
            ) : (
              <div className="divide-y divide-stone-100">
                {upcoming.map((event) => {
                  const si = statusInfo(event.status);
                  return (
                    <button
                      key={event.id}
                      onClick={() => navigate(`/event/${event.id}`)}
                      className="w-full flex items-center gap-4 p-4 hover:bg-stone-50 transition-colors text-left"
                    >
                      <div className="flex flex-col items-center justify-center w-12 h-12 rounded-lg bg-brand-50 text-brand-700">
                        <span className="text-xs font-medium">{new Date(event.start_date).toLocaleString('en-IN', { month: 'short' })}</span>
                        <span className="text-lg font-semibold leading-none">{new Date(event.start_date).getDate()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-stone-800 truncate">{event.name}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-stone-400">
                          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {event.venue || 'No venue'}</span>
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {event.event_type}</span>
                        </div>
                      </div>
                      <Badge color={(si?.color as any) || 'gray'} dot>{si?.label || event.status}</Badge>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Pending tasks */}
        <div>
          <Card padding="none">
            <div className="p-5 border-b border-stone-200">
              <h3 className="text-base font-semibold text-stone-800">Pending Tasks</h3>
            </div>
            {pendingTasks.length === 0 ? (
              <EmptyState
                icon={<CheckSquare className="h-10 w-10" />}
                title="No pending tasks"
                description="All tasks are completed."
              />
            ) : (
              <div className="divide-y divide-stone-100">
                {pendingTasks.slice(0, 6).map((task) => (
                  <div key={task.id} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-stone-700">{task.title}</p>
                      <Badge color={task.priority === 'urgent' ? 'red' : task.priority === 'high' ? 'amber' : 'gray'}>
                        {task.priority}
                      </Badge>
                    </div>
                    <p className="text-xs text-stone-400 mt-1 truncate">
                      {(task as any).event?.name || '—'}
                    </p>
                    {task.due_date && (
                      <p className="text-xs text-stone-400 mt-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Due {new Date(task.due_date).toLocaleDateString('en-IN')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Recent finance activity */}
      <Card padding="none">
        <div className="p-5 border-b border-stone-200">
          <h3 className="text-base font-semibold text-stone-800">Recent Finance Activity · {periodLabel}</h3>
        </div>
        {recent.length === 0 ? (
          <EmptyState
            icon={<Wallet className="h-10 w-10" />}
            title={`No finance records for ${periodLabel}`}
            description="Add income or expenses from an event's finance module."
          />
        ) : (
          <div className="divide-y divide-stone-100">
            {recent.map((f) => (
              <div key={f.id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    f.type === 'income' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                  }`}>
                    {f.type === 'income' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-stone-700">{f.category}</p>
                    <p className="text-xs text-stone-400">
                      {eventName.get(f.event_id) || '—'} · {new Date(f.date).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                </div>
                <p className={`text-sm font-semibold ${f.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                  {f.type === 'income' ? '+' : '−'} ₹{Number(f.amount).toLocaleString('en-IN')}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

