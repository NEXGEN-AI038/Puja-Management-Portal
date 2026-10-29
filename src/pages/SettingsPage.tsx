import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { CheckCircle2 } from 'lucide-react';

export function SettingsPage() {
  const { activeCommittee, profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const handleSaveProfile = async () => {
    if (!profile) return;
    setSavingProfile(true);
    try {
      await supabase.from('profiles').update({ full_name: fullName, phone: phone || null }).eq('id', profile.id);
      await refreshProfile();
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } finally { setSavingProfile(false); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-serif font-semibold text-stone-800">Settings</h1>
        <p className="text-sm text-stone-500 mt-0.5">Manage your profile and committee preferences</p>
      </div>

      {/* Profile settings */}
      <Card>
        <CardHeader title="Your Profile" subtitle="Update your personal information" />
        <div className="space-y-4 max-w-md">
          <Input label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Your phone number" />
          <div className="flex items-center gap-3">
            <Button onClick={handleSaveProfile} loading={savingProfile}>Save changes</Button>
            {profileSaved && (
              <span className="flex items-center gap-1.5 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" /> Saved
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* Committee info */}
      {activeCommittee && (
        <Card>
          <CardHeader
            title="Committee Information"
            subtitle={activeCommittee.name}
            action={<Badge color="green">{activeCommittee.role}</Badge>}
          />
          <dl className="space-y-3 max-w-md">
            <div className="flex justify-between text-sm">
              <dt className="text-stone-400">Name</dt>
              <dd className="text-stone-700">{activeCommittee.name}</dd>
            </div>
            {activeCommittee.description && (
              <div className="flex justify-between text-sm">
                <dt className="text-stone-400">Description</dt>
                <dd className="text-stone-700 text-right max-w-xs">{activeCommittee.description}</dd>
              </div>
            )}
            {activeCommittee.city && (
              <div className="flex justify-between text-sm">
                <dt className="text-stone-400">City</dt>
                <dd className="text-stone-700">{activeCommittee.city}</dd>
              </div>
            )}
            {activeCommittee.state && (
              <div className="flex justify-between text-sm">
                <dt className="text-stone-400">State</dt>
                <dd className="text-stone-700">{activeCommittee.state}</dd>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <dt className="text-stone-400">Created</dt>
              <dd className="text-stone-700">{new Date(activeCommittee.created_at).toLocaleDateString('en-IN')}</dd>
            </div>
          </dl>
        </Card>
      )}

      {/* About */}
      <Card>
        <CardHeader title="About" />
        <div className="text-sm text-stone-500 space-y-2">
          <p><span className="font-medium text-stone-700">Festival Management Platform</span></p>
          <p>Designed by <a href="https://www.gdsolutions.in" target="_blank" rel="noopener noreferrer" className="font-medium text-brand-600 hover:underline">GD Solutions</a> · <a href="https://www.gdsolutions.in" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">www.gdsolutions.in</a></p>
          <p>A multi-tenant SaaS platform for community organisations to manage Pujas, religious festivals and community events from one account.</p>
          <p className="text-xs text-stone-400 mt-3">Version 1.0.0</p>
        </div>
      </Card>
    </div>
  );
}
