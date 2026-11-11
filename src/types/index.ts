export type Role = 'Platform Owner' | 'Committee Admin' | 'Treasurer' | 'Event Manager' | 'Volunteer' | 'Auditor/Viewer' | 'Community Member';

export type PaymentMethod = 'cash' | 'bank' | 'upi' | 'cheque' | 'online' | 'other';

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank', label: 'Bank transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' },
];

export type EventStatus = 'planning' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export type ModuleKey =
  | 'finance'
  | 'vendors'
  | 'schedule'
  | 'tasks'
  | 'volunteers'
  | 'guest_management'
  | 'bhog_prasad'
  | 'inventory'
  | 'notices'
  | 'budget'
  | 'donations';

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Committee {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  city: string | null;
  state: string | null;
  country: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CommitteeMember {
  id: string;
  committee_id: string;
  user_id: string;
  role: Role;
  status: 'active' | 'invited' | 'inactive';
  joined_at: string;
  created_at: string;
  profile?: Profile;
}

export interface EventItem {
  id: string;
  committee_id: string;
  name: string;
  event_type: string;
  start_date: string;
  end_date: string;
  venue: string | null;
  description: string | null;
  status: EventStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface EventModule {
  id: string;
  event_id: string;
  module_key: ModuleKey;
  enabled: boolean;
  created_at: string;
}

export interface EventTask {
  id: string;
  event_id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventFinance {
  id: string;
  event_id: string;
  type: 'income' | 'expense';
  category: string;
  description: string | null;
  amount: number;
  date: string;
  vendor_name: string | null;
  receipt_url: string | null;
  payment_method: PaymentMethod;
  reference_no: string | null;
  party_name: string | null;
  flat_no: string | null;
  tower_phase: string | null;
  status: 'recorded' | 'void';
  void_reason: string | null;
  created_by: string;
  created_at: string;
}

export interface EventVendor {
  id: string;
  event_id: string;
  name: string;
  service_type: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  notes: string | null;
  created_at: string;
}

export interface EventScheduleItem {
  id: string;
  event_id: string;
  title: string;
  description: string | null;
  scheduled_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  created_at: string;
}

export interface CommitteeWithMembership extends Committee {
  role: Role;
  member_status: 'active' | 'invited' | 'inactive';
}

export const MODULE_DEFINITIONS: { key: ModuleKey; label: string; description: string; icon: string }[] = [
  { key: 'finance', label: 'Finance', description: 'Track income and expenses, manage budgets', icon: 'Wallet' },
  { key: 'vendors', label: 'Vendors', description: 'Manage suppliers and service providers', icon: 'Truck' },
  { key: 'schedule', label: 'Schedule', description: 'Plan event timelines and programs', icon: 'Calendar' },
  { key: 'tasks', label: 'Tasks', description: 'Assign and track operational tasks', icon: 'CheckSquare' },
  { key: 'volunteers', label: 'Volunteers', description: 'Coordinate volunteer assignments', icon: 'Users' },
  { key: 'guest_management', label: 'Guest Management', description: 'Manage VIP guests and RSVPs', icon: 'UserCheck' },
  { key: 'bhog_prasad', label: 'Bhog & Prasad', description: 'Plan and track prasad distribution', icon: 'Utensils' },
  { key: 'inventory', label: 'Inventory', description: 'Track items, supplies and equipment', icon: 'Package' },
  { key: 'notices', label: 'Notices', description: 'Post announcements and reminders', icon: 'Bell' },
  { key: 'budget', label: 'Budget', description: 'Plan category budgets and track spend against them', icon: 'PiggyBank' },
  { key: 'donations', label: 'Donations & Sponsors', description: 'Record donations, sponsorships and issue receipts', icon: 'HandHeart' },
];

export const EVENT_TYPES = [
  'Durga Puja',
  'Kali Puja',
  'Lakshmi Puja',
  'Saraswati Puja',
  'Ganesh Chaturthi',
  'Jagaddhatri Puja',
  'Vishwakarma Puja',
  'Satyanarayan Puja',
  'Navratri',
  'Dussehra',
  'Diwali',
  'Holi',
  'Lohri',
  'Makar Sankranti',
  'Pongal',
  'Onam',
  'Baisakhi',
  'Raksha Bandhan',
  'Janmashtami',
  'Rath Yatra',
  'Maha Shivratri',
  'Rudrabhishek',
  'Chhath Puja',
  'Eid',
  'Christmas',
  'New Year',
  'Nabo Barsho (Poila Boishakh)',
  'Rabindra Jayanti',
  'Republic Day',
  'Independence Day',
  'Community Event',
  'Cultural Program',
  'Other',
];

export const EVENT_STATUSES: { value: EventStatus; label: string; color: string }[] = [
  { value: 'planning', label: 'Planning', color: 'blue' },
  { value: 'confirmed', label: 'Confirmed', color: 'teal' },
  { value: 'in_progress', label: 'In Progress', color: 'amber' },
  { value: 'completed', label: 'Completed', color: 'green' },
  { value: 'cancelled', label: 'Cancelled', color: 'red' },
];

export const ROLES: Role[] = [
  'Platform Owner',
  'Committee Admin',
  'Treasurer',
  'Event Manager',
  'Volunteer',
  'Auditor/Viewer',
  'Community Member',
];
