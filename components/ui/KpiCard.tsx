'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';

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

function parseValue(value: string | number): { prefix: string; num: number; suffix: string } | null {
  if (typeof value === 'number') {
    return { prefix: '', num: value, suffix: '' };
  }
  // Try to extract numeric portion from strings like "$1,234" or "98%"
  const match = String(value).match(/^([^0-9-]*)(-?[\d,]+\.?\d*)(.*)$/);
  if (!match) return null;
  const num = parseFloat(match[2].replace(/,/g, ''));
  if (isNaN(num)) return null;
  return { prefix: match[1], num, suffix: match[3] };
}

function useCountUp(value: string | number, loading: boolean | undefined, duration = 700) {
  const parsed = parseValue(value);
  const [display, setDisplay] = useState<string | number>(
    parsed ? `${parsed.prefix}0${parsed.suffix}` : value
  );
  const rafRef = useRef<number | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (loading || startedRef.current || !parsed) return;
    startedRef.current = true;

    const start = performance.now();
    const target = parsed.num;

    // Format number back with commas if original had them
    const hadCommas = typeof value === 'string' && /[\d],[\d]/.test(value);
    const decimals = typeof value === 'string' ? (value.match(/\.(\d+)/) || ['', ''])[1].length : 0;

    function format(n: number): string {
      const fixed = n.toFixed(decimals);
      if (hadCommas) {
        const parts = fixed.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return parts.join('.');
      }
      return fixed;
    }

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = eased * target;
      setDisplay(`${parsed!.prefix}${format(current)}${parsed!.suffix}`);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(value);
      }
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  return parsed ? display : value;
}

export function KpiCard({ title, value, subtitle, icon, accent, loading, onClick, active }: KpiCardProps) {
  const animatedValue = useCountUp(value, loading);
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
        <div className="h-8 w-24 bg-gray-800 rounded animate-pulse" />
      ) : (
        <div className={`text-xl sm:text-2xl font-bold break-words leading-tight ${active ? 'text-red-400' : accent ? 'text-red-500' : 'text-white'}`}>
          {animatedValue}
        </div>
      )}
      {subtitle && (
        <p className={`text-xs ${active ? 'text-red-400/70' : 'text-gray-500'}`}>{subtitle}</p>
      )}
    </div>
  );
}
