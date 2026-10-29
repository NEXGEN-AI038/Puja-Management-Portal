import { useCallback, useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/Feedback';
import { StatCard } from './ModuleCrud';
import { PiggyBank, Plus } from 'lucide-react';

const inr = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
const SUGGESTED = ['Pandal & Decoration', 'Idol / Murti', 'Priest & Puja Samagri', 'Food & Bhog', 'Sound & Lighting', 'Cultural Programme', 'Printing & Publicity', 'Transport', 'Security & Volunteers', 'Miscellaneous'];

interface Budget { id: string; category: string; planned_amount: number; notes: string | null }

export function BudgetTab({ eventId, canEdit }: { eventId: string; canEdit: boolean }) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [expenses, setExpenses] = useState<{ category: string; amount: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Budget | 'new' | null>(null);
  const [category, setCategory] = useState('');
  const [planned, setPlanned] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [b, f] = await Promise.all([
      supabase.from('event_budgets').select('*').eq('event_id', eventId).order('category'),
      supabase.from('event_finance').select('category,amount').eq('event_id', eventId).eq('type', 'expense').neq('status', 'void'),
    ]);
    setBudgets((b.data as Budget[]) || []);
    setExpenses((f.data as any[]) || []);
    setLoading(false);
  }, [eventId]);
  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    const spent = new Map<string, number>();
    for (const e of expenses) {
      const k = e.category.trim().toLowerCase();
      spent.set(k, (spent.get(k) || 0) + Number(e.amount));
    }
    const planned = budgets.map((b) => ({ ...b, actual: spent.get(b.category.trim().toLowerCase()) || 0 }));
    const known = new Set(budgets.map((b) => b.category.trim().toLowerCase()));
    const unbudgeted = [...spent.entries()].filter(([k]) => !known.has(k)).reduce((s, [, v]) => s + v, 0);
    return { planned, unbudgeted };
  }, [budgets, expenses]);

  const totalPlanned = budgets.reduce((s, b) => s + Number(b.planned_amount), 0);
  const totalActual = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const pct = totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0;

  const open = (b: Budget | 'new') => {
    setEditing(b); setError('');
    setCategory(b === 'new' ? '' : b.category);
    setPlanned(b === 'new' ? '' : String(b.planned_amount));
    setNotes(b === 'new' ? '' : b.notes || '');
  };

  const save = async () => {
    if (!category.trim() || planned === '' || Number(planned) < 0) { setError('Category and a valid planned amount are required'); return; }
    setSaving(true); setError('');
    const payload = { category: category.trim(), planned_amount: Number(planned), notes: notes.trim() || null };
    const res = editing === 'new'
      ? await supabase.from('event_budgets').insert({ ...payload, event_id: eventId })
      : await supabase.from('event_budgets').update(payload).eq('id', (editing as Budget).id);
    setSaving(false);
    if (res.error) { setError(res.error.code === '23505' ? 'This category already has a budget line.' : res.error.message); return; }
    setEditing(null); load();
  };

  const remove = async () => {
    if (editing === 'new' || !editing || !window.confirm('Delete this budget line?')) return;
    await supabase.from('event_budgets').delete().eq('id', editing.id);
    setEditing(null); load();
  };

  if (loading) return <p className="py-6 text-sm text-stone-400">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Planned budget" value={inr(totalPlanned)} />
        <StatCard label="Spent so far" value={inr(totalActual)} hint={totalPlanned ? `${pct}% of plan` : undefined} />
        <StatCard label="Remaining" value={<span className={totalPlanned - totalActual < 0 ? 'text-red-600' : 'text-brand-700'}>{inr(totalPlanned - totalActual)}</span>} />
        <StatCard label="Unbudgeted spend" value={inr(rows.unbudgeted)} hint="Expenses in categories with no budget line" />
      </div>

      {rows.planned.length > 0 && (
        <Card>
          <CardHeader title="Planned vs actual" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows.planned.map((r) => ({ name: r.category, Planned: Number(r.planned_amount), Actual: r.actual }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
                <Tooltip formatter={(v) => inr(Number(v))} />
                <Legend />
                <Bar dataKey="Planned" fill="#b8963e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Actual" fill="#1f6b4f" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Budget lines" subtitle="Actual spend comes from expense records in Finance, matched by category"
          action={canEdit ? <Button size="sm" onClick={() => open('new')}><Plus className="h-3.5 w-3.5" /> Add budget line</Button> : undefined} />
        {rows.planned.length === 0 ? (
          <EmptyState icon={<PiggyBank className="h-10 w-10" />} title="No budget yet" description="Add a budget line for each spending category." />
        ) : (
          <ul className="divide-y divide-stone-100">
            {rows.planned.map((r) => {
              const p = Number(r.planned_amount);
              const ratio = p > 0 ? r.actual / p : 0;
              return (
                <li key={r.id} className={`py-3 ${canEdit ? 'cursor-pointer hover:bg-stone-50' : ''}`} onClick={() => canEdit && open(r)}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-stone-800">{r.category}</span>
                    <span className="text-stone-600">{inr(r.actual)} <span className="text-stone-400">of {inr(p)}</span></span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100">
                    <div className={`h-full rounded-full ${ratio > 1 ? 'bg-red-500' : ratio > 0.85 ? 'bg-amber-500' : 'bg-brand-600'}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
                  </div>
                  {ratio > 1 && <p className="mt-1 text-xs text-red-600">Over budget by {inr(r.actual - p)}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add budget line' : 'Edit budget line'} size="md"
        footer={<>
          {editing && editing !== 'new' && <Button variant="ghost" onClick={remove}>Delete</Button>}
          <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
          <Button onClick={save} loading={saving}>Save</Button></>}>
        {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <div className="space-y-4">
          <div>
            <Input label="Category *" value={category} onChange={(e) => setCategory(e.target.value)} list="budget-cats" placeholder="e.g. Food & Bhog" />
            <datalist id="budget-cats">{SUGGESTED.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <Input label="Planned amount (₹) *" type="number" value={planned} onChange={(e) => setPlanned(e.target.value)} />
          <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
      </Modal>
    </div>
  );
}
