import { ReactNode } from 'react';

type BadgeVariant =
  | 'appointment'
  | 'trade'
  | 'approval'
  | 'insurer'
  | 'status-green'
  | 'status-amber'
  | 'status-red'
  | 'role'
  | 'region'
  | 'default';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  dot?: boolean;
  size?: 'sm' | 'xs';
}

const variantMap: Record<BadgeVariant, { badge: string; dot: string }> = {
  appointment:   { badge: 'bg-blue-900/50 text-blue-300 border-blue-700/50',       dot: 'bg-blue-400' },
  trade:         { badge: 'bg-orange-900/50 text-orange-300 border-orange-700/50', dot: 'bg-orange-400' },
  approval:      { badge: 'bg-purple-900/50 text-purple-300 border-purple-700/50', dot: 'bg-purple-400' },
  insurer:       { badge: 'bg-slate-800/60 text-slate-300 border-slate-600/50',    dot: 'bg-slate-400' },
  'status-green':{ badge: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/40', dot: 'bg-emerald-400' },
  'status-amber':{ badge: 'bg-amber-900/40 text-amber-300 border-amber-700/40',    dot: 'bg-amber-400' },
  'status-red':  { badge: 'bg-red-900/40 text-red-300 border-red-700/40',          dot: 'bg-red-400' },
  role:          { badge: 'bg-indigo-900/40 text-indigo-300 border-indigo-600/40', dot: 'bg-indigo-400' },
  region:        { badge: 'bg-teal-900/40 text-teal-300 border-teal-600/40',       dot: 'bg-teal-400' },
  default:       { badge: 'bg-gray-800 text-gray-400 border-gray-700',             dot: 'bg-gray-500' },
};

const sizeMap = {
  sm: 'px-2.5 py-1 text-xs',
  xs: 'px-2 py-0.5 text-[10px]',
};

export function Badge({ label, variant = 'default', dot = false, size = 'xs' }: BadgeProps) {
  const { badge, dot: dotColor } = variantMap[variant];
  const sizeClass = sizeMap[size];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${badge} ${sizeClass}`}>
      {dot && (
        <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
      )}
      {label}
    </span>
  );
}
