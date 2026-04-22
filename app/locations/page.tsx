'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import { MapPin, Minus, RefreshCw, Clock, ArrowUpRight, ArrowDownRight } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StateRow        { state: string; jobs: number; pct: number; monthsActive: number; }
interface RegionSummaryRow { region: string; state: string; total: number; pct: number; last3: number; prior3: number; change3mo: number; last6: number; prior6: number; change6mo: number; }
interface RegionMonthRow  { month: string; [region: string]: number | string; }
interface SuburbRow       { rank: number; suburb: string; state: string; region: string; jobs: number; pct: number; }

interface LocationAnalyticsResult {
  generatedAt: string;
  periodLabel: string;
  months: string[];
  totalJobs: number;
  busiestMonth: string;
  busiestMonthJobs: number;
  topRegion: string;
  topRegionJobs: number;
  topState: string;
  regionsActive: number;
  stateBreakdown: StateRow[];
  regionSummary: RegionSummaryRow[];
  regionMonthlyTrend: RegionMonthRow[];
  topSuburbs: SuburbRow[];
}

// ─── Colours ──────────────────────────────────────────────────────────────────

const STATE_COLOURS: Record<string, string> = {
  NSW: '#DC2626', QLD: '#F97316', ACT: '#3B82F6',
  VIC: '#8B5CF6', SA: '#22C55E', WA: '#EAB308', NT: '#6B7280', TAS: '#EC4899',
};

const REGION_COLOURS = [
  '#DC2626','#F97316','#EAB308','#22C55E','#3B82F6','#8B5CF6',
  '#EC4899','#14B8A6','#F43F5E','#84CC16','#0EA5E9','#A78BFA',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pctFmt(n: number, dp = 1) { return (n * 100).toFixed(dp) + '%'; }
function absFmt(n: number) { return n > 0 ? `+${(n * 100).toFixed(0)}%` : `${(n * 100).toFixed(0)}%`; }

function StateBadge({ state }: { state: string }) {
  const bg = (STATE_COLOURS[state] ?? '#6B7280') + '33';
  const col = STATE_COLOURS[state] ?? '#9ca3af';
  return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: bg, color: col }}>
      {state}
    </span>
  );
}

function ChangeChip({ change, size = 'md' }: { change: number; size?: 'sm' | 'md' }) {
  const cls = size === 'sm' ? 'text-[9px] px-1 py-0.5' : 'text-[10px] px-1.5 py-0.5';
  if (change === 0) return (
    <span className={`inline-flex items-center gap-0.5 font-semibold rounded-full bg-gray-800 text-gray-400 ${cls}`}>
      <Minus size={9} />0%
    </span>
  );
  if (change > 0) return (
    <span className={`inline-flex items-center gap-0.5 font-semibold rounded-full bg-red-900/30 text-red-400 ${cls}`}>
      <ArrowUpRight size={9} />{absFmt(change)}
    </span>
  );
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold rounded-full bg-green-900/40 text-green-400 ${cls}`}>
      <ArrowDownRight size={9} />{absFmt(change)}
    </span>
  );
}

// ─── Tooltips ─────────────────────────────────────────────────────────────────

function PieTip({ active, payload, total }: { active?: boolean; payload?: { name: string; value: number }[]; total: number }) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold" style={{ color: STATE_COLOURS[name] ?? '#fff' }}>{name}</p>
      <p className="text-gray-300">{value.toLocaleString()} jobs · {pctFmt(value / total)}</p>
    </div>
  );
}

function BarTip({ active, payload, label }: { active?: boolean; payload?: { value: number; color?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-gray-300 font-semibold mb-1">{label}</p>
      <p className="font-mono" style={{ color: payload[0].color ?? '#DC2626' }}>{payload[0].value} jobs</p>
    </div>
  );
}

function LineTip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (p.value ?? 0), 0);
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-xs shadow-xl min-w-[150px]">
      <p className="text-gray-400 font-semibold mb-1.5">{label} — {total} jobs</p>
      {[...payload].sort((a, b) => b.value - a.value).filter(p => p.value > 0).map(p => (
        <div key={p.name} className="flex items-center justify-between gap-3">
          <span style={{ color: p.color }} className="truncate max-w-[110px]">{p.name}</span>
          <span className="text-white font-mono flex-shrink-0">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'regions' | 'trend' | 'suburbs';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'regions',  label: 'Region Analysis' },
  { id: 'trend',    label: 'Monthly Trend' },
  { id: 'suburbs',  label: 'Top Suburbs' },
];

// ─── Tab: Overview ────────────────────────────────────────────────────────────

function OverviewTab({ data }: { data: LocationAnalyticsResult }) {
  const { stateBreakdown, regionSummary, totalJobs } = data;
  const statePie = stateBreakdown.map(s => ({ name: s.state, value: s.jobs }));
  const topRegions = regionSummary.slice(0, 15);

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Jobs',      value: totalJobs.toLocaleString(),           sub: data.periodLabel },
          { label: 'Top Region',      value: data.topRegion.replace(/ Metro/,''),  sub: `${data.topRegionJobs} jobs` },
          { label: 'Top State',       value: data.topState,                        sub: `${stateBreakdown[0]?.jobs.toLocaleString()} jobs` },
          { label: 'Busiest Month',   value: data.busiestMonth,                    sub: `${data.busiestMonthJobs} jobs` },
          { label: 'Regions Active',  value: data.regionsActive.toString(),        sub: 'across all states' },
          { label: 'States Active',   value: stateBreakdown.length.toString(),     sub: stateBreakdown.map(s => s.state).join(' · ') },
        ].map(kpi => (
          <div key={kpi.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-[11px] text-gray-500 mb-1">{kpi.label}</p>
            <p className="text-lg font-bold text-white leading-tight">{kpi.value}</p>
            <p className="text-[10px] text-gray-600 mt-0.5 leading-tight">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* State breakdown + top 15 regions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* State pie + bar */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-base font-semibold text-white mb-1">Jobs by State</h3>
          <p className="text-xs text-gray-500 mb-4">{data.periodLabel}</p>
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div className="w-44 h-44 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statePie} cx="50%" cy="50%" innerRadius={44} outerRadius={80} paddingAngle={3} dataKey="value">
                    {statePie.map(e => <Cell key={e.name} fill={STATE_COLOURS[e.name] ?? '#6B7280'} />)}
                  </Pie>
                  <Tooltip content={<PieTip total={totalJobs} />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 w-full">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-800">
                    <th className="text-left py-1.5 pr-2 font-medium">State</th>
                    <th className="text-right py-1.5 pr-3 font-medium">Jobs</th>
                    <th className="text-right py-1.5 pr-3 font-medium">Share</th>
                    <th className="text-right py-1.5 font-medium">Months</th>
                  </tr>
                </thead>
                <tbody>
                  {stateBreakdown.map(s => (
                    <tr key={s.state} className="border-t border-gray-800/50">
                      <td className="py-2 pr-2"><StateBadge state={s.state} /></td>
                      <td className="py-2 pr-3 text-right font-mono font-bold text-white">{s.jobs.toLocaleString()}</td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-gray-800 rounded-full h-1.5 overflow-hidden flex-shrink-0">
                            <div className="h-full rounded-full" style={{ width: pctFmt(s.pct, 0), background: STATE_COLOURS[s.state] ?? '#6B7280' }} />
                          </div>
                          <span className="font-mono text-gray-400 w-10 text-right flex-shrink-0">{pctFmt(s.pct)}</span>
                        </div>
                      </td>
                      <td className="py-2 text-right text-gray-500">{s.monthsActive}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Top 15 regions horizontal bar */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-base font-semibold text-white mb-1">Top 15 Regions</h3>
          <p className="text-xs text-gray-500 mb-3">By 12-month job volume</p>
          <ResponsiveContainer width="100%" height={topRegions.length * 32 + 20}>
            <BarChart data={topRegions} layout="vertical" margin={{ top: 4, right: 48, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <YAxis type="category" dataKey="region" tick={{ fill: '#9ca3af', fontSize: 10 }} width={160} />
              <Tooltip content={<BarTip />} cursor={{ fill: 'rgba(220,38,38,0.06)' }} />
              <Bar dataKey="total" radius={[0, 2, 2, 0]} label={{ position: 'right', fontSize: 10, fill: '#9ca3af' }}>
                {topRegions.map((r, i) => (
                  <Cell key={r.region} fill={REGION_COLOURS[i % REGION_COLOURS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Region Analysis ─────────────────────────────────────────────────────

type RegionSortKey = 'region' | 'state' | 'total' | 'pct' | 'last3' | 'prior3' | 'change3' | 'last6' | 'prior6' | 'change6';

function RegionAnalysisTab({ data }: { data: LocationAnalyticsResult }) {
  const { regionSummary, totalJobs } = data;
  const [sort, setSort] = useState<RegionSortKey>('total');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (col: RegionSortKey) => {
    if (sort === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSort(col); setSortDir(col === 'region' || col === 'state' ? 'asc' : 'desc'); }
  };

  const sorted = [...regionSummary].sort((a, b) => {
    let cmp = 0;
    switch (sort) {
      case 'region':  cmp = a.region.localeCompare(b.region); break;
      case 'state':   cmp = a.state.localeCompare(b.state); break;
      case 'total':   cmp = a.total - b.total; break;
      case 'pct':     cmp = a.pct - b.pct; break;
      case 'last3':   cmp = a.last3 - b.last3; break;
      case 'prior3':  cmp = a.prior3 - b.prior3; break;
      case 'change3': cmp = a.change3mo - b.change3mo; break;
      case 'last6':   cmp = a.last6 - b.last6; break;
      case 'prior6':  cmp = a.prior6 - b.prior6; break;
      case 'change6': cmp = a.change6mo - b.change6mo; break;
    }
    return sortDir === 'desc' ? -cmp : cmp;
  });

  return (
    <div className="space-y-5">
      {/* Full-width stacked horizontal bar of all regions */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 min-w-0">
        <h3 className="text-base font-semibold text-white mb-1">All Regions — Volume</h3>
        <p className="text-xs text-gray-500 mb-3">{data.periodLabel} · colour-coded by state</p>
        <div className="overflow-x-auto">
          <BarChart width={Math.max(700, regionSummary.length * 38)} height={320}
            data={regionSummary} margin={{ top: 8, right: 16, left: 0, bottom: 100 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-45} textAnchor="end" interval={0} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} width={32} />
            <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
              <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-xl">
                <p className="text-gray-300 font-semibold">{label}</p>
                <p className="font-mono text-white">{payload[0].value} jobs · {pctFmt((payload[0].value as number) / totalJobs)}</p>
              </div>
            ) : null} cursor={{ fill: 'rgba(220,38,38,0.06)' }} />
            <Bar dataKey="total" radius={[2, 2, 0, 0]}>
              {regionSummary.map(r => (
                <Cell key={r.region} fill={STATE_COLOURS[r.state] ?? '#DC2626'} />
              ))}
            </Bar>
          </BarChart>
        </div>
        {/* State legend */}
        <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-gray-800">
          {Object.entries(STATE_COLOURS).filter(([s]) => data.stateBreakdown.some(r => r.state === s)).map(([state, col]) => (
            <span key={state} className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="w-3 h-3 rounded-sm" style={{ background: col }} />{state}
            </span>
          ))}
        </div>
      </div>

      {/* Growth table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-white">Region Growth Analysis</h3>
          <p className="text-xs text-gray-500">Click any column header to sort · 3-month and 6-month period comparisons</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                {([
                  ['region',  'Region',    'text-left',  'pr-3', 'min-w-[150px]'],
                  ['state',   'State',     'text-center','pr-3', ''],
                  ['total',   '12mo Total','text-right', 'pr-3', ''],
                  ['pct',     '% Share',   'text-right', 'pr-3', ''],
                  ['last3',   'Last 3mo',  'text-right', 'pr-3', ''],
                  ['prior3',  'Prior 3mo', 'text-right', 'pr-3', ''],
                  ['change3', '3mo Δ',     'text-right', 'pr-3', ''],
                  ['last6',   'Last 6mo',  'text-right', 'pr-3', ''],
                  ['prior6',  'Prior 6mo', 'text-right', 'pr-3', ''],
                  ['change6', '6mo Δ',     'text-right', '',     ''],
                ] as [RegionSortKey, string, string, string, string][]).map(([k, label, align, pr, extra]) => (
                  <th key={k}
                    onClick={() => handleSort(k)}
                    className={`py-2 font-medium cursor-pointer select-none hover:text-white transition-colors ${align} ${pr} ${extra} ${sort === k ? 'text-white' : ''}`}>
                    {label}{sort === k ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/30">
              {sorted.map(r => (
                <tr key={r.region} className="hover:bg-gray-800/30 transition-colors">
                  <td className="py-2 pr-3 text-gray-200 font-medium">{r.region}</td>
                  <td className="py-2 pr-3 text-center"><StateBadge state={r.state} /></td>
                  <td className="py-2 pr-3 text-right font-mono font-bold text-white">{r.total.toLocaleString()}</td>
                  <td className="py-2 pr-3 text-right text-gray-500">{pctFmt(r.pct)}</td>
                  <td className="py-2 pr-3 text-right font-mono text-gray-300">{r.last3}</td>
                  <td className="py-2 pr-3 text-right font-mono text-gray-500">{r.prior3}</td>
                  <td className="py-2 pr-3 text-right"><ChangeChip change={r.change3mo} size="sm" /></td>
                  <td className="py-2 pr-3 text-right font-mono text-gray-300">{r.last6}</td>
                  <td className="py-2 pr-3 text-right font-mono text-gray-500">{r.prior6}</td>
                  <td className="py-2 text-right"><ChangeChip change={r.change6mo} size="sm" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Monthly Trend ───────────────────────────────────────────────────────

function MonthlyTrendTab({ data }: { data: LocationAnalyticsResult }) {
  const { regionMonthlyTrend, regionSummary, months } = data;
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  // Default: top 8 regions selected
  const topRegions = regionSummary.slice(0, 8).map(r => r.region);
  const [selRegions, setSelRegions] = useState<Set<string>>(new Set(topRegions));

  const toggle = (r: string) => setSelRegions(prev => {
    const next = new Set(prev);
    if (next.has(r)) { if (next.size > 1) next.delete(r); } else next.add(r);
    return next;
  });

  const allRegions = regionSummary.map(r => r.region);

  return (
    <div className="space-y-5">
      {/* Chart type + region toggles */}
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex rounded-lg bg-gray-800 border border-gray-700 overflow-hidden flex-shrink-0">
          {(['line','bar'] as const).map(t => (
            <button key={t} onClick={() => setChartType(t)}
              className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${chartType === t ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {allRegions.map((r, i) => (
            <button key={r} onClick={() => toggle(r)}
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all ${selRegions.has(r) ? 'text-white border-transparent' : 'bg-gray-800 text-gray-600 border-gray-700 opacity-40 hover:opacity-70'}`}
              style={selRegions.has(r) ? { background: REGION_COLOURS[i % REGION_COLOURS.length], borderColor: REGION_COLOURS[i % REGION_COLOURS.length] } : {}}>
              {r.replace('Sydney Metro ', 'Syd ').replace('NSW ', '').replace(' Valley', '')}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-base font-semibold text-white mb-1">Monthly Job Volume by Region</h3>
        <p className="text-xs text-gray-500 mb-4">{data.periodLabel}</p>
        <ResponsiveContainer width="100%" height={360}>
          {chartType === 'line' ? (
            <LineChart data={regionMonthlyTrend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} width={30} />
              <Tooltip content={<LineTip />} />
              <Legend wrapperStyle={{ fontSize: 10 }}
                formatter={(v) => { const idx = allRegions.indexOf(String(v)); return <span style={{ color: REGION_COLOURS[idx >= 0 ? idx % REGION_COLOURS.length : 0] }}>{String(v).replace('Sydney Metro ','Syd ').replace('NSW ','')}</span>; }} />
              {allRegions.filter(r => selRegions.has(r)).map((r) => (
                <Line key={r} type="monotone" dataKey={r} stroke={REGION_COLOURS[allRegions.indexOf(r) % REGION_COLOURS.length]}
                  strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
              ))}
            </LineChart>
          ) : (
            <BarChart data={regionMonthlyTrend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} width={30} />
              <Tooltip content={<LineTip />} />
              <Legend wrapperStyle={{ fontSize: 10 }}
                formatter={(v) => { const idx = allRegions.indexOf(String(v)); return <span style={{ color: REGION_COLOURS[idx >= 0 ? idx % REGION_COLOURS.length : 0] }}>{String(v).replace('Sydney Metro ','Syd ').replace('NSW ','')}</span>; }} />
              {allRegions.filter(r => selRegions.has(r)).map((r, idx, arr) => (
                <Bar key={r} dataKey={r} stackId="a" fill={REGION_COLOURS[allRegions.indexOf(r) % REGION_COLOURS.length]}
                  radius={idx === arr.length - 1 ? [2, 2, 0, 0] : [0, 0, 0, 0]} />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Monthly table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-base font-semibold text-white mb-4">Monthly Totals by Region</h3>
        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left py-2 pr-3 font-medium sticky left-0 bg-gray-900 min-w-[150px]">Region</th>
                {months.map(m => <th key={m} className="text-right py-2 pr-2 font-medium whitespace-nowrap">{m}</th>)}
                <th className="text-right py-2 font-medium text-gray-400">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/30">
              {regionSummary.map((r, i) => (
                <tr key={r.region} className="hover:bg-gray-800/30">
                  <td className="py-2 pr-3 font-medium sticky left-0 bg-gray-900" style={{ color: REGION_COLOURS[i % REGION_COLOURS.length] }}>
                    {r.region}
                  </td>
                  {regionMonthlyTrend.map(m => {
                    const v = m[r.region] as number || 0;
                    return <td key={m.month} className={`py-2 pr-2 text-right font-mono ${v > 0 ? 'text-gray-300' : 'text-gray-700'}`}>{v || '—'}</td>;
                  })}
                  <td className="py-2 text-right font-mono font-bold text-white">{r.total}</td>
                </tr>
              ))}
              <tr className="border-t border-gray-700">
                <td className="py-2 pr-3 font-bold text-white sticky left-0 bg-gray-900">TOTAL</td>
                {regionMonthlyTrend.map(m => {
                  const total = regionSummary.reduce((s, r) => s + ((m[r.region] as number) || 0), 0);
                  return <td key={m.month} className="py-2 pr-2 text-right font-mono font-bold text-gray-200">{total}</td>;
                })}
                <td className="py-2 text-right font-mono font-bold text-white">{data.totalJobs}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Top Suburbs ─────────────────────────────────────────────────────────

function SuburbsTab({ data }: { data: LocationAnalyticsResult }) {
  const { topSuburbs, totalJobs } = data;
  const [filterState, setFilterState] = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [limit, setLimit] = useState(50);

  const states  = Array.from(new Set(topSuburbs.map(s => s.state))).sort();
  const regions = Array.from(new Set(topSuburbs.map(s => s.region))).sort();

  const filtered = topSuburbs.filter(s =>
    (!filterState  || s.state  === filterState) &&
    (!filterRegion || s.region === filterRegion)
  );

  const top15 = filtered.slice(0, 15);

  return (
    <div className="space-y-5">

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select value={filterState} onChange={e => { setFilterState(e.target.value); setLimit(25); }}
          className="bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-500">
          <option value="">All States</option>
          {states.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterRegion} onChange={e => { setFilterRegion(e.target.value); setLimit(25); }}
          className="bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-500">
          <option value="">All Regions</option>
          {regions.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        {(filterState || filterRegion) && (
          <button onClick={() => { setFilterState(''); setFilterRegion(''); }}
            className="text-xs text-gray-400 hover:text-white bg-gray-800 border border-gray-700 px-3 py-2 rounded-lg transition-colors">
            Clear
          </button>
        )}
        <span className="self-center text-xs text-gray-600 ml-1">{filtered.length} suburbs</span>
      </div>

      {/* Horizontal bar — top 15 of filtered */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
          <MapPin size={15} className="text-red-500" />
          Top 15 Suburbs {filterState || filterRegion ? '(filtered)' : ''}
        </h3>
        <p className="text-xs text-gray-500 mb-4">{data.periodLabel} · colour-coded by state</p>
        <ResponsiveContainer width="100%" height={top15.length * 32 + 20}>
          <BarChart data={top15} layout="vertical" margin={{ top: 4, right: 48, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
            <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 10 }} />
            <YAxis type="category" dataKey="suburb" tick={{ fill: '#9ca3af', fontSize: 10 }} width={130} />
            <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
              <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-xl">
                <p className="text-gray-200 font-semibold">{label}</p>
                <p className="text-gray-400">{top15.find(s => s.suburb === label)?.region}</p>
                <p className="font-mono text-white mt-1">{payload[0].value} jobs · {pctFmt((payload[0].value as number) / totalJobs, 2)}</p>
              </div>
            ) : null} />
            <Bar dataKey="jobs" radius={[0, 2, 2, 0]} label={{ position: 'right', fontSize: 10, fill: '#9ca3af' }}>
              {top15.map(s => <Cell key={s.suburb} fill={STATE_COLOURS[s.state] ?? '#DC2626'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Full ranked table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-base font-semibold text-white mb-4">Suburb Rankings</h3>
        <p className="text-xs text-gray-600 mb-3">Showing top 50 suburbs by job volume · use filters above to narrow by state or region</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left py-2 pr-3 font-medium w-10">#</th>
                <th className="text-left py-2 pr-3 font-medium">Suburb</th>
                <th className="text-left py-2 pr-3 font-medium">State</th>
                <th className="text-left py-2 pr-3 font-medium hidden md:table-cell">Region</th>
                <th className="text-right py-2 pr-3 font-medium">Jobs</th>
                <th className="text-left py-2 font-medium">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/30">
              {filtered.slice(0, limit).map((s, idx) => (
                <tr key={s.suburb} className="hover:bg-gray-800/30 transition-colors">
                  <td className="py-2 pr-3 text-gray-600 font-mono">{idx + 1}</td>
                  <td className="py-2 pr-3 text-gray-200 font-medium">{s.suburb}</td>
                  <td className="py-2 pr-3"><StateBadge state={s.state} /></td>
                  <td className="py-2 pr-3 text-gray-500 hidden md:table-cell">{s.region}</td>
                  <td className="py-2 pr-3 text-right font-mono font-bold text-white">{s.jobs}</td>
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-gray-800 rounded-full h-1.5 overflow-hidden flex-shrink-0">
                        <div className="h-full rounded-full" style={{
                          width: `${(s.jobs / (filtered[0]?.jobs || 1)) * 100}%`,
                          background: STATE_COLOURS[s.state] ?? '#DC2626',
                        }} />
                      </div>
                      <span className="text-gray-500 font-mono">{pctFmt(s.pct, 2)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > limit && (
            <button onClick={() => setLimit(l => l + 25)}
              className="mt-3 w-full text-center text-xs text-gray-500 hover:text-white border border-gray-800 hover:border-gray-600 rounded-lg py-2 transition-colors">
              Show more ({filtered.length - limit} remaining)
            </button>
          )}
          {filtered.length === 0 && (
            <p className="text-center text-gray-600 py-8">No suburbs match the current filters</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LocationsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [data, setData]           = useState<LocationAnalyticsResult | null>(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const load = useCallback(async (bust = false) => {
    try {
      const res = await fetch(`/api/prime/jobs/location-analytics${bust ? '?bust=1' : ''}`);
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  };

  const generatedLabel = data?.generatedAt ? (() => {
    const d = new Date(data.generatedAt);
    const dateStr = d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
    const timeStr = d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
    const ms = Date.now() - d.getTime();
    const h = Math.floor(ms / 3600000);
    const days = Math.floor(h / 24);
    const ago = days > 0 ? `${days}d ago` : h > 0 ? `${h}h ago` : 'just now';
    return `${dateStr} at ${timeStr} (${ago})`;
  })() : null;

  return (
    <div>
      <PageHeader
        title="Jobs by Location"
        subtitle={data
          ? `${data.periodLabel} · ${data.totalJobs.toLocaleString()} jobs across ${data.regionsActive} regions · live from Prime`
          : 'Region, suburb and state breakdown — last 12 months'}
      />

      {/* Cache age + refresh */}
      <div className="flex items-center gap-3 mb-5 text-xs text-gray-500">
        {generatedLabel && (
          <span className="flex items-center gap-1.5">
            <Clock size={12} />
            Last updated {generatedLabel} · auto-refreshes every Friday 6 PM AEST
          </span>
        )}
        <button onClick={handleRefresh} disabled={loading || refreshing}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors disabled:opacity-40">
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing…' : 'Refresh now'}
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <LoadingSpinner message="Fetching 12 months of Prime data…" />
          <p className="text-xs text-gray-600">First load pulls all jobs from Prime — may take 1–2 min</p>
        </div>
      ) : error ? (
        <div className="bg-red-900/20 border border-red-800/40 rounded-xl p-5 text-red-400 text-sm">{error}</div>
      ) : data ? (
        <>
          {/* Tab bar */}
          <div className="flex gap-1 mb-6 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit flex-wrap">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === t.id ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {activeTab === 'overview'  && <OverviewTab data={data} />}
          {activeTab === 'regions'   && <RegionAnalysisTab data={data} />}
          {activeTab === 'trend'     && <MonthlyTrendTab data={data} />}
          {activeTab === 'suburbs'   && <SuburbsTab data={data} />}
        </>
      ) : null}
    </div>
  );
}
