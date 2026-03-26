// ── #4  Status / Chip Tags — coloured badges for job type, region, status
//       Inspired by 21st.dev Chip Tags (dark-theme variant row 1 col 3)

type BadgeVariant = 'default' | 'primary' | 'secondary' | 'destructive' | 'warning' | 'success' | 'info';

const variantClasses: Record<BadgeVariant, string> = {
  default:     'bg-gray-700/80 text-gray-300 border-gray-600/50',
  primary:     'bg-red-900/60 text-red-300 border-red-700/50',
  secondary:   'bg-gray-800 text-gray-400 border-gray-700/50',
  destructive: 'bg-red-950/80 text-red-400 border-red-800/60',
  warning:     'bg-yellow-900/40 text-yellow-300 border-yellow-700/40',
  success:     'bg-emerald-900/40 text-emerald-300 border-emerald-700/40',
  info:        'bg-blue-900/40 text-blue-300 border-blue-700/40',
};

interface StatusBadgeProps {
  label: string;
  variant?: BadgeVariant;
  className?: string;
}

export function StatusBadge({ label, variant = 'default', className = '' }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border leading-none ${variantClasses[variant]} ${className}`}
    >
      {label}
    </span>
  );
}

// Helper: auto-pick a variant based on a job type string
export function JobTypeBadge({ label }: { label: string }) {
  const lower = label.toLowerCase();
  let variant: BadgeVariant = 'default';
  if (lower.includes('emergency') || lower.includes('urgent')) variant = 'destructive';
  else if (lower.includes('repair') || lower.includes('restoration')) variant = 'primary';
  else if (lower.includes('assess') || lower.includes('inspect') || lower.includes('report')) variant = 'info';
  else if (lower.includes('complete') || lower.includes('finish')) variant = 'success';
  else if (lower.includes('pending') || lower.includes('wait')) variant = 'warning';
  return <StatusBadge label={label} variant={variant} />;
}
