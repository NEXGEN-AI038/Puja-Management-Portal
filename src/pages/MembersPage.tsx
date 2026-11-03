import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Table } from '@/components/ui/Table';
import { LoadingOverlay, EmptyState } from '@/components/ui/Feedback';
import { UserPlus, Mail, Phone, MoreVertical } from 'lucide-react';
import type { CommitteeMember, Profile, Role } from '@/types';
import { ROLES } from '@/types';
import { sendInvite } from '@/lib/invite';

const ROLE_COLORS: Record<Role, 'gold' | 'green' | 'blue' | 'amber' | 'gray' | 'teal'> = {
  'Platform Owner': 'gold',
  'Committee Admin': 'green',
  'Treasurer': 'blue',
  'Event Manager': 'amber',
  'Volunteer': 'gray',
  'Auditor/Viewer': 'teal',
  'Community Member': 'gray',
};

export function MembersPage() {
  const { activeCommittee, profile } = useAuth();
  const [members, setMembers] = useState<CommitteeMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [editingMember, setEditingMember] = useState<CommitteeMember | null>(null);

  const loadMembers = useCallback(async () => {
    if (!activeCommittee) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('committee_members')
      .select('*, profile:profiles(*)')
      .eq('committee_id', activeCommittee.id)
      .order('joined_at', { ascending: true });
    setMembers((data as any[]) || []);
    setLoading(false);
  }, [activeCommittee]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  const canManage = activeCommittee && (
    activeCommittee.role === 'Platform Owner' || activeCommittee.role === 'Committee Admin'
  );

  if (loading) return <LoadingOverlay message="Loading members..." />;

  if (!activeCommittee) {
    return <EmptyState title="No committee selected" description="Select a committee to view members." />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-stone-800">Committee Members</h1>
          <p className="text-sm text-stone-500 mt-0.5">{activeCommittee.name} · {members.length} members</p>
        </div>
        {canManage && (
          <Button onClick={() => setShowInvite(true)}>
            <UserPlus className="h-4 w-4" /> Invite member
          </Button>
        )}
      </div>

      <Card padding="none">
        {members.length === 0 ? (
          <EmptyState
            icon={<UserPlus className="h-10 w-10" />}
            title="No members yet"
            description="Invite people to join your committee."
          />
        ) : (
          <Table
            columns={[
              {
                key: 'name', label: 'Name',
                render: (m: any) => (
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-white text-xs font-semibold">
                      {(m.profile?.full_name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-stone-800">{m.profile?.full_name || 'Unknown'}</p>
                      {m.profile?.phone && <p className="text-xs text-stone-400">{m.profile.phone}</p>}
                    </div>
                  </div>
                )
              },
              {
                key: 'role', label: 'Role',
                render: (m: any) => <Badge color={ROLE_COLORS[m.role as Role]}>{m.role}</Badge>
              },
              {
                key: 'status', label: 'Status',
                render: (m: any) => <Badge color={m.status === 'active' ? 'green' : m.status === 'invited' ? 'amber' : 'gray'} dot>{m.status}</Badge>
              },
              {
                key: 'joined_at', label: 'Joined',
                render: (m: any) => new Date(m.joined_at).toLocaleDateString('en-IN')
              },
              {
                key: 'actions', label: '',
                render: (m: any) => canManage ? (
                  <button
                    onClick={() => setEditingMember(m)}
                    className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                ) : null
              },
            ]}
            data={members}
            rowKey={(m) => m.id}
          />
        )}
      </Card>

      {/* Role descriptions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ROLES.map((role) => (
          <Card key={role} padding="md">
            <Badge color={ROLE_COLORS[role]}>{role}</Badge>
            <p className="text-xs text-stone-500 mt-2">
              {role === 'Platform Owner' && 'Full access across all committees and settings.'}
              {role === 'Committee Admin' && 'Full access within this committee — manage members, events and all data.'}
              {role === 'Treasurer' && 'Read all data, plus full access to finance records and budgets.'}
              {role === 'Event Manager' && 'Read all data, plus manage events, tasks, vendors and schedules.'}
              {role === 'Volunteer' && 'Read all data and update tasks assigned to them.'}
              {role === 'Auditor/Viewer' && 'Read-only access to all committee data for review and audit.'}
            </p>
          </Card>
        ))}
      </div>

      {canManage && <PendingInvites committeeId={activeCommittee.id} tick={showInvite} />}
      <InviteModal
        open={showInvite}
        onClose={() => setShowInvite(false)}
        committeeId={activeCommittee.id}
        onInvited={() => { loadMembers(); setShowInvite(false); }}
      />

      <EditMemberModal
        member={editingMember}
        onClose={() => setEditingMember(null)}
        onUpdated={() => { loadMembers(); setEditingMember(null); }}
      />
    </div>
  );
}

function InviteModal({ open, onClose, committeeId, onInvited }: {
  open: boolean; onClose: () => void; committeeId: string; onInvited: () => void;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('Volunteer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const handleInvite = async () => {
    const clean = email.trim().toLowerCase();
    if (!clean || !clean.includes('@')) { setError('Enter a valid email address'); return; }
    setError(''); setInfo(''); setLoading(true);
    const res = await sendInvite(committeeId, clean, role);
    setLoading(false);
    if (!res.ok) { setError(res.error); return; }
    setInfo(res.message);
    setEmail('');
    onInvited();
  };

  return (
    <Modal open={open} onClose={onClose} title="Invite Member" subtitle="Invite someone to join your committee" size="md"
      footer={<><Button variant="ghost" onClick={onClose}>Close</Button><Button onClick={handleInvite} loading={loading}><UserPlus className="h-4 w-4" /> Invite</Button></>}>
      {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {info && <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{info}</div>}
      <div className="space-y-4">
        <Input label="Email address *" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="member@example.com" icon={<Mail className="h-4 w-4" />} />
        <Select label="Role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {ROLES.filter((r) => r !== 'Platform Owner').map((r) => <option key={r} value={r}>{r}</option>)}
        </Select>
        {role === 'Community Member' && (
          <p className="text-xs text-stone-500">View-only access to events, schedule, notices, budget and finances. Cannot see tasks, vendors, volunteers, guests or donor details.</p>
        )}
      </div>
    </Modal>
  );
}

function PendingInvites({ committeeId, tick }: { committeeId: string; tick: boolean }) {
  const [rows, setRows] = useState<{ id: string; email: string; role: string }[]>([]);
  const load = useCallback(async () => {
    const { data } = await supabase.from('invitations').select('id,email,role')
      .eq('committee_id', committeeId).eq('status', 'pending').order('created_at', { ascending: false });
    setRows(data || []);
  }, [committeeId]);
  useEffect(() => { load(); }, [load, tick]);
  if (rows.length === 0) return null;
  const revoke = async (id: string) => { await supabase.from('invitations').update({ status: 'revoked' }).eq('id', id); load(); };
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-stone-700">Pending invitations</h3>
      <ul className="mt-2 divide-y divide-stone-100">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between py-2 text-sm">
            <span>{r.email} <span className="text-stone-400">· {r.role}</span></span>
            <button className="text-xs text-stone-400 hover:text-red-600" onClick={() => revoke(r.id)}>Revoke</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EditMemberModal({ member, onClose, onUpdated }: {
  member: CommitteeMember | null; onClose: () => void; onUpdated: () => void;
}) {
  const [role, setRole] = useState<Role>('Volunteer');
  const [status, setStatus] = useState('active');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (member) {
      setRole(member.role);
      setStatus(member.status);
    }
  }, [member]);

  const handleSave = async () => {
    if (!member) return;
    setLoading(true);
    try {
      await supabase.from('committee_members')
        .update({ role, status })
        .eq('id', member.id);
      onUpdated();
    } finally { setLoading(false); }
  };

  return (
    <Modal open={!!member} onClose={onClose} title="Edit Member" size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={handleSave} loading={loading}>Save</Button></>}>
      <div className="space-y-4">
        <Select label="Role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </Select>
        <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="active">Active</option>
          <option value="invited">Invited</option>
          <option value="inactive">Inactive</option>
        </Select>
      </div>
    </Modal>
  );
}
