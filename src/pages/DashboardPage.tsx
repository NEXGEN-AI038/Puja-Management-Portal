import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { canCreateEvent } from '@/lib/permissions';
import { useRouter } from '@/lib/router';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingOverlay, EmptyState } from '@/components/ui/Feedback';
import {
  CalendarDays, Wallet, TrendingUp, TrendingDown, CheckSquare,
  ArrowRight, Plus, MapPin, Clock,
} from 'lucide-react';
import type { EventItem, EventTask, EventFinance } from '@/types';
import { EVENT_STATUSES } from '@/types';

export function DashboardPage() {
  const { activeCommittee } = useAuth();
  const { navigate } = useRouter();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [tasks, setTasks] = useState<EventTask[]>([]);
  const [finance, setFinance] = useState<EventFinance[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!activeCommittee) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [eventsRes, tasksRes, financeRes] = await Promise.all([
      supabase
        .from('events')
        .select('*')
        .eq('committee_id', activeCommittee.id)
        .order('start_date', { ascending: true }),
      supabase
        .from('event_tasks')
        .select('*, event:events(id, name)')
        .in('event_id', (await supabase.from('events').select('id').eq('committee_id', activeCommittee.id)).data?.map((e: any) => e.id) || [])
        .order('due_date', { ascending: true })
        .limit(10),
      supabase
        .from('event_finance')
        .select('*, event:events(id, name)')
        .in('event_id', (await supabase.from('events').select('id').eq('committee_id', activeCommittee.id)).data?.map((e: any) => e.id) || [])
        .order('date', { ascending: false })
        .limit(10),
    ]);

    setEvents((eventsRes.data as EventItem[]) || []);
    setTasks((tasksRes.data as any[]) || []);
    setFinance((financeRes.data as any[]) || []);
    setLoading(false);
  }, [activeCommittee]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
  const totalIncome = finance.filter((f) => f.type === 'income').reduce((sum, f) => sum + Number(f.amount), 0);
  const totalExpense = finance.filter((f) => f.type === 'expense').reduce((sum, f) => sum + Number(f.amount), 0);
  const balance = totalIncome - totalExpense;

  const statusInfo = (status: string) => EVENT_STATUSES.find((s) => s.value === status);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-stone-800">{activeCommittee.name}</h1>
          <p className="text-sm text-stone-500 mt-0.5">Dashboard overview</p>
        </div>
        {canCreateEvent(activeCommittee.role) && (
          <Button onClick={() => navigate('/events')}>
            <Plus className="h-4 w-4" /> New Event
          </Button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card padding="md">
          <div className="flex items-center justify-between mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
              <CalendarDays className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-xs text-stone-400">Total</span>
          </div>
          <p className="text-2xl font-semibold text-stone-800">{events.length}</p>
          <p className="text-xs text-stone-500 mt-1">Events</p>
        </Card>

        <Card padding="md">
          <div className="flex items-center justify-between mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-xs text-stone-400">Collections</span>
          </div>
          <p className="text-2xl font-semibold text-stone-800">₹{totalIncome.toLocaleString('en-IN')}</p>
          <p className="text-xs text-stone-500 mt-1">Total income</p>
        </Card>

        <Card padding="md">
          <div className="flex items-center justify-between mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50">
              <TrendingDown className="h-5 w-5 text-red-600" />
            </div>
            <span className="text-xs text-stone-400">Expenses</span>
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
          <p className="text-xs text-stone-500 mt-1">Current balance</p>
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
          <h3 className="text-base font-semibold text-stone-800">Recent Finance Activity</h3>
        </div>
        {finance.length === 0 ? (
          <EmptyState
            icon={<Wallet className="h-10 w-10" />}
            title="No finance records yet"
            description="Add income or expenses from an event's finance module."
          />
        ) : (
          <div className="divide-y divide-stone-100">
            {finance.slice(0, 5).map((f) => (
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
                      {(f as any).event?.name} · {new Date(f.date).toLocaleDateString('en-IN')}
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

import { Building2 } from 'lucide-react';
