import { useState, useEffect, useCallback } from 'react';

export type Route =
  | { name: 'dashboard' }
  | { name: 'events' }
  | { name: 'event'; id: string; tab?: string }
  | { name: 'members' }
  | { name: 'committee' }
  | { name: 'finance' }
  | { name: 'vendors' }
  | { name: 'schedule' }
  | { name: 'tasks' }
  | { name: 'settings' }
  | { name: 'platform' };

function parseHash(): Route {
  const hash = window.location.hash.slice(1) || '/';
  const parts = hash.split('/').filter(Boolean);

  if (parts.length === 0) return { name: 'dashboard' };
  if (parts[0] === 'events' && parts.length === 1) return { name: 'events' };
  if (parts[0] === 'event' && parts[1]) return { name: 'event', id: parts[1], tab: parts[2] };
  if (parts[0] === 'members') return { name: 'members' };
  if (parts[0] === 'committee') return { name: 'committee' };
  if (parts[0] === 'finance') return { name: 'finance' };
  if (parts[0] === 'vendors') return { name: 'vendors' };
  if (parts[0] === 'schedule') return { name: 'schedule' };
  if (parts[0] === 'tasks') return { name: 'tasks' };
  if (parts[0] === 'settings') return { name: 'settings' };
  if (parts[0] === 'platform') return { name: 'platform' };
  return { name: 'dashboard' };
}

export function useRouter() {
  const [route, setRoute] = useState<Route>(parseHash());

  useEffect(() => {
    const handler = () => setRoute(parseHash());
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  const navigate = useCallback((path: string) => {
    window.location.hash = path;
  }, []);

  return { route, navigate };
}
