import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Table } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/Feedback';
import { StatCard, label } from './ModuleCrud';
import { PAYMENT_METHODS } from '@/types';
import type { PaymentMethod } from '@/types';
import { HandHeart, Plus, Printer, Lock } from 'lucide-react';

const inr = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const VIEW_ROLES = ['Platform Owner', 'Committee Admin', 'Treasurer', 'Auditor/Viewer'];
const WRITE_ROLES = ['Platform Owner', 'Committee Admin', 'Treasurer'];

interface Contribution {
  id: string; kind: 'donation' | 'sponsorship'; contributor_name: string; phone: string | null; email: string | null;
  sponsor_tier: string | null; flat_no: string | null; tower_phase: string | null; amount: number; status: 'pledged' | 'received' | 'void'; payment_method: PaymentMethod;
  reference_no: string | null; receipt_no: string | null; received_on: string | null; notes: string | null; finance_id: string | null;
  created_at: string;
}

export function DonationsTab({ eventId, eventName }: { eventId: string; eventName: string }) {
  const { activeCommittee } = useAuth();
  const role = activeCommittee?.role || '';
  const canView = VIEW_ROLES.includes(role);
  const canWrite = WRITE_ROLES.includes(role);

  const [rows, setRows] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<'donation' | 'sponsorship'>('donation');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [tier, setTier] = useState('');
  const [flatNo, setFlatNo] = useState('');
  const [towerPhase, setTowerPhase] = useState('');
  const [amount, setAmount] = useState('');
  const [received, setReceived] = useState(true);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [ref, setRef] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!canView) { setLoading(false); return; }
    const { data } = await supabase.from('event_contributions').select('*').eq('event_id', eventId).order('created_at', { ascending: false });
    setRows((data as Contribution[]) || []);
    setLoading(false);
  }, [eventId, canView]);
  useEffect(() => { load(); }, [load]);

  const today = () => new Date().toISOString().slice(0, 10);

  const addIncome = async (c: { kind: string; name: string; tier: string | null; flat: string | null; tower: string | null; amount: number; method: PaymentMethod; ref: string | null }) => {
    const { data, error } = await supabase.from('event_finance').insert({
      event_id: eventId, type: 'income', category: c.kind === 'sponsorship' ? 'Sponsorship' : 'Donation',
      description: c.tier ? `${c.name} (${c.tier})` : c.name, amount: c.amount, date: today(),
      payment_method: c.method, reference_no: c.ref,
      party_name: c.name, flat_no: c.flat, tower_phase: c.tower,
    }).select('id').single();
    if (error) throw error;
    return data.id as string;
  };

  const reset = () => { setKind('donation'); setName(''); setPhone(''); setTier(''); setFlatNo(''); setTowerPhase(''); setAmount(''); setReceived(true); setMethod('cash'); setRef(''); setNotes(''); setError(''); };

  const save = async () => {
    const amt = Number(amount);
    if (!name.trim() || !(amt > 0)) { setError('Name and an amount greater than zero are required'); return; }
    setSaving(true); setError('');
    try {
      const t = kind === 'sponsorship' && tier.trim() ? tier.trim() : null;
      const financeId = received ? await addIncome({ kind, name: name.trim(), tier: t, flat: flatNo.trim() || null, tower: towerPhase.trim() || null, amount: amt, method, ref: ref.trim() || null }) : null;
      const receiptNo = received ? `RCP-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}` : null;
      const { error } = await supabase.from('event_contributions').insert({
        event_id: eventId, kind, contributor_name: name.trim(), phone: phone.trim() || null, sponsor_tier: t, flat_no: flatNo.trim() || null, tower_phase: towerPhase.trim() || null, amount: amt,
        status: received ? 'received' : 'pledged', payment_method: method, reference_no: ref.trim() || null,
        receipt_no: receiptNo, received_on: received ? today() : null, notes: notes.trim() || null, finance_id: financeId,
      });
      if (error) {
        if (financeId) await supabase.from('event_finance').update({ status: 'void', void_reason: 'Contribution entry failed' }).eq('id', financeId);
        throw error;
      }
      setOpen(false); reset(); load();
    } catch (e: any) { setError(e.message || 'Could not save'); }
    finally { setSaving(false); }
  };

  const markReceived = async (c: Contribution) => {
    try {
      const financeId = await addIncome({ kind: c.kind, name: c.contributor_name, tier: c.sponsor_tier, flat: c.flat_no, tower: c.tower_phase, amount: Number(c.amount), method: c.payment_method, ref: c.reference_no });
      const { error } = await supabase.from('event_contributions').update({
        status: 'received', finance_id: financeId, received_on: today(),
        receipt_no: c.receipt_no || `RCP-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      }).eq('id', c.id);
      if (error) throw error;
      load();
    } catch (e: any) { window.alert(e.message); }
  };

  const voidIt = async (c: Contribution) => {
    const reason = window.prompt('Reason for voiding? (kept in the audit trail)');
    if (!reason?.trim()) return;
    const { error } = await supabase.from('event_contributions').update({ status: 'void', notes: [c.notes, `Void: ${reason.trim()}`].filter(Boolean).join(' | ') }).eq('id', c.id);
    if (error) { window.alert(error.message); return; }
    if (c.finance_id) await supabase.from('event_finance').update({ status: 'void', void_reason: reason.trim(), voided_at: new Date().toISOString() }).eq('id', c.finance_id);
    load();
  };

  const printReceipt = (c: Contribution) => {
    const w = window.open('', '_blank', 'width=720,height=640');
    if (!w) { window.alert('Allow pop-ups to print the receipt.'); return; }
    w.document.write(`<!doctype html><title>${esc(c.receipt_no || 'Receipt')}</title>
<style>body{font-family:Georgia,serif;margin:40px;color:#222}h1{color:#1f6b4f;margin:0}hr{border:0;border-top:2px solid #b8963e;margin:14px 0}
td{padding:6px 0;vertical-align:top}td:first-child{color:#666;width:170px}.amt{font-size:26px;color:#1f6b4f;font-weight:bold}
.foot{margin-top:50px;font-size:12px;color:#777;display:flex;justify-content:space-between}</style>
<h1>${esc(activeCommittee?.name || 'Committee')}</h1><div>${esc(eventName)}</div><hr>
<h2 style="margin:0 0 10px">${c.kind === 'sponsorship' ? 'Sponsorship' : 'Donation'} Receipt</h2>
<table><tr><td>Receipt no.</td><td>${esc(c.receipt_no || '—')}</td></tr>
<tr><td>Date</td><td>${esc(c.received_on || '')}</td></tr>
<tr><td>Received from</td><td>${esc(c.contributor_name)}${c.phone ? ' · ' + esc(c.phone) : ''}</td></tr>
${c.flat_no || c.tower_phase ? `<tr><td>Flat / Tower</td><td>${esc([c.flat_no && 'Flat ' + c.flat_no, c.tower_phase && 'Tower/Phase ' + c.tower_phase].filter(Boolean).join(' · '))}</td></tr>` : ''}
${c.sponsor_tier ? `<tr><td>Sponsorship tier</td><td>${esc(c.sponsor_tier)}</td></tr>` : ''}
<tr><td>Amount</td><td class="amt">${inr(Number(c.amount))}</td></tr>
<tr><td>Payment mode</td><td>${esc(label(c.payment_method))}${c.reference_no ? ' · Ref ' + esc(c.reference_no) : ''}</td></tr></table>
<div class="foot"><span>Thank you for your generous support.</span><span>Authorised signatory</span></div>
<script>window.onload=()=>window.print()</script>`);
    w.document.close();
  };

  if (!canView) {
    return <Card padding="lg"><EmptyState icon={<Lock className="h-10 w-10" />} title="Restricted" description="Donor details are visible to the Committee Admin, Treasurer and Auditor only." /></Card>;
  }
  if (loading) return <p className="py-6 text-sm text-stone-400">Loading…</p>;

  const live = rows.filter((r) => r.status !== 'void');
  const sum = (f: (r: Contribution) => boolean) => live.filter(f).reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Received" value={inr(sum((r) => r.status === 'received'))} />
        <StatCard label="Donations" value={inr(sum((r) => r.status === 'received' && r.kind === 'donation'))} />
        <StatCard label="Sponsorships" value={inr(sum((r) => r.status === 'received' && r.kind === 'sponsorship'))} />
        <StatCard label="Pledged, awaiting" value={inr(sum((r) => r.status === 'pledged'))} />
      </div>
      <Card>
        <CardHeader title="Donations & sponsorships" subtitle="Received amounts are added to Finance as income automatically"
          action={canWrite ? <Button size="sm" onClick={() => { reset(); setOpen(true); }}><Plus className="h-3.5 w-3.5" /> Record</Button> : undefined} />
        <Table
          columns={[
            { key: 'who', label: 'Contributor', render: (r: Contribution) => (
              <div><p className="font-medium text-stone-800">{r.contributor_name}</p>
                <p className="text-xs text-stone-400">{[r.flat_no && `Flat ${r.flat_no}`, r.tower_phase && `Tower/Phase ${r.tower_phase}`].filter(Boolean).join(' · ') || 'No flat details'}</p>
                <p className="text-xs text-stone-400">{r.receipt_no || 'No receipt yet'}{r.sponsor_tier ? ` · ${r.sponsor_tier}` : ''}</p></div>) },
            { key: 'kind', label: 'Type', render: (r: Contribution) => <Badge color={r.kind === 'sponsorship' ? 'gold' : 'blue'}>{label(r.kind)}</Badge> },
            { key: 'amount', label: 'Amount', render: (r: Contribution) => <span className={r.status === 'void' ? 'text-stone-400 line-through' : 'font-medium text-stone-800'}>{inr(Number(r.amount))}</span> },
            { key: 'mode', label: 'Mode', render: (r: Contribution) => <span className="text-xs uppercase text-stone-500">{r.payment_method}{r.reference_no ? ` · ${r.reference_no}` : ''}</span> },
            { key: 'status', label: 'Status', render: (r: Contribution) => <Badge color={r.status === 'received' ? 'green' : r.status === 'pledged' ? 'amber' : 'red'}>{label(r.status)}</Badge> },
            { key: 'act', label: '', render: (r: Contribution) => (
              <div className="flex items-center gap-3 text-xs">
                {r.status === 'received' && <button className="flex items-center gap-1 text-brand-700 hover:underline" onClick={() => printReceipt(r)}><Printer className="h-3 w-3" /> Receipt</button>}
                {canWrite && r.status === 'pledged' && <button className="text-brand-700 hover:underline" onClick={() => markReceived(r)}>Mark received</button>}
                {canWrite && r.status !== 'void' && <button className="text-stone-400 hover:text-red-600" onClick={() => voidIt(r)}>Void</button>}
              </div>) },
          ]}
          data={rows}
          rowKey={(r: Contribution) => r.id}
          emptyState={<EmptyState icon={<HandHeart className="h-10 w-10" />} title="Nothing recorded yet" description="Record donations and sponsorships to issue receipts." />}
        />
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Record contribution" size="md"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} loading={saving}>Save</Button></>}>
        {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label="Type" value={kind} onChange={(e) => setKind(e.target.value as any)}><option value="donation">Donation</option><option value="sponsorship">Sponsorship</option></Select>
          <Input label="Amount (₹) *" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Input label="Name *" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input label="Flat no." value={flatNo} onChange={(e) => setFlatNo(e.target.value)} placeholder="e.g. 304" />
          <Input label="Tower no. / Phase" value={towerPhase} onChange={(e) => setTowerPhase(e.target.value)} placeholder="e.g. Tower B / Phase 2" />
          {kind === 'sponsorship' && <Input label="Sponsorship tier" value={tier} onChange={(e) => setTier(e.target.value)} placeholder="Gold / Silver / Title sponsor" />}
          <Select label="Payment mode" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>{PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</Select>
          <Input label="Reference / UTR / cheque no." value={ref} onChange={(e) => setRef(e.target.value)} />
          <div className="sm:col-span-2"><Textarea label="Notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <label className="flex items-center gap-2 text-sm text-stone-700 sm:col-span-2">
            <input type="checkbox" checked={received} onChange={(e) => setReceived(e.target.checked)} className="h-4 w-4 rounded border-stone-300" />
            Payment already received (uncheck to record a pledge)
          </label>
        </div>
      </Modal>
    </div>
  );
}
