import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { useRouter } from '@/lib/router';
import { LoadingOverlay } from '@/components/ui/Feedback';
import { AppLayout } from '@/components/AppLayout';
import { AuthPage } from '@/pages/AuthPage';
import { SetPasswordPage } from '@/pages/SetPasswordPage';
import { NoAccessPage } from '@/pages/NoAccessPage';
import { PlatformPage } from '@/pages/PlatformPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { EventsListPage } from '@/pages/EventsListPage';
import { EventDetailPage } from '@/pages/EventDetailPage';
import { MembersPage } from '@/pages/MembersPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { FinancePage, VendorsPage, SchedulePage, TasksPage } from '@/pages/CommitteePages';
import { SetupPage } from '@/pages/SetupPage';
import { isSupabaseConfigured } from '@/lib/supabase';

function Routes() {
  const { route } = useRouter();
  const { activeCommittee } = useAuth();
  // Community Members are view-only: events, schedule, finance only.
  if (activeCommittee?.role === 'Community Member' && ['members', 'vendors', 'tasks', 'settings', 'platform'].includes(route.name)) {
    return <DashboardPage />;
  }

  switch (route.name) {
    case 'events':
      return <EventsListPage />;
    case 'event':
      return <EventDetailPage key={route.id} eventId={route.id} tab={route.tab} />;
    case 'members':
      return <MembersPage />;
    case 'finance':
      return <FinancePage />;
    case 'vendors':
      return <VendorsPage />;
    case 'schedule':
      return <SchedulePage />;
    case 'tasks':
      return <TasksPage />;
    case 'settings':
      return <SettingsPage />;
    case 'platform':
      return <PlatformPage />;
    default:
      return <DashboardPage />;
  }
}

function AppContent() {
  const { user, loading, committees, isPlatformAdmin, passwordSetup } = useAuth();
  const { route } = useRouter();

  if (loading) return <LoadingOverlay message="Loading..." />;
  if (user && passwordSetup) return <SetPasswordPage />;
  if (!user) return <AuthPage />;
  if (isPlatformAdmin && (committees.length === 0)) {
    return <PlatformPage standalone />;
  }
  if (committees.length === 0) return <NoAccessPage />;

  return (
    <AppLayout>
      <Routes />
    </AppLayout>
  );
}

export default function App() {
  if (!isSupabaseConfigured) return <SetupPage />;
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
