import { Badge } from '@/components/ui/Badge';
import { Clock, Users, UserCheck, Utensils, Package, Bell, CheckSquare, Truck } from 'lucide-react';
import { StatCard, label, statusColor } from './ModuleCrud';
import type { ModuleCrudProps } from './ModuleCrud';

type Cfg = Omit<ModuleCrudProps, 'eventId' | 'canEdit'>;

const inr = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
const hm = (t?: string | null) => (t ? String(t).slice(0, 5) : '');
const fmtDate = (d?: string | null) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

const today = () => new Date().toISOString().slice(0, 10);

export const MODULE_CONFIGS: Record<string, Cfg> = {
  tasks: {
    table: 'event_tasks', title: 'Tasks', subtitle: 'Click a status to change it, or open a task to edit it', noun: 'task',
    icon: <CheckSquare className="h-10 w-10" />,
    sort: (a, b) => (a.status === 'completed' ? 1 : 0) - (b.status === 'completed' ? 1 : 0) || (a.due_date || '9999').localeCompare(b.due_date || '9999'),
    fields: [
      { key: 'title', label: 'Task', required: true, full: true },
      { key: 'description', label: 'Details', type: 'textarea' },
      { key: 'priority', label: 'Priority', type: 'select', options: ['low', 'medium', 'high', 'urgent'], defaultValue: 'medium' },
      { key: 'status', label: 'Status', type: 'select', options: ['pending', 'in_progress', 'completed', 'blocked'] },
      { key: 'due_date', label: 'Due date', type: 'date' },
    ],
    columns: [
      { key: 'title', label: 'Task', render: (r) => <span className={r.status === 'completed' ? 'text-stone-400 line-through' : 'font-medium text-stone-800'}>{r.title}</span> },
      { key: 'priority', label: 'Priority', status: true },
      { key: 'due_date', label: 'Due', render: (r) => <span className={r.status !== 'completed' && r.due_date && r.due_date < today() ? 'font-medium text-red-600' : 'text-stone-600'}>{fmtDate(r.due_date)}</span> },
      { key: 'status', label: 'Status', status: true },
    ],
    summary: (rows) => (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Open" value={rows.filter((r) => r.status !== 'completed').length} />
        <StatCard label="In progress" value={rows.filter((r) => r.status === 'in_progress').length} />
        <StatCard label="Blocked" value={rows.filter((r) => r.status === 'blocked').length} />
        <StatCard label="Completed" value={rows.filter((r) => r.status === 'completed').length} />
      </div>
    ),
  },
  vendors: {
    table: 'event_vendors', title: 'Vendors', subtitle: 'Click a status to change it, or open a vendor to edit it', noun: 'vendor',
    icon: <Truck className="h-10 w-10" />,
    fields: [
      { key: 'name', label: 'Vendor name', required: true, full: true, placeholder: 'e.g. Sharma Decorators' },
      { key: 'service_type', label: 'Service', placeholder: 'Decoration, Catering…' },
      { key: 'status', label: 'Status', type: 'select', options: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'] },
      { key: 'contact_person', label: 'Contact person' },
      { key: 'phone', label: 'Phone', type: 'tel' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'estimated_cost', label: 'Estimated cost (₹)', type: 'number' },
      { key: 'actual_cost', label: 'Actual cost (₹)', type: 'number' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
    columns: [
      { key: 'name', label: 'Vendor', render: (r) => <div><p className="font-medium text-stone-800">{r.name}</p><p className="text-xs text-stone-400">{r.service_type || '—'}</p></div> },
      { key: 'contact', label: 'Contact', render: (r) => <span className="text-stone-600">{[r.contact_person, r.phone].filter(Boolean).join(' · ') || '—'}</span> },
      { key: 'cost', label: 'Est. / Actual', render: (r) => `${r.estimated_cost != null ? inr(Number(r.estimated_cost)) : '—'} / ${r.actual_cost != null ? inr(Number(r.actual_cost)) : '—'}` },
      { key: 'status', label: 'Status', status: true },
    ],
    summary: (rows) => (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Vendors" value={rows.length} />
        <StatCard label="Confirmed" value={rows.filter((r) => r.status === 'confirmed').length} />
        <StatCard label="Estimated" value={inr(rows.reduce((s, r) => s + Number(r.estimated_cost || 0), 0))} />
        <StatCard label="Actual" value={inr(rows.reduce((s, r) => s + Number(r.actual_cost || 0), 0))} />
      </div>
    ),
  },
  schedule: {
    table: 'event_schedule_items', title: 'Programme schedule', subtitle: 'Timeline of rituals, performances and activities', noun: 'programme item',
    icon: <Clock className="h-10 w-10" />,
    sort: (a, b) => (a.scheduled_date + (a.start_time || '')).localeCompare(b.scheduled_date + (b.start_time || '')),
    fields: [
      { key: 'title', label: 'Title', required: true, full: true, placeholder: 'e.g. Sandhya Aarti' },
      { key: 'scheduled_date', label: 'Date', type: 'date', required: true },
      { key: 'location', label: 'Location' },
      { key: 'start_time', label: 'Start time', type: 'time' },
      { key: 'end_time', label: 'End time', type: 'time' },
      { key: 'description', label: 'Details', type: 'textarea' },
    ],
    columns: [
      { key: 'scheduled_date', label: 'Date', render: (r) => fmtDate(r.scheduled_date) },
      { key: 'time', label: 'Time', render: (r) => (r.start_time ? `${hm(r.start_time)}${r.end_time ? ' – ' + hm(r.end_time) : ''}` : '—') },
      { key: 'title', label: 'Programme', render: (r) => <span className="font-medium text-stone-800">{r.title}</span> },
      { key: 'location', label: 'Location' },
    ],
  },
  volunteers: {
    table: 'event_volunteers', title: 'Volunteers', subtitle: 'Who is helping, where and in what role', noun: 'volunteer',
    icon: <Users className="h-10 w-10" />,
    fields: [
      { key: 'name', label: 'Name', required: true },
      { key: 'phone', label: 'Phone', type: 'tel' },
      { key: 'role', label: 'Role', placeholder: 'e.g. Crowd control' },
      { key: 'assigned_area', label: 'Assigned area', placeholder: 'e.g. Entry gate' },
      { key: 'status', label: 'Status', type: 'select', options: ['assigned', 'confirmed', 'checked_in', 'completed', 'cancelled'] },
    ],
    columns: [
      { key: 'name', label: 'Name', render: (r) => <span className="font-medium text-stone-800">{r.name}</span> },
      { key: 'role', label: 'Role' }, { key: 'assigned_area', label: 'Area' }, { key: 'phone', label: 'Phone' },
      { key: 'status', label: 'Status', status: true },
    ],
    summary: (rows) => (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Volunteers" value={rows.filter((r) => r.status !== 'cancelled').length} />
        <StatCard label="Confirmed" value={rows.filter((r) => r.status === 'confirmed').length} />
        <StatCard label="Checked in" value={rows.filter((r) => r.status === 'checked_in').length} />
        <StatCard label="Completed" value={rows.filter((r) => r.status === 'completed').length} />
      </div>
    ),
  },
  guest_management: {
    table: 'event_guests', title: 'Guests & RSVPs', subtitle: 'VIPs, speakers, performers and general guests', noun: 'guest',
    icon: <UserCheck className="h-10 w-10" />,
    fields: [
      { key: 'name', label: 'Name', required: true },
      { key: 'guest_type', label: 'Type', type: 'select', options: ['general', 'vip', 'speaker', 'performer'] },
      { key: 'phone', label: 'Phone', type: 'tel' }, { key: 'email', label: 'Email', type: 'email' },
      { key: 'rsvp_status', label: 'RSVP', type: 'select', options: ['pending', 'confirmed', 'declined'] },
      { key: 'headcount', label: 'Headcount', type: 'number', defaultValue: 1 },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
    columns: [
      { key: 'name', label: 'Name', render: (r) => <span className="font-medium text-stone-800">{r.name}</span> },
      { key: 'guest_type', label: 'Type', status: true }, { key: 'rsvp_status', label: 'RSVP', status: true },
      { key: 'headcount', label: 'Headcount' }, { key: 'phone', label: 'Phone' },
    ],
    summary: (rows) => (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Guests listed" value={rows.length} />
        <StatCard label="Confirmed headcount" value={rows.filter((r) => r.rsvp_status === 'confirmed').reduce((s, r) => s + (r.headcount || 0), 0)} />
        <StatCard label="Awaiting reply" value={rows.filter((r) => r.rsvp_status === 'pending').length} />
        <StatCard label="VIPs" value={rows.filter((r) => r.guest_type === 'vip').length} />
      </div>
    ),
  },
  bhog_prasad: {
    table: 'event_bhog_prasad', title: 'Bhog & Prasad', subtitle: 'Preparation and distribution plan', noun: 'prasad item',
    icon: <Utensils className="h-10 w-10" />,
    fields: [
      { key: 'item_name', label: 'Item', required: true, placeholder: 'e.g. Khichuri' },
      { key: 'quantity', label: 'Quantity', type: 'number', required: true, defaultValue: 1 },
      { key: 'unit', label: 'Unit', placeholder: 'kg / plates / packets' },
      { key: 'distribution_point', label: 'Distribution point' },
      { key: 'distribution_time', label: 'Distribution time', type: 'time' },
      { key: 'responsible_person', label: 'Responsible person' },
      { key: 'status', label: 'Status', type: 'select', options: ['planned', 'preparing', 'ready', 'distributing', 'completed'] },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
    columns: [
      { key: 'item_name', label: 'Item', render: (r) => <span className="font-medium text-stone-800">{r.item_name}</span> },
      { key: 'qty', label: 'Quantity', render: (r) => `${r.quantity}${r.unit ? ' ' + r.unit : ''}` },
      { key: 'distribution_point', label: 'Point' }, { key: 'time', label: 'Time', render: (r) => hm(r.distribution_time) || '—' },
      { key: 'responsible_person', label: 'In charge' }, { key: 'status', label: 'Status', status: true },
    ],
  },
  inventory: {
    table: 'event_inventory', title: 'Inventory', subtitle: 'Supplies and equipment to source, track and allocate', noun: 'item',
    icon: <Package className="h-10 w-10" />,
    fields: [
      { key: 'item_name', label: 'Item', required: true }, { key: 'category', label: 'Category', placeholder: 'Decoration, Lighting…' },
      { key: 'quantity', label: 'Quantity', type: 'number', required: true, defaultValue: 1 }, { key: 'unit', label: 'Unit' },
      { key: 'estimated_cost', label: 'Estimated cost (₹)', type: 'number' }, { key: 'actual_cost', label: 'Actual cost (₹)', type: 'number' },
      { key: 'source', label: 'Source / supplier' },
      { key: 'status', label: 'Status', type: 'select', options: ['needed', 'ordered', 'received', 'allocated'] },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
    columns: [
      { key: 'item_name', label: 'Item', render: (r) => <span className="font-medium text-stone-800">{r.item_name}</span> },
      { key: 'category', label: 'Category' }, { key: 'qty', label: 'Qty', render: (r) => `${r.quantity}${r.unit ? ' ' + r.unit : ''}` },
      { key: 'cost', label: 'Est. / Actual', render: (r) => `${r.estimated_cost != null ? inr(Number(r.estimated_cost)) : '—'} / ${r.actual_cost != null ? inr(Number(r.actual_cost)) : '—'}` },
      { key: 'status', label: 'Status', status: true },
    ],
    summary: (rows) => (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Items" value={rows.length} />
        <StatCard label="Still needed" value={rows.filter((r) => r.status === 'needed').length} />
        <StatCard label="Estimated" value={inr(rows.reduce((s, r) => s + Number(r.estimated_cost || 0), 0))} />
        <StatCard label="Actual" value={inr(rows.reduce((s, r) => s + Number(r.actual_cost || 0), 0))} />
      </div>
    ),
  },
  notices: {
    table: 'event_notices', title: 'Notices & announcements', subtitle: 'Visible to everyone in the committee', noun: 'notice',
    icon: <Bell className="h-10 w-10" />,
    sort: (a, b) => Number(b.is_pinned) - Number(a.is_pinned) || String(b.created_at).localeCompare(String(a.created_at)),
    fields: [
      { key: 'title', label: 'Title', required: true, full: true },
      { key: 'content', label: 'Message', type: 'textarea', required: true },
      { key: 'notice_type', label: 'Type', type: 'select', options: ['info', 'announcement', 'reminder', 'urgent'] },
      { key: 'is_pinned', label: 'Pin to top', type: 'checkbox' },
    ],
    columns: [
      { key: 'title', label: 'Notice', render: (r) => (
        <div><p className="font-medium text-stone-800">{r.is_pinned && '📌 '}{r.title}</p><p className="mt-0.5 line-clamp-2 text-xs text-stone-500">{r.content}</p></div>) },
      { key: 'notice_type', label: 'Type', render: (r) => <Badge color={statusColor(r.notice_type)}>{label(r.notice_type)}</Badge> },
      { key: 'created_at', label: 'Posted', render: (r) => fmtDate(String(r.created_at).slice(0, 10)) },
    ],
  },
};
