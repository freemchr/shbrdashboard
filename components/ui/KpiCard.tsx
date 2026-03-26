import { ReactNode } from 'react';

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  accent?: boolean;
  loading?: boolean;
  onClick?: () => void;
  active?: boolean;
}

// ── #5  KPI Card with multi-line shimmer skeleton (inspired by 21st.dev Cards)
export function KpiCard({ title, value, subtitle, icon, accent, loading, onClick, active }: KpiCardProps) {
  const clickable = !!onClick;
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border p-5 flex flex-col gap-2 transition-all
        ${active
          ? 'border-red-500 bg-red-950/30 ring-1 ring-red-500/40'
          : accent
            ? 'border-red-600 bg-red-950/20'
            : 'border-gray-800 bg-gray-900'}
        ${clickable ? 'cursor-pointer hover:border-red-500/60 hover:bg-gray-800/60' : ''}
      `}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400 font-medium">{title}</span>
        {icon && <span className={active ? 'text-red-400' : 'text-gray-500'}>{icon}</span>}
      </div>

      {loading ? (
        /* Multi-line shimmer skeleton */
        <div className="space-y-2 py-1">
          <div className="h-7 w-20 rounded-md bg-gray-800 relative overflow-hidden">
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-gray-700/50 to-transparent" />
          </div>
          <div className="h-3 w-14 rounded bg-gray-800/70 relative overflow-hidden">
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite_0.2s] bg-gradient-to-r from-transparent via-gray-700/40 to-transparent" />
          </div>
        </div>
      ) : (
        <div className={`text-xl sm:text-2xl font-bold break-words leading-tight ${active ? 'text-red-400' : accent ? 'text-red-500' : 'text-white'}`}>
          {value}
        </div>
      )}

      {subtitle && !loading && (
        <p className={`text-xs ${active ? 'text-red-400/70' : 'text-gray-500'}`}>{subtitle}</p>
      )}
    </div>
  );
}
