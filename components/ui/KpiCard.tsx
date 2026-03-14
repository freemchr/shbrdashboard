import { ReactNode } from 'react';

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  accent?: boolean;
  loading?: boolean;
}

export function KpiCard({ title, value, subtitle, icon, accent, loading }: KpiCardProps) {
  return (
    <div className={`rounded-xl border ${accent ? 'border-red-600 bg-red-950/20' : 'border-gray-800 bg-gray-900'} p-5 flex flex-col gap-2`}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400 font-medium">{title}</span>
        {icon && <span className="text-gray-500">{icon}</span>}
      </div>
      {loading ? (
        <div className="h-8 w-24 bg-gray-800 rounded animate-pulse" />
      ) : (
        <div className={`text-3xl font-bold ${accent ? 'text-red-500' : 'text-white'}`}>
          {value}
        </div>
      )}
      {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
    </div>
  );
}
