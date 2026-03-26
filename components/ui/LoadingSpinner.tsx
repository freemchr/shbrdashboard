import { AlertTriangle } from 'lucide-react';

// ── #1  Loading Spinner — 3-dot pulse (inspired by 21st.dev Spinner Loaders)
export function LoadingSpinner({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-bounce [animation-delay:-0.3s]" />
        <span className="w-2 h-2 rounded-full bg-red-500/70 animate-bounce [animation-delay:-0.15s]" />
        <span className="w-2 h-2 rounded-full bg-red-500/40 animate-bounce" />
      </div>
      <p className="text-gray-500 text-sm">{message}</p>
    </div>
  );
}

// ── #2  Error / Alert messages — coloured variant banners (inspired by 21st.dev Alerts)
type AlertVariant = 'error' | 'warning' | 'success' | 'info';

const variantStyles: Record<AlertVariant, { border: string; bg: string; icon: string; label: string; labelColor: string }> = {
  error:   { border: 'border-red-800/60',    bg: 'bg-red-950/30',    icon: 'text-red-400',    label: 'Error',   labelColor: 'text-red-400' },
  warning: { border: 'border-yellow-700/60', bg: 'bg-yellow-950/30', icon: 'text-yellow-400', label: 'Warning', labelColor: 'text-yellow-400' },
  success: { border: 'border-emerald-700/60',bg: 'bg-emerald-950/30',icon: 'text-emerald-400',label: 'Success', labelColor: 'text-emerald-400' },
  info:    { border: 'border-blue-700/60',   bg: 'bg-blue-950/30',   icon: 'text-blue-400',   label: 'Info',    labelColor: 'text-blue-400' },
};

export function ErrorMessage({ message, variant = 'error' }: { message: string; variant?: AlertVariant }) {
  const s = variantStyles[variant];
  return (
    <div className={`flex items-start gap-3 rounded-xl border ${s.border} ${s.bg} px-4 py-3 mb-4`}>
      <AlertTriangle size={16} className={`${s.icon} flex-shrink-0 mt-0.5`} />
      <div className="min-w-0">
        <span className={`text-sm font-semibold ${s.labelColor}`}>{s.label}:&nbsp;</span>
        <span className="text-gray-300 text-sm">{message}</span>
      </div>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="w-24 h-3 bg-gray-800 rounded animate-pulse" />
      <div className="w-16 h-8 bg-gray-800 rounded animate-pulse mt-2" />
      <div className="w-32 h-2 bg-gray-800 rounded animate-pulse mt-1" />
    </div>
  );
}

export function SkeletonTable({ rows = 8 }: { rows?: number }) {
  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <div className="bg-gray-800/50 h-10 w-full" />
        {[...Array(rows)].map((_, i) => (
          <div
            key={i}
            className={`h-12 flex items-center px-4 gap-4 ${i % 2 === 0 ? 'bg-gray-900' : 'bg-gray-800/20'}`}
          >
            <div className="h-3 bg-gray-700 rounded animate-pulse w-1/4" />
            <div className="h-3 bg-gray-700 rounded animate-pulse w-1/4" />
            <div className="h-3 bg-gray-700 rounded animate-pulse w-1/4" />
            <div className="h-3 bg-gray-700 rounded animate-pulse w-1/4" />
          </div>
        ))}
      </div>
    </div>
  );
}
