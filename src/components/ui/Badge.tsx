type BadgeColor = 'green' | 'blue' | 'amber' | 'red' | 'teal' | 'gray' | 'gold';

interface BadgeProps {
  children: React.ReactNode;
  color?: BadgeColor;
  dot?: boolean;
  className?: string;
}

const colorMap: Record<BadgeColor, string> = {
  green: 'bg-green-50 text-green-700 ring-green-600/20',
  blue: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  red: 'bg-red-50 text-red-700 ring-red-600/20',
  teal: 'bg-teal-50 text-teal-700 ring-teal-600/20',
  gray: 'bg-stone-100 text-stone-600 ring-stone-500/20',
  gold: 'bg-gold-50 text-gold-700 ring-gold-600/20',
};

const dotColorMap: Record<BadgeColor, string> = {
  green: 'bg-green-500',
  blue: 'bg-blue-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  teal: 'bg-teal-500',
  gray: 'bg-stone-400',
  gold: 'bg-gold-500',
};

export function Badge({ children, color = 'gray', dot = false, className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${colorMap[color]} ${className}`}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotColorMap[color]}`} />}
      {children}
    </span>
  );
}
