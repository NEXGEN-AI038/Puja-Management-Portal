import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Sparkles, Building2, MapPin, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';

export function OnboardingPage() {
  const { user, profile, refreshProfile, refreshCommittees } = useAuth();
  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [committeeName, setCommitteeName] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const steps = ['Your profile', 'Create your committee', 'Review & finish'];

  const handleSaveProfile = async () => {
    if (!fullName.trim()) {
      setError('Please enter your full name');
      return;
    }
    setError('');
    if (user) {
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, full_name: fullName });
      if (error) {
        setError(error.message);
        return;
      }
      await refreshProfile();
    }
    setStep(1);
  };

  const handleCreateCommittee = async () => {
    if (!committeeName.trim()) {
      setError('Please enter a committee name');
      return;
    }
    setError('');
    setLoading(true);

    try {
      if (!user) throw new Error('Not authenticated');

      const { error: committeeError } = await supabase.rpc('create_committee', {
        p_name: committeeName.trim(),
        p_description: description || null,
        p_city: city || null,
        p_state: state || null,
      });

      if (committeeError) throw committeeError;

      await refreshCommittees();
      setStep(2);
    } catch (err: any) {
      setError(err.message || 'Failed to create committee');
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = async () => {
    await refreshCommittees();
  };

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-4xl px-6 py-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600">
            <Sparkles className="h-4.5 w-4.5 text-white" />
          </div>
          <div>
            <p className="font-serif text-sm font-semibold text-stone-800">GD Solutions</p>
            <p className="text-xs text-stone-400">Puja & Festival Management</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-xl">
          {/* Progress */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              {steps.map((s, i) => (
                <div key={s} className="flex items-center" style={{ flex: i < steps.length - 1 ? 1 : 'none' }}>
                  <div className="flex items-center gap-2">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                      i < step ? 'bg-brand-600 text-white' :
                      i === step ? 'bg-brand-600 text-white' :
                      'bg-stone-200 text-stone-400'
                    }`}>
                      {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                    </div>
                    <span className={`text-xs font-medium hidden sm:inline ${i <= step ? 'text-stone-700' : 'text-stone-400'}`}>
                      {s}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <div className={`h-0.5 flex-1 mx-2 sm:mx-3 rounded ${i < step ? 'bg-brand-500' : 'bg-stone-200'}`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          {/* Step 0: Profile */}
          {step === 0 && (
            <Card padding="lg" className="animate-slide-up">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-stone-800">Tell us about yourself</h2>
                <p className="text-sm text-stone-500 mt-1">Your name helps your committee members recognise you.</p>
              </div>
              <div className="space-y-4">
                <Input
                  label="Full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Rajesh Sharma"
                  icon={<span className="text-sm">@</span>}
                />
              </div>
              <div className="mt-6 flex justify-end">
                <Button onClick={handleSaveProfile}>
                  Continue <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          )}

          {/* Step 1: Create committee */}
          {step === 1 && (
            <Card padding="lg" className="animate-slide-up">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-stone-800">Create your first committee</h2>
                <p className="text-sm text-stone-500 mt-1">A committee is your organisation — e.g. Durga Bari Samity, Salt Lake Cultural Forum.</p>
              </div>
              <div className="space-y-4">
                <Input
                  label="Committee name"
                  value={committeeName}
                  onChange={(e) => setCommitteeName(e.target.value)}
                  placeholder="e.g. Salt Lake Durga Puja Committee"
                  icon={<Building2 className="h-4 w-4" />}
                />
                <Textarea
                  label="Description (optional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="A brief description of your committee"
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="City"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Kolkata"
                    icon={<MapPin className="h-4 w-4" />}
                  />
                  <Input
                    label="State"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="West Bengal"
                  />
                </div>
              </div>
              <div className="mt-6 flex items-center justify-between">
                <Button variant="ghost" onClick={() => setStep(0)}>
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <Button onClick={handleCreateCommittee} loading={loading}>
                  Create committee <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          )}

          {/* Step 2: Done */}
          {step === 2 && (
            <Card padding="lg" className="animate-slide-up text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 mb-4">
                <CheckCircle2 className="h-8 w-8 text-brand-600" />
              </div>
              <h2 className="text-xl font-semibold text-stone-800">You're all set!</h2>
              <p className="text-sm text-stone-500 mt-2 max-w-sm mx-auto">
                Your committee <span className="font-medium text-stone-700">{committeeName}</span> has been created.
                You can now start adding events, managing members and organising your celebrations.
              </p>
              <div className="mt-6">
                <Button onClick={handleFinish} size="lg">
                  Go to dashboard <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
