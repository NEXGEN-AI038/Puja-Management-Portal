import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { canCreateEvent } from '@/lib/permissions';
import { useRouter } from '@/lib/router';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Table } from '@/components/ui/Table';
import { LoadingOverlay, EmptyState } from '@/components/ui/Feedback';
import {
  Plus, Search, CalendarDays, MapPin, Clock,
  Check as CheckIcon, X,
} from 'lucide-react';
import type { EventItem, EventStatus, ModuleKey } from '@/types';
import { EVENT_TYPES, EVENT_STATUSES, MODULE_DEFINITIONS } from '@/types';

const ALL_STATUSES = [{ value: 'all', label: 'All statuses' }, ...EVENT_STATUSES.map((s) => ({ value: s.value, label: s.label }))];

export function EventsListPage() {
  const { activeCommittee } = useAuth();
  const canCreate = canCreateEvent(activeCommittee?.role);
  const { navigate } = useRouter();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreate, setShowCreate] = useState(false);

  const loadEvents = useCallback(async () => {
    if (!activeCommittee) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('committee_id', activeCommittee.id)
      .order('start_date', { ascending: false });
    setEvents((data as EventItem[]) || []);
    setLoading(false);
  }, [activeCommittee]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const filtered = events.filter((e) => {
    const matchesSearch = e.name.toLowerCase().includes(search.toLowerCase()) || e.event_type.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || e.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusInfo = (status: string) => EVENT_STATUSES.find((s) => s.value === status);

  if (loading) return <LoadingOverlay message="Loading events..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-stone-800">Events</h1>
          <p className="text-sm text-stone-500 mt-0.5">Manage all Pujas, festivals and community events</p>
        </div>
        {canCreate && <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" /> Create Event
        </Button>}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            placeholder="Search by event name or type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search className="h-4 w-4" />}
          />
        </div>
        <div className="sm:w-52">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {ALL_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </Select>
        </div>
      </div>

      {/* Events grid */}
      {filtered.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            icon={<CalendarDays className="h-12 w-12" />}
            title={search || statusFilter !== 'all' ? 'No events match your filters' : 'No events yet'}
            description={search || statusFilter !== 'all' ? 'Try adjusting your search or filters.' : canCreate ? 'Create your first event to start planning.' : 'Your committee has not created any events yet.'}
            action={!search && statusFilter === 'all' && canCreate && <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> Create event</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((event) => {
            const si = statusInfo(event.status);
            return (
              <button
                key={event.id}
                onClick={() => navigate(`/event/${event.id}`)}
                className="card-base p-5 text-left hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <Badge color={(si?.color as any) || 'gray'} dot>{si?.label}</Badge>
                </div>
                <h3 className="text-base font-semibold text-stone-800 group-hover:text-brand-700 transition-colors">{event.name}</h3>
                <p className="text-xs text-brand-600 font-medium mt-0.5">{event.event_type}</p>
                <div className="mt-3 space-y-1.5 text-xs text-stone-500">
                  <div className="flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5 text-stone-400" />
                    {new Date(event.start_date).toLocaleDateString('en-IN')} — {new Date(event.end_date).toLocaleDateString('en-IN')}
                  </div>
                  {event.venue && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-stone-400" />
                      {event.venue}
                    </div>
                  )}
                </div>
                {event.description && (
                  <p className="mt-3 text-xs text-stone-400 line-clamp-2">{event.description}</p>
                )}
              </button>
            );
          })}
        </div>
      )}

      <CreateEventModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        committeeId={activeCommittee?.id || ''}
        onCreated={() => { loadEvents(); setShowCreate(false); }}
      />
    </div>
  );
}

interface CreateEventModalProps {
  open: boolean;
  onClose: () => void;
  committeeId: string;
  onCreated: () => void;
}

function CreateEventModal({ open, onClose, committeeId, onCreated }: CreateEventModalProps) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [eventType, setEventType] = useState(EVENT_TYPES[0]);
  const [customType, setCustomType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [venue, setVenue] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<EventStatus>('planning');
  const [modules, setModules] = useState<Record<ModuleKey, boolean>>({
    finance: true, vendors: true, schedule: true, tasks: true,
    volunteers: false, guest_management: false, bhog_prasad: false,
    inventory: false, notices: true, budget: false, donations: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const resetForm = () => {
    setStep(0); setName(''); setEventType(EVENT_TYPES[0]); setCustomType('');
    setStartDate(''); setEndDate(''); setVenue(''); setDescription('');
    setStatus('planning');
    setModules({
      finance: true, vendors: true, schedule: true, tasks: true,
      volunteers: false, guest_management: false, bhog_prasad: false,
      inventory: false, notices: true, budget: false, donations: false,
    });
    setError('');
  };

  const handleCreate = async () => {
    if (!name.trim() || !startDate || !endDate) {
      setError('Please fill in all required fields');
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      setError('End date cannot be before start date');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const finalType = eventType === 'Other' && customType.trim() ? customType.trim() : eventType;

      const { data: event, error: eventError } = await supabase
        .from('events')
        .insert({
          committee_id: committeeId,
          name: name.trim(),
          event_type: finalType,
          start_date: startDate,
          end_date: endDate,
          venue: venue || null,
          description: description || null,
          status,
        })
        .select()
        .single();

      if (eventError) throw eventError;

      const moduleInserts = MODULE_DEFINITIONS.map((m) => ({
        event_id: event.id,
        module_key: m.key,
        enabled: modules[m.key],
      }));

      const { error: modulesError } = await supabase
        .from('event_modules')
        .insert(moduleInserts);

      if (modulesError) throw modulesError;

      resetForm();
      onCreated();
    } catch (err: any) {
      setError(err.message || 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => { onClose(); resetForm(); }}
      title="Create New Event"
      subtitle="Set up a new Puja, festival or community event"
      size="lg"
      footer={
        <>
          {step > 0 && (
            <Button variant="ghost" onClick={() => setStep(step - 1)}>
              <X className="h-4 w-4" /> Back
            </Button>
          )}
          {step === 0 ? (
            <Button onClick={() => {
              if (!name.trim() || !startDate || !endDate) {
                setError('Please fill in all required fields');
                return;
              }
              if (new Date(endDate) < new Date(startDate)) {
                setError('End date cannot be before start date');
                return;
              }
              setError('');
              setStep(1);
            }}>
              Next: Configure Modules
            </Button>
          ) : (
            <Button onClick={handleCreate} loading={loading}>
              <CheckIcon className="h-4 w-4" /> Create Event
            </Button>
          )}
        </>
      }
    >
      {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {step === 0 && (
        <div className="space-y-4">
          <Input
            label="Event name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Lakshmi Puja 2026"
          />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Event type *" value={eventType} onChange={(e) => setEventType(e.target.value)}>
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
            {eventType === 'Other' && (
              <Input
                label="Custom type"
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
                placeholder="Enter custom type"
              />
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start date *"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              label="End date *"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <Input
            label="Venue"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            placeholder="e.g. Community Hall, Salt Lake"
            icon={<MapPin className="h-4 w-4" />}
          />
          <Textarea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of the event"
          />
          <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value as EventStatus)}>
            {EVENT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </Select>
        </div>
      )}

      {step === 1 && (
        <div>
          <p className="text-sm text-stone-500 mb-4">Select which modules to enable for this event. You can change these later.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {MODULE_DEFINITIONS.map((m) => {
              const enabled = modules[m.key];
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setModules({ ...modules, [m.key]: !enabled })}
                  className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-all ${
                    enabled
                      ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500/20'
                      : 'border-stone-200 bg-white hover:border-stone-300'
                  }`}
                >
                  <div className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded ${
                    enabled ? 'bg-brand-600 text-white' : 'bg-stone-200 text-transparent'
                  }`}>
                    <CheckIcon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-stone-800">{m.label}</p>
                    <p className="text-xs text-stone-400 mt-0.5">{m.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </Modal>
  );
}
