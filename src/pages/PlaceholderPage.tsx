import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Feedback';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from '@/lib/router';
import { Button } from '@/components/ui/Button';
import { Wallet, Truck, Clock, CheckSquare, CalendarDays, ArrowRight } from 'lucide-react';

const MODULE_INFO: Record<string, { icon: any; title: string; description: string; cta: string }> = {
  finance: { icon: Wallet, title: 'Finance Overview', description: 'Track income and expenses across all events in this committee. View budget summaries, transaction history and financial reports.', cta: 'View events' },
  vendors: { icon: Truck, title: 'Vendor Directory', description: 'Manage all vendors and suppliers across your events. Compare costs, track contracts and monitor vendor performance.', cta: 'View events' },
  schedule: { icon: Clock, title: 'Schedule Overview', description: 'View timelines and schedules for all upcoming events. Coordinate dates and avoid scheduling conflicts.', cta: 'View events' },
  tasks: { icon: CheckSquare, title: 'Task Management', description: 'See all tasks across events, track progress and assign work to team members.', cta: 'View events' },
};

export function PlaceholderPage({ module }: { module: string }) {
  const { activeCommittee } = useAuth();
  const { navigate } = useRouter();
  const info = MODULE_INFO[module] || MODULE_INFO.finance;
  const Icon = info.icon;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-serif font-semibold text-stone-800">{info.title}</h1>
        <p className="text-sm text-stone-500 mt-0.5">{activeCommittee?.name}</p>
      </div>

      <Card padding="lg">
        <EmptyState
          icon={<Icon className="h-12 w-12" />}
          title={`${info.title} — Coming in the next phase`}
          description={info.description}
          action={
            <Button onClick={() => navigate('/events')}>
              {info.cta} <ArrowRight className="h-4 w-4" />
            </Button>
          }
        />
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(MODULE_INFO).map(([key, val]) => {
          const VIcon = val.icon;
          return (
            <Card key={key} padding="md" className="text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-stone-100 mb-2">
                <VIcon className="h-5 w-5 text-stone-400" />
              </div>
              <p className="text-xs font-medium text-stone-600">{val.title}</p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
