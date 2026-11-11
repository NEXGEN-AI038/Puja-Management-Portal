import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, LoadingOverlay } from '@/components/ui/Feedback';
import { Landmark, Plus, Phone, Mail, Home, Pencil, Trash2 } from 'lucide-react';

const DESIGNATIONS = ['President', 'Vice President', 'Chairman', 'Vice Chairman', 'Secretary', 'Joint Secretary', 'Treasurer', 'Joint Treasurer', 'Executive Member', 'Other'];
const KEY_POSTS = ['President', 'Chairman', 'Secretary', 'Treasurer'];
const MANAGE_ROLES = ['Platform Owner', 'Committee Admin'];

interface Core {
  id: string; name: string; designation: string; custom_title: string | null;
  phone: string | null; email: string | null; flat_no: string | null; tower_phase: string | null; term: string | null;
}
const EMPTY = { name: '', designation: 'President', custom_title: '', phone: '', email: '', flat_no: '', tower_phase: '', term: '' };

const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');

export function CoreCommitteePage() {
  const { activeCommittee } = useAuth();
  const canManage = !!activeCommittee && MANAGE_ROLES.includes(activeCommittee.role);
  const [rows, setRows] = useState<Core[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Core | 'new' | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!activeCommittee) return;
    const { data } = await supabase.from('committee_core_members').select('*').eq('committee_id', activeCommittee.id);
    const list = (data as Core[]) || [];
    list.sort((a, b) => DESIGNATIONS.indexOf(a.designation) - DESIGNATIONS.indexOf(b.designation) || a.name.localeCompare(b.name));
    setRows(list);
    setLoading(false);
  }, [activeCommittee]);
  useEffect(() => { load(); }, [load]);

  const open = (r: Core | 'new') => {
    setError('');
    setEditing(r);
    setForm(r === 'new' ? EMPTY : {
      name: r.name, designation: r.designation, custom_title: r.custom_title || '', phone: r.phone || '',
      email: r.email || '', flat_no: r.flat_no || '', tower_phase: r.tower_phase || '', term: r.term || '',
    });
  };
  const set = (k: keyof typeof EMPTY, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    if (form.designation === 'Other' && !form.custom_title.trim()) { setError('Enter the title for this member'); return; }
    setSaving(true); setError('');
    const payload = {
      name: form.name.trim(), designation: form.designation,
      custom_title: form.designation === 'Other' ? form.custom_title.trim() : null,
      phone: form.phone.trim() || null, email: form.email.trim() || null,
      flat_no: form.flat_no.trim() || null, tower_phase: form.tower_phase.trim() || null, term: form.term.trim() || null,
    };
    const res = editing === 'new'
      ? await supabase.from('committee_core_members').insert({ ...payload, committee_id: activeCommittee!.id })
      : await supabase.from('committee_core_members').update(payload).eq('id', (editing as Core).id);
    setSaving(false);
    if (res.error) { setError(res.error.message); return; }
    setEditing(null); load();
  };

  const remove = async () => {
    if (editing === 'new' || !editing || !window.confirm(`Remove ${editing.name} from the core committee?`)) return;
    const { error } = await supabase.from('committee_core_members').delete().eq('id', editing.id);
    if (error) { setError(error.message); return; }
    setEditing(null); load();
  };

  if (loading) return <LoadingOverlay message="Loading core committee..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-stone-800">Core Committee</h1>
          <p className="mt-0.5 text-sm text-stone-500">The office bearers of {activeCommittee?.name}</p>
        </div>
        {canManage && <Button onClick={() => open('new')}><Plus className="h-4 w-4" /> Add member</Button>}
      </div>

      {rows.length === 0 ? (
        <Card padding="lg">
          <EmptyState icon={<Landmark className="h-10 w-10" />} title="No core committee members yet"
            description={canManage ? 'Add the President, Secretary, Treasurer, Chairman and other office bearers.' : 'The committee admin has not added the office bearers yet.'}
            action={canManage ? <Button size="sm" onClick={() => open('new')}><Plus className="h-3.5 w-3.5" /> Add member</Button> : undefined} />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <Card key={r.id} padding="md" className="relative">
              {canManage && (
                <button onClick={() => open(r)} aria-label={`Edit ${r.name}`} className="absolute right-3 top-3 rounded p-1 text-stone-300 hover:bg-stone-100 hover:text-stone-600">
                  <Pencil className="h-4 w-4" />
                </button>
              )}
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-50 text-base font-semibold text-brand-700">{initials(r.name)}</div>
                <div className="min-w-0">
                  <p className="truncate font-medium text-stone-800">{r.name}</p>
                  <Badge color={KEY_POSTS.includes(r.designation) ? 'gold' : 'gray'}>{r.designation === 'Other' ? r.custom_title : r.designation}</Badge>
                </div>
              </div>
              <div className="mt-4 space-y-1.5 text-sm text-stone-600">
                {r.phone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-stone-400" /><a href={`tel:${r.phone}`} className="hover:text-brand-700">{r.phone}</a></p>}
                {r.email && <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-stone-400" /><a href={`mailto:${r.email}`} className="truncate hover:text-brand-700">{r.email}</a></p>}
                {(r.flat_no || r.tower_phase) && <p className="flex items-center gap-2"><Home className="h-3.5 w-3.5 text-stone-400" />{[r.flat_no && `Flat ${r.flat_no}`, r.tower_phase && `Tower/Phase ${r.tower_phase}`].filter(Boolean).join(' · ')}</p>}
                {r.term && <p className="text-xs text-stone-400">Term: {r.term}</p>}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add core committee member' : 'Edit member'} size="md"
        footer={<>
          {editing && editing !== 'new' && <Button variant="ghost" onClick={remove}><Trash2 className="h-4 w-4 text-red-600" /> Remove</Button>}
          <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
          <Button onClick={save} loading={saving}>{editing === 'new' ? 'Add' : 'Save'}</Button></>}>
        {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Input label="Name *" value={form.name} onChange={(e) => set('name', e.target.value)} /></div>
          <Select label="Designation" value={form.designation} onChange={(e) => set('designation', e.target.value)}>
            {DESIGNATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
          </Select>
          {form.designation === 'Other'
            ? <Input label="Title *" value={form.custom_title} onChange={(e) => set('custom_title', e.target.value)} placeholder="e.g. Cultural Secretary" />
            : <Input label="Term" value={form.term} onChange={(e) => set('term', e.target.value)} placeholder="e.g. 2026–2028" />}
          <Input label="Phone" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          <Input label="Email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          <Input label="Flat no." value={form.flat_no} onChange={(e) => set('flat_no', e.target.value)} />
          <Input label="Tower no. / Phase" value={form.tower_phase} onChange={(e) => set('tower_phase', e.target.value)} />
          {form.designation === 'Other' && <div className="sm:col-span-2"><Input label="Term" value={form.term} onChange={(e) => set('term', e.target.value)} placeholder="e.g. 2026–2028" /></div>}
        </div>
        <p className="mt-4 text-xs text-stone-400">Everyone in the committee can see these details, including view-only members.</p>
      </Modal>
    </div>
  );
}
