import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from '@/lib/router';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Table } from '@/components/ui/Table';
import { LoadingOverlay, EmptyState, Spinner } from '@/components/ui/Feedback';
import {
  ArrowLeft, CalendarDays, MapPin, Clock, Wallet, Truck, Users,
  CheckSquare, UserCheck, Utensils, Package, Bell, Settings,
  Plus, PiggyBank, HandHeart, TrendingUp, TrendingDown, Edit2, Trash2,
} from 'lucide-react';
import { ModuleCrud } from '@/components/modules/ModuleCrud';
import { MODULE_CONFIGS } from '@/components/modules/moduleConfigs';
import { BudgetTab } from '@/components/modules/BudgetTab';
import { DonationsTab } from '@/components/modules/DonationsTab';
import type { EventItem, EventModule, ModuleKey, EventFinance, EventTask, EventVendor, PaymentMethod } from '@/types';
import { MODULE_DEFINITIONS, EVENT_STATUSES, PAYMENT_METHODS } from '@/types';

const MODULE_ICONS: Record<string, any> = {
  finance: Wallet, vendors: Truck, schedule: Clock, tasks: CheckSquare,
  volunteers: Users, guest_management: UserCheck, bhog_prasad: Utensils,
  inventory: Package, notices: Bell, budget: PiggyBank, donations: HandHeart,
};

const VIEWER_MODULES = ['finance', 'budget', 'schedule', 'notices'];
const EDIT_ROLES = ['Platform Owner', 'Committee Admin', 'Event Manager'];
const MONEY_ROLES = ['Platform Owner', 'Committee Admin', 'Treasurer'];

export function EventDetailPage({ eventId, tab }: { eventId: string; tab?: string }) {
  const { activeCommittee } = useAuth();
  const { navigate } = useRouter();
  const [event, setEvent] = useState<EventItem | null>(null);
  const [modules, setModules] = useState<EventModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>(tab || 'overview');
  const [showEditModules, setShowEditModules] = useState(false);
  const [editModules, setEditModules] = useState<Record<string, boolean>>({});
  const [savingModules, setSavingModules] = useState(false);

  const loadEvent = useCallback(async () => {
    setLoading(true);
    const [eventRes, modulesRes] = await Promise.all([
      supabase.from('events').select('*').eq('id', eventId).maybeSingle(),
      supabase.from('event_modules').select('*').eq('event_id', eventId),
    ]);
    setEvent(eventRes.data as EventItem | null);
    setModules((modulesRes.data as EventModule[]) || []);
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    loadEvent();
  }, [loadEvent]);

  const role = activeCommittee?.role || '';
  const isViewer = role === 'Community Member';
  const canEditOps = EDIT_ROLES.includes(role);
  const canEditMoney = MONEY_ROLES.includes(role);
  const enabledModules = modules.filter((m) => m.enabled && (!isViewer || VIEWER_MODULES.includes(m.module_key)));
  const activeModule = enabledModules.find((m) => m.module_key === activeTab);

  const handleSaveModules = async () => {
    setSavingModules(true);
    try {
      for (const m of modules) {
        const newEnabled = editModules[m.module_key];
        if (newEnabled !== undefined && newEnabled !== m.enabled) {
          await supabase
            .from('event_modules')
            .update({ enabled: newEnabled })
            .eq('id', m.id);
        }
      }
      await loadEvent();
      setShowEditModules(false);
    } finally {
      setSavingModules(false);
    }
  };

  const openModuleEditor = () => {
    const map: Record<string, boolean> = {};
    modules.forEach((m) => { map[m.module_key] = m.enabled; });
    setEditModules(map);
    setShowEditModules(true);
  };

  if (loading) return <LoadingOverlay message="Loading event..." />;

  if (!event) {
    return (
      <EmptyState
        icon={<CalendarDays className="h-12 w-12" />}
        title="Event not found"
        description="This event may have been deleted."
        action={<Button onClick={() => navigate('/events')}>Back to events</Button>}
      />
    );
  }

  const si = EVENT_STATUSES.find((s) => s.value === event.status);

  const changeStatus = async (status: string) => {
    const { error } = await supabase.from('events').update({ status }).eq('id', event.id);
    if (error) { window.alert(error.message); return; }
    loadEvent();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Breadcrumb / back */}
      <button
        onClick={() => navigate('/events')}
        className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to events
      </button>

      {/* Event header */}
      <div className="card-base p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-serif font-semibold text-stone-800">{event.name}</h1>
              {canEditOps ? (
                <select
                  value={event.status}
                  onChange={(e) => changeStatus(e.target.value)}
                  aria-label="Event status"
                  className="cursor-pointer rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-medium text-stone-700 focus:outline-none focus:ring-2 focus:ring-brand-300"
                >
                  {EVENT_STATUSES.map((st) => <option key={st.value} value={st.value}>{st.label}</option>)}
                </select>
              ) : (
                <Badge color={(si?.color as any) || 'gray'} dot>{si?.label}</Badge>
              )}
            </div>
            <p className="text-sm text-brand-600 font-medium">{event.event_type}</p>
            <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-stone-500">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 text-stone-400" />
                {new Date(event.start_date).toLocaleDateString('en-IN')} — {new Date(event.end_date).toLocaleDateString('en-IN')}
              </span>
              {event.venue && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-stone-400" />
                  {event.venue}
                </span>
              )}
            </div>
            {event.description && (
              <p className="mt-3 text-sm text-stone-600 max-w-2xl">{event.description}</p>
            )}
          </div>
          {(role === 'Committee Admin' || role === 'Platform Owner') && (
            <Button variant="outline" size="sm" onClick={openModuleEditor}>
              <Settings className="h-4 w-4" /> Configure modules
            </Button>
          )}
        </div>
      </div>

      {/* Module tabs */}
      <div className="border-b border-stone-200">
        <div className="flex items-center gap-1 overflow-x-auto -mb-px">
          <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={CalendarDays} label="Overview" />
          {enabledModules.map((m) => {
            const Icon = MODULE_ICONS[m.module_key] || Package;
            return (
              <TabButton
                key={m.module_key}
                active={activeTab === m.module_key}
                onClick={() => setActiveTab(m.module_key)}
                icon={Icon}
                label={MODULE_DEFINITIONS.find((md) => md.key === m.module_key)?.label || m.module_key}
              />
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && <OverviewTab event={event} modules={enabledModules} />}
      {activeTab === 'finance' && <FinanceTab eventId={event.id} canWrite={canEditMoney} />}
      {MODULE_CONFIGS[activeTab] && activeModule && (
        <ModuleCrud key={activeTab} eventId={event.id} canEdit={canEditOps} {...MODULE_CONFIGS[activeTab]} />
      )}
      {activeTab === 'budget' && activeModule && <BudgetTab eventId={event.id} canEdit={canEditMoney} />}
      {activeTab === 'donations' && activeModule && <DonationsTab eventId={event.id} eventName={event.name} />}

      {/* Module config modal */}
      <Modal
        open={showEditModules}
        onClose={() => setShowEditModules(false)}
        title="Configure Event Modules"
        subtitle="Enable or disable modules for this event"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowEditModules(false)}>Cancel</Button>
            <Button onClick={handleSaveModules} loading={savingModules}>Save changes</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {MODULE_DEFINITIONS.map((m) => {
            const enabled = editModules[m.key] ?? false;
            const Icon = MODULE_ICONS[m.key] || Package;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setEditModules({ ...editModules, [m.key]: !enabled })}
                className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-all ${
                  enabled ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500/20' : 'border-stone-200 bg-white hover:border-stone-300'
                }`}
              >
                <div className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded ${enabled ? 'bg-brand-600 text-white' : 'bg-stone-200 text-transparent'}`}>
                  <CheckSquare className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-stone-400" />
                    <p className="text-sm font-medium text-stone-800">{m.label}</p>
                  </div>
                  <p className="text-xs text-stone-400 mt-0.5">{m.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
        active ? 'border-brand-600 text-brand-700' : 'border-transparent text-stone-500 hover:text-stone-700'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function OverviewTab({ event, modules }: { event: EventItem; modules: EventModule[] }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2">
        <CardHeader title="Event Details" />
        <dl className="space-y-3">
          <DetailRow label="Name" value={event.name} />
          <DetailRow label="Type" value={event.event_type} />
          <DetailRow label="Start date" value={new Date(event.start_date).toLocaleDateString('en-IN')} />
          <DetailRow label="End date" value={new Date(event.end_date).toLocaleDateString('en-IN')} />
          <DetailRow label="Venue" value={event.venue || '—'} />
          <DetailRow label="Description" value={event.description || '—'} />
        </dl>
      </Card>

      <Card>
        <CardHeader title="Enabled Modules" />
        <div className="space-y-2">
          {modules.length === 0 && <p className="text-sm text-stone-400">No modules enabled.</p>}
          {modules.map((m) => {
            const def = MODULE_DEFINITIONS.find((md) => md.key === m.module_key);
            const Icon = MODULE_ICONS[m.module_key] || Package;
            return (
              <div key={m.id} className="flex items-center gap-3 rounded-lg bg-stone-50 px-3 py-2.5">
                <Icon className="h-4 w-4 text-brand-600" />
                <span className="text-sm text-stone-700">{def?.label || m.module_key}</span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <dt className="text-stone-400">{label}</dt>
      <dd className="text-stone-700 text-right max-w-xs">{value}</dd>
    </div>
  );
}

// ===== Finance Tab =====
function FinanceTab({ eventId, canWrite }: { eventId: string; canWrite: boolean }) {
  const [records, setRecords] = useState<EventFinance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('event_finance')
      .select('*')
      .eq('event_id', eventId)
      .order('date', { ascending: false });
    setRecords((data as EventFinance[]) || []);
    setLoading(false);
  }, [eventId]);

  useEffect(() => { load(); }, [load]);

  const voidRecord = async (id: string) => {
    const reason = window.prompt('Reason for voiding this record? (kept in the audit trail)');
    if (!reason || !reason.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('event_finance').update({
      status: 'void', void_reason: reason.trim(), voided_at: new Date().toISOString(), voided_by: user?.id,
    }).eq('id', id);
    if (error) window.alert(error.message);
    load();
  };

  const live = records.filter((r) => r.status !== 'void');
  const income = live.filter((r) => r.type === 'income').reduce((s, r) => s + Number(r.amount), 0);
  const expense = live.filter((r) => r.type === 'expense').reduce((s, r) => s + Number(r.amount), 0);
  const balance = income - expense;

  if (loading) return <LoadingOverlay message="Loading finance..." />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card padding="md"><p className="text-xs text-stone-400">Income</p><p className="text-xl font-semibold text-green-600 mt-1">₹{income.toLocaleString('en-IN')}</p></Card>
        <Card padding="md"><p className="text-xs text-stone-400">Expense</p><p className="text-xl font-semibold text-red-600 mt-1">₹{expense.toLocaleString('en-IN')}</p></Card>
        <Card padding="md"><p className="text-xs text-stone-400">Balance</p><p className={`text-xl font-semibold mt-1 ${balance >= 0 ? 'text-stone-800' : 'text-red-600'}`}>₹{Math.abs(balance).toLocaleString('en-IN')}</p></Card>
      </div>

      <Card padding="none">
        <div className="flex items-center justify-between p-4 border-b border-stone-200">
          <h3 className="text-base font-semibold text-stone-800">Transactions</h3>
          {canWrite && <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-3.5 w-3.5" /> Add record</Button>}
        </div>
        {records.length === 0 ? (
          <EmptyState icon={<Wallet className="h-10 w-10" />} title="No finance records" description="Add income or expense entries." />
        ) : (
          <Table
            columns={[
              { key: 'date', label: 'Date', render: (r: EventFinance) => new Date(r.date).toLocaleDateString('en-IN') },
              { key: 'category', label: 'Category' },
              { key: 'description', label: 'Description', render: (r: EventFinance) => r.description || '—' },
              { key: 'party', label: 'Name / Flat', render: (r: EventFinance) => (
                <div>
                  <p className="text-stone-700">{r.party_name || '—'}</p>
                  {(r.flat_no || r.tower_phase) && <p className="text-xs text-stone-400">{[r.flat_no && `Flat ${r.flat_no}`, r.tower_phase && `Tower/Phase ${r.tower_phase}`].filter(Boolean).join(' · ')}</p>}
                </div>) },
              { key: 'type', label: 'Type', render: (r: EventFinance) => <Badge color={r.type === 'income' ? 'green' : 'red'}>{r.type}</Badge> },
              { key: 'payment_method', label: 'Mode', render: (r: EventFinance) => <span className="uppercase text-xs text-stone-500">{r.payment_method}{r.reference_no ? ` · ${r.reference_no}` : ''}</span> },
              { key: 'amount', label: 'Amount', render: (r: EventFinance) => (
                <span className={r.status === 'void' ? 'text-stone-400 line-through' : r.type === 'income' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                  {r.type === 'income' ? '+' : '−'} ₹{Number(r.amount).toLocaleString('en-IN')}
                </span>
              )},
              { key: 'status', label: '', render: (r: EventFinance) => r.status === 'void'
                ? <Badge color="red">Void</Badge>
                : canWrite ? <button className="text-xs text-stone-400 hover:text-red-600" onClick={() => voidRecord(r.id)}>Void</button> : null },
            ]}
            data={records}
            rowKey={(r) => r.id}
          />
        )}
      </Card>

      <AddFinanceModal open={showAdd} onClose={() => setShowAdd(false)} eventId={eventId} onAdded={() => { load(); setShowAdd(false); }} />
    </div>
  );
}

function AddFinanceModal({ open, onClose, eventId, onAdded }: { open: boolean; onClose: () => void; eventId: string; onAdded: () => void }) {
  const [type, setType] = useState<'income' | 'expense'>('income');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [referenceNo, setReferenceNo] = useState('');
  const [partyName, setPartyName] = useState('');
  const [flatNo, setFlatNo] = useState('');
  const [towerPhase, setTowerPhase] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAdd = async () => {
    if (!category.trim() || !amount) { setError('Category and amount are required'); return; }
    if (!(parseFloat(amount) > 0)) { setError('Amount must be greater than zero'); return; }
    setError(''); setLoading(true);
    try {
      const { error } = await supabase.from('event_finance').insert({
        event_id: eventId, type, category: category.trim(),
        description: description || null, amount: parseFloat(amount), date,
        payment_method: paymentMethod, reference_no: referenceNo.trim() || null,
        party_name: partyName.trim() || null, flat_no: flatNo.trim() || null, tower_phase: towerPhase.trim() || null,
      });
      if (error) throw error;
      setCategory(''); setDescription(''); setAmount(''); setReferenceNo(''); setPaymentMethod('cash'); setPartyName(''); setFlatNo(''); setTowerPhase('');
      onAdded();
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Finance Record" size="md"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={handleAdd} loading={loading}><Plus className="h-4 w-4" /> Add</Button></>}>
      {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <div className="space-y-4">
        <Select label="Type" value={type} onChange={(e) => setType(e.target.value as any)}>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </Select>
        <Input label="Category *" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Donations, Decoration" />
        <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Amount (₹) *" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select label="Payment mode" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
            {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </Select>
          <Input label="Reference / UTR / cheque no." value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} placeholder="Optional" />
        </div>
        <Input label={type === 'income' ? 'Name (received from)' : 'Name (paid to)'} value={partyName} onChange={(e) => setPartyName(e.target.value)} placeholder="Full name" />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Flat no." value={flatNo} onChange={(e) => setFlatNo(e.target.value)} placeholder="e.g. 304" />
          <Input label="Tower no. / Phase" value={towerPhase} onChange={(e) => setTowerPhase(e.target.value)} placeholder="e.g. Tower B / Phase 2" />
        </div>
      </div>
    </Modal>
  );
}
