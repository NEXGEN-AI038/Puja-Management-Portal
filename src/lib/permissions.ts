// Mirrors the database (RLS) rules so the UI never offers actions the database will refuse.
export const CREATE_EVENT_ROLES = ['Platform Owner', 'Committee Admin', 'Treasurer', 'Event Manager'];
export const canCreateEvent = (role?: string | null) => !!role && CREATE_EVENT_ROLES.includes(role);
