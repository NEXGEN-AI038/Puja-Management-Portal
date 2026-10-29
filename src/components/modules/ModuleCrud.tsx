import { useCallback, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Table } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/Feedback';
import { Plus, Trash2, Pencil } from 'lucide-react';

export interface FieldDef {
  key: string;
  label: string;
  type?: 'text' | 'textarea' | 'number' | 'date' | 'time' | 'select' | 'checkbox' | 'email' | 'tel';
  options?: string[];
  required?: boolean;
  full?: boolean;
  placeholder?: string;
  defaultValue?: string | number | boolean;
}

export interface ColumnDef {
  key: string;
  label: string;
  status?: boolean;
  render?: (row: any) => ReactNode;
}

export interface ModuleCrudProps {
  eventId: string;
  table: string;
  title: string;
  subtitle?: string;
  noun: string;
  icon?: ReactNode;
  fields: FieldDef[];
  columns: ColumnDef[];
  sort?: (a: any, b: any) => number;
  canEdit: boolean;
  summary?: (rows: any[]) => ReactNode;
}

export const label = (v: string) => v.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

export function statusColor(v: string): 'green' | 'amber' | 'red' | 'blue' | 'gray' {
  if (['completed', 'confirmed', 'received', 'ready', 'checked_in', 'allocated', 'distributing', 'vip'].includes(v)) return 'green';
  if (['pending', 'planned', 'needed', 'assigned', 'preparing', 'ordered', 'in_progress', 'reminder', 'high'].includes(v)) return 'amber';
  if (['cancelled', 'declined', 'blocked', 'urgent'].includes(v)) return 'red';
  if (['announcement', 'speaker', 'performer', 'medium'].includes(v)) return 'blue';
  return 'gray';
}

const SELECT_TONE: Record<string, string> = {
  green: 'border-green-200 bg-green-50 text-green-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  red: 'border-red-200 bg-red-50 text-red-700',
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
  gray: 'border-stone-200 bg-stone-50 text-stone-600',
};

/** Badge-looking dropdown so a status can be changed in one click. */
export function StatusSelect({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value)}
      className={`cursor-pointer rounded-full border px-2.5 py-0.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-300 ${SELECT_TONE[statusColor(value)]}`}
    >
      {options.map((o) => <option key={o} value={o}>{label(o)}</option>)}
    </select>
  );
}

export function StatCard({ label: l, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{l}</p>
      <p className="mt-1 text-xl font-semibold text-stone-800">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-stone-400">{hint}</p>}
    </div>
  );
}

function initialForm(fields: FieldDef[], row?: any) {
  const f: Record<string, any> = {};
  for (const fd of fields) {
    if (row) {
      const v = row[fd.key];
      f[fd.key] = fd.type === 'checkbox' ? !!v : v == null ? '' : fd.type === 'time' ? String(v).slice(0, 5) : v;
    } else {
      f[fd.key] = fd.defaultValue ?? (fd.type === 'checkbox' ? false : fd.type === 'select' ? fd.options?.[0] ?? '' : '');
    }
  }
  return f;
}

export function ModuleCrud({ eventId, table, title, subtitle, noun, icon, fields, columns, sort, canEdit, summary }: ModuleCrudProps) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | 'new' | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase.from(table).select('*').eq('event_id', eventId).order('created_at', { ascending: false });
    const list = (data as any[]) || [];
    setRows(sort ? [...list].sort(sort) : list);
    setLoading(false);
  }, [table, eventId, sort]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setForm(initialForm(fields)); setError(''); setEditing('new'); };
  const openEdit = (row: any) => { if (!canEdit) return; setForm(initialForm(fields, row)); setError(''); setEditing(row); };

  const save = async () => {
    for (const f of fields) {
      if (f.required && (form[f.key] === '' || form[f.key] == null)) { setError(`${f.label} is required`); return; }
    }
    const payload: Record<string, any> = {};
    for (const f of fields) {
      const v = form[f.key];
      if (f.type === 'number') payload[f.key] = v === '' ? null : Number(v);
      else if (f.type === 'checkbox') payload[f.key] = !!v;
      else payload[f.key] = v === '' ? null : typeof v === 'string' ? v.trim() : v;
    }
    setSaving(true); setError('');
    const res = editing === 'new'
      ? await supabase.from(table).insert({ ...payload, event_id: eventId })
      : await supabase.from(table).update(payload).eq('id', (editing as any).id);
    setSaving(false);
    if (res.error) { setError(res.error.message); return; }
    setEditing(null);
    load();
  };

  const remove = async () => {
    if (editing === 'new' || !editing) return;
    if (!window.confirm(`Delete this ${noun}? This cannot be undone.`)) return;
    const { error } = await supabase.from(table).delete().eq('id', (editing as any).id);
    if (error) { setError(error.message); return; }
    setEditing(null);
    load();
  };

  const quickSet = async (id: string, key: string, value: string) => {
    const { error } = await supabase.from(table).update({ [key]: value }).eq('id', id);
    if (error) window.alert(error.message);
    load();
  };

  const cols = columns.map((c) => ({
    key: c.key,
    label: c.label,
    render: (r: any) =>
      c.render ? c.render(r)
      : c.status && canEdit && fields.find((f) => f.key === c.key)?.options && r[c.key]
        ? <StatusSelect value={r[c.key]} options={fields.find((f) => f.key === c.key)!.options!} onChange={(v) => quickSet(r.id, c.key, v)} />
      : c.status ? (r[c.key] ? <Badge color={statusColor(r[c.key])}>{label(String(r[c.key]))}</Badge> : null)
      : <span className="text-stone-700">{r[c.key] ?? '—'}</span>,
  }));
  if (canEdit) cols.push({ key: '_edit', label: '', render: () => <Pencil className="h-3.5 w-3.5 text-stone-300" /> });

  return (
    <div className="space-y-4">
      {summary && !loading && summary(rows)}
      <Card>
        <CardHeader
          title={title}
          subtitle={subtitle}
          action={canEdit ? <Button size="sm" onClick={openNew}><Plus className="h-3.5 w-3.5" /> Add {noun}</Button> : undefined}
        />
        {loading ? <p className="py-6 text-sm text-stone-400">Loading…</p> : (
          <Table
            columns={cols}
            data={rows}
            rowKey={(r: any) => r.id}
            onRowClick={canEdit ? openEdit : undefined}
            emptyState={<EmptyState icon={icon} title={`No ${noun}s yet`} description={canEdit ? `Add your first ${noun} to get started.` : `Nothing has been added yet.`} />}
          />
        )}
      </Card>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? `Add ${noun}` : `Edit ${noun}`}
        size="md"
        footer={
          <>
            {editing && editing !== 'new' && (
              <Button variant="ghost" onClick={remove}><Trash2 className="h-4 w-4 text-red-600" /> Delete</Button>
            )}
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} loading={saving}>{editing === 'new' ? 'Add' : 'Save'}</Button>
          </>
        }
      >
        {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fields.map((f) => {
            const wrap = (node: ReactNode) => <div key={f.key} className={f.full || f.type === 'textarea' ? 'sm:col-span-2' : ''}>{node}</div>;
            const set = (v: any) => setForm((p) => ({ ...p, [f.key]: v }));
            const lbl = f.label + (f.required ? ' *' : '');
            if (f.type === 'textarea') return wrap(<Textarea label={lbl} value={form[f.key] ?? ''} onChange={(e) => set(e.target.value)} rows={3} />);
            if (f.type === 'select') return wrap(
              <Select label={lbl} value={form[f.key] ?? ''} onChange={(e) => set(e.target.value)}>
                {f.options?.map((o) => <option key={o} value={o}>{label(o)}</option>)}
              </Select>);
            if (f.type === 'checkbox') return wrap(
              <label className="flex items-center gap-2 pt-6 text-sm text-stone-700">
                <input type="checkbox" checked={!!form[f.key]} onChange={(e) => set(e.target.checked)} className="h-4 w-4 rounded border-stone-300" />
                {f.label}
              </label>);
            return wrap(<Input label={lbl} type={f.type || 'text'} value={form[f.key] ?? ''} placeholder={f.placeholder} onChange={(e) => set(e.target.value)} />);
          })}
        </div>
      </Modal>
    </div>
  );
}
