import { useState, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, Route } from '@/lib/router';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import {
  LayoutDashboard, CalendarDays, Users, Wallet, Truck,
  Clock, CheckSquare, Settings, LogOut, Menu, X, ChevronDown,
  Building2, Bell, Search, ShieldCheck,
} from 'lucide-react';

interface NavItem {
  label: string;
  icon: typeof LayoutDashboard;
  route: string;
  match: (r: Route) => boolean;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, route: '/', match: (r) => r.name === 'dashboard' },
  { label: 'Events', icon: CalendarDays, route: '/events', match: (r) => r.name === 'events' || r.name === 'event' },
  { label: 'Members', icon: Users, route: '/members', match: (r) => r.name === 'members' },
  { label: 'Finance', icon: Wallet, route: '/finance', match: (r) => r.name === 'finance' },
  { label: 'Vendors', icon: Truck, route: '/vendors', match: (r) => r.name === 'vendors' },
  { label: 'Schedule', icon: Clock, route: '/schedule', match: (r) => r.name === 'schedule' },
  { label: 'Tasks', icon: CheckSquare, route: '/tasks', match: (r) => r.name === 'tasks' },
  { label: 'Settings', icon: Settings, route: '/settings', match: (r) => r.name === 'settings' },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { profile, committees, activeCommittee, setActiveCommittee, signOut, isPlatformAdmin } = useAuth();
  const baseNav = activeCommittee?.role === 'Community Member'
    ? navItems.filter((n) => ['Dashboard', 'Events', 'Finance', 'Schedule'].includes(n.label))
    : navItems;
  const allNav: NavItem[] = isPlatformAdmin
    ? [...baseNav, { label: 'Platform admin', icon: ShieldCheck, route: '/platform', match: (r) => r.name === 'platform' }]
    : baseNav;
  const { route, navigate } = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [committeeDropdown, setCommitteeDropdown] = useState(false);
  const [userDropdown, setUserDropdown] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-brand-900 text-white flex flex-col z-30 hidden lg:flex">
        <div className="p-5 border-b border-brand-800">
          <div className="flex items-center gap-3">
            <img src="/logo-white.png" alt="GD Solutions logo" className="h-10 w-10 shrink-0" />
            <div>
              <p className="font-serif text-sm font-semibold leading-tight">Festival Management Platform</p>
              <a href="https://www.gdsolutions.in" target="_blank" rel="noopener noreferrer" className="text-xs text-brand-300 hover:text-gold-300">Designed by GD Solutions</a>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {allNav.map((item) => {
            const isActive = item.match(route);
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                onClick={() => { navigate(item.route); setMobileNavOpen(false); }}
                className={`sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
              >
                <Icon className="h-4.5 w-4.5" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-brand-800">
          <div className="rounded-lg bg-brand-800/50 p-3">
            <p className="text-xs text-brand-200 mb-1">Need help?</p>
            <p className="text-xs text-brand-300">Contact your committee admin for access and support.</p>
          </div>
        </div>
      </aside>

      {/* Mobile nav overlay */}
      {mobileNavOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-stone-900/40" onClick={() => setMobileNavOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-brand-900 text-white flex flex-col animate-slide-in-left">
            <div className="p-5 border-b border-brand-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src="/logo-white.png" alt="GD Solutions logo" className="h-10 w-10 shrink-0" />
                <div>
                  <p className="font-serif text-sm font-semibold leading-tight">Festival Management Platform</p>
              <a href="https://www.gdsolutions.in" target="_blank" rel="noopener noreferrer" className="text-xs text-brand-300 hover:text-gold-300">Designed by GD Solutions</a>
                </div>
              </div>
              <button onClick={() => setMobileNavOpen(false)} className="text-brand-300 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {allNav.map((item) => {
                const isActive = item.match(route);
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    onClick={() => { navigate(item.route); setMobileNavOpen(false); }}
                    className={`sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
                  >
                    <Icon className="h-4.5 w-4.5" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-white border-b border-stone-200">
          <div className="flex items-center justify-between px-4 lg:px-6 h-16">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileNavOpen(true)}
                className="lg:hidden p-2 rounded-lg text-stone-500 hover:bg-stone-100"
              >
                <Menu className="h-5 w-5" />
              </button>

              {/* Committee selector */}
              <div className="relative">
                <button
                  onClick={() => setCommitteeDropdown(!committeeDropdown)}
                  className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 hover:bg-stone-50 transition-colors"
                >
                  <Building2 className="h-4 w-4 text-brand-600" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-stone-800 max-w-[140px] truncate">
                      {activeCommittee?.name || 'Select committee'}
                    </p>
                    <p className="text-xs text-stone-400">{activeCommittee?.role || 'No role'}</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-stone-400" />
                </button>

                {committeeDropdown && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setCommitteeDropdown(false)} />
                    <div className="absolute top-full left-0 mt-1 w-72 card-base z-20 animate-slide-up">
                      <div className="p-2">
                        <p className="px-2 py-1.5 text-xs font-semibold uppercase text-stone-400">Your committees</p>
                        {committees.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => { setActiveCommittee(c); setCommitteeDropdown(false); }}
                            className={`w-full flex items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-stone-50 ${
                              activeCommittee?.id === c.id ? 'bg-brand-50' : ''
                            }`}
                          >
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 text-brand-700 text-xs font-semibold">
                              {c.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-stone-800 truncate">{c.name}</p>
                              <p className="text-xs text-stone-400">{c.role}</p>
                            </div>
                          </button>
                        ))}
                        {committees.length === 0 && (
                          <p className="px-2 py-3 text-sm text-stone-400">No committees yet.</p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button className="p-2 rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors relative">
                <Bell className="h-5 w-5" />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-gold-400" />
              </button>

              {/* User menu */}
              <div className="relative">
                <button
                  onClick={() => setUserDropdown(!userDropdown)}
                  className="flex items-center gap-2 rounded-lg p-1 hover:bg-stone-50 transition-colors"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white text-xs font-semibold">
                    {(profile?.full_name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden sm:inline text-sm font-medium text-stone-700">
                    {profile?.full_name?.split(' ')[0] || 'User'}
                  </span>
                  <ChevronDown className="h-4 w-4 text-stone-400" />
                </button>

                {userDropdown && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setUserDropdown(false)} />
                    <div className="absolute top-full right-0 mt-1 w-56 card-base z-20 animate-slide-up">
                      <div className="p-2">
                        <div className="px-2 py-2 border-b border-stone-100 mb-1">
                          <p className="text-sm font-medium text-stone-800">{profile?.full_name || 'User'}</p>
                          <p className="text-xs text-stone-400 truncate">{profile?.id ? 'Account' : ''}</p>
                        </div>
                        <button
                          onClick={handleSignOut}
                          className="w-full flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-stone-600 hover:bg-stone-50 transition-colors"
                        >
                          <LogOut className="h-4 w-4" /> Sign out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="p-4 lg:p-6 max-w-7xl mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
