'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  LineChart, Line,
} from 'recharts';
import { TrendingDown, TrendingUp, Minus, RefreshCw, Clock, MapPin, ArrowUpRight, ArrowDownRight } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

const KNOWN_CLIENTS = ['Suncorp', 'Youi', 'Hollard', 'Allianz', 'Guild', 'Others'] as const;
type ClientName = typeof KNOWN_CLIENTS[number];

interface ClientSummaryRow  { client: ClientName; total: number; pct: number; last3: number; prior3: number; change: number; }
interface RegionRow          { region: string; Suncorp: number; Youi: number; Hollard: number; Allianz: number; Guild: number; Others: number; total: number; }
interface RegionGrowthRow    { region: string; total: number; last3: number; prior3: number; change3mo: number; last6: number; prior6: number; change6mo: number; pct: number; state: string; }
interface MonthlyRow         { month: string; Suncorp: number; Youi: number; Hollard: number; Allianz: number; Guild: number; Others: number; }
interface RegionMonthlyRow   { month: string; [region: string]: number | string; }
interface RegionClientMonthly { region: string; client: ClientName; months: number[]; }
interface SuburbRow          { rank: number; suburb: string; state: string; jobs: number; pct: number; }
interface StateRow           { state: string; jobs: number; pct: number; }

interface ClientAnalyticsResult {
  generatedAt: string;
  periodLabel: string;
  months: string[];
  totalJobs: number;
  clientSummary: ClientSummaryRow[];
  regionData: RegionRow[];
  monthlyTrend: MonthlyRow[];
  regionClientDetail: RegionClientMonthly[];
  regionGrowth: RegionGrowthRow[];
  regionMonthlyTrend: RegionMonthlyRow[];
  topSuburbs: SuburbRow[];
  stateBreakdown: StateRow[];
}

// ─── Colours ──────────────────────────────────────────────────────────────────

const CLIENT_COLOURS: Record<string, string> = {
  Suncorp: '#DC2626', Youi: '#F97316', Hollard: '#EAB308',
  Allianz: '#22C55E', Guild: '#3B82F6', Others: '#6B7280',
};

const STATE_COLOURS: Record<string, string> = {
  NSW: '#DC2626', QLD: '#F97316', ACT: '#3B82F6', VIC: '#8B5CF6', SA: '#22C55E', WA: '#EAB308', NT: '#6B7280', TAS: '#EC4899',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pctFmt(n: number, dp = 1) { return (n * 100).toFixed(dp) + '%'; }
function absFmt(n: number) { return n > 0 ? `+${(n * 100).toFixed(0)}%` : `${(n * 100).toFixed(0)}%`; }

function ChangeChip({ change, size = 'md' }: { change: number; size?: 'sm' | 'md' }) {
  const cls = size === 'sm' ? 'text-[9px] px-1 py-0.5' : 'text-[10px] px-1.5 py-0.5';
  if (change === 0) return (
    <span className={`inline-flex items-center gap-0.5 font-semibold rounded-full bg-gray-800 text-gray-400 ${cls}`}><Minus size={9} />0%</span>
  );
  if (change > 0) return (
    <span className={`inline-flex items-center gap-0.5 font-semibold rounded-full bg-red-900/30 text-red-400 ${cls}`}><ArrowUpRight size={9} />{absFmt(change)}</span>
  );
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold rounded-full bg-green-900/40 text-green-400 ${cls}`}><ArrowDownRight size={9} />{absFmt(change)}</span>
  );
}

// ─── Tooltips ─────────────────────────────────────────────────────────────────

function PieTip({ active, payload, total }: { active?: boolean; payload?: { name: string; value: number }[]; total: number }) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm shadow-xl">
      <p className="font-semibold" style={{ color: CLIENT_COLOURS[name] ?? STATE_COLOURS[name] ?? '#fff' }}>{name}</p>
      <p className="text-gray-300">{value} jobs — {pctFmt(value / total)}</p>
    </div>
  );
}

function StackTip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (p.value ?? 0), 0);
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-xs shadow-xl min-w-[140px]">
      <p className="text-gray-400 font-semibold mb-1.5">{label} — {total} jobs</p>
      {[...payload].sort((a, b) => b.value - a.value).filter(p => p.value > 0).map(p => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="text-white font-mono">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'summary' | 'region' | 'trend' | 'detail' | 'location';
const TABS: { id: Tab; label: string }[] = [
  { id: 'summary',  label: 'Client Summary' },
  { id: 'region',   label: 'By Region' },
  { id: 'trend',    label: 'Monthly Trend' },
  { id: 'detail',   label: 'Region Detail' },
  { id: 'location', label: 'Location & Suburbs' },
];

// ─── Tab: Client Summary ──────────────────────────────────────────────────────

function ClientSummaryTab({ data }: { data: ClientAnalyticsResult }) {
  const { clientSummary, totalJobs } = data;
  const pieData = clientSummary.map(c => ({ name: c.client, value: c.total }));
  return (
    <div className="space-y-6">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-base font-semibold text-white mb-1">Jobs by Client — {data.periodLabel}</h3>
        <p className="text-xs text-gray-500 mb-4">{totalJobs.toLocaleString()} total jobs (excl. ABE)</p>
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="w-full md:w-64 h-64 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={110} paddingAngle={2} dataKey="value">
                  {pieData.map(e => <Cell key={e.name} fill={CLIENT_COLOURS[e.name]} />)}
                </Pie>
                <Tooltip content={<PieTip total={totalJobs} />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 gap-3 flex-1">
            {clientSummary.map(c => (
              <div key={c.client} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: CLIENT_COLOURS[c.client] }} />
                <div>
                  <p className="text-sm font-semibold text-white">{c.client}</p>
                  <p className="text-xs text-gray-500">{c.total.toLocaleString()} · {pctFmt(c.pct)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-base font-semibold text-white mb-4">3-Month Comparison</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-800">
                <th className="text-left py-2 pr-4 font-medium">Client</th>
                <th className="text-right py-2 pr-4 font-medium">12mo Total</th>
                <th className="text-right py-2 pr-4 font-medium">% Share</th>
                <th className="text-right py-2 pr-4 font-medium">Last 3 Mo</th>
                <th className="text-right py-2 pr-4 font-medium">Prior 3 Mo</th>
                <th className="text-right py-2 font-medium">Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/40">
              {clientSummary.map(c => (
                <tr key={c.client} className="hover:bg-gray-800/30 transition-colors">
                  <td className="py-2.5 pr-4"><div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: CLIENT_COLOURS[c.client] }} /><span className="font-semibold text-white">{c.client}</span></div></td>
                  <td className="py-2.5 pr-4 text-right font-mono text-gray-300">{c.total.toLocaleString()}</td>
                  <td className="py-2.5 pr-4 text-right text-gray-400">{pctFmt(c.pct)}</td>
                  <td className="py-2.5 pr-4 text-right font-mono text-gray-300">{c.last3}</td>
                  <td className="py-2.5 pr-4 text-right font-mono text-gray-400">{c.prior3}</td>
                  <td className="py-2.5 text-right"><ChangeChip change={c.change} /></td>
                </tr>
              ))}
              <tr className="border-t border-gray-700">
                <td className="py-2.5 pr-4 font-bold text-white">TOTAL</td>
                <td className="py-2.5 pr-4 text-right font-bold font-mono text-white">{totalJobs.toLocaleString()}</td>
                <td colSpan={4} />
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: By Region ───────────────────────────────────────────────────────────

function ByRegionTab({ data }: { data: ClientAnalyticsResult }) {
  const { regionData } = data;
  const [sel, setSel] = useState<ClientName | 'all'>('all');
  const active = sel === 'all' ? KNOWN_CLIENTS : [sel];
  const w = Math.max(700, regionData.length * 38);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setSel('all')} className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${sel === 'all' ? 'bg-gray-200 text-gray-900' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>All Clients</button>
        {KNOWN_CLIENTS.map(c => (
          <button key={c} onClick={() => setSel(c === sel ? 'all' : c)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${sel === c ? 'text-white border-transparent' : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white'}`}
            style={sel === c ? { background: CLIENT_COLOURS[c], borderColor: CLIENT_COLOURS[c] } : {}}>
            {c}
          </button>
        ))}
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-base font-semibold text-white mb-1">Jobs by Region</h3>
        <p className="text-xs text-gray-500 mb-4">{data.periodLabel} · sorted by volume · scroll →</p>
        <div className="overflow-x-auto">
          <div style={{ width: w, minWidth: '100%' }}>
            <BarChart width={w} height={340} data={regionData} margin={{ top: 8, right: 8, left: 0, bottom: 90 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-45} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} width={30} />
              <Tooltip content={<StackTip />} cursor={{ fill: 'rgba(220,38,38,0.06)' }} />
              <Legend wrapperStyle={{ paddingTop: 8, fontSize: 11 }} formatter={v => <span style={{ color: CLIENT_COLOURS[v as ClientName] ?? '#9ca3af' }}>{v}</span>} />
              {active.map((c, i, arr) => <Bar key={c} dataKey={c} stackId="a" fill={CLIENT_COLOURS[c]} radius={i === arr.length - 1 ? [2, 2, 0, 0] : [0, 0, 0, 0]} />)}
            </BarChart>
          </div>
        </div>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-base font-semibold text-white mb-4">Region × Client Table</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left py-2 pr-3 font-medium min-w-[160px]">Region</th>
                {KNOWN_CLIENTS.map(c => <th key={c} className="text-right py-2 pr-3 font-medium" style={{ color: CLIENT_COLOURS[c] }}>{c}</th>)}
                <th className="text-right py-2 font-medium text-gray-400">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/30">
              {regionData.map(r => (
                <tr key={r.region} className="hover:bg-gray-800/30 transition-colors">
                  <td className="py-2 pr-3 text-gray-300 font-medium">{r.region}</td>
                  {KNOWN_CLIENTS.map(c => <td key={c} className="py-2 pr-3 text-right font-mono" style={{ color: r[c] ? CLIENT_COLOURS[c] : '#374151' }}>{r[c] || '—'}</td>)}
                  <td className="py-2 text-right font-mono font-bold text-white">{r.total}</td>
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

function MonthlyTrendTab({ data }: { data: ClientAnalyticsResult }) {
  const { monthlyTrend } = data;
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  const [selClients, setSelClients] = useState<Set<ClientName>>(new Set(KNOWN_CLIENTS));
  const toggle = (c: ClientName) => setSelClients(prev => {
    const next = new Set(prev);
    if (next.has(c)) { if (next.size > 1) next.delete(c); } else next.add(c);
    return next;
  });
  const totals = monthlyTrend.map(m => ({ ...m, total: KNOWN_CLIENTS.reduce((s, c) => s + (m[c] ?? 0), 0) }));
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg bg-gray-800 border border-gray-700 overflow-hidden">
          {(['line','bar'] as const).map(t => <button key={t} onClick={() => setChartType(t)} className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${chartType === t ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}>{t}</button>)}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {KNOWN_CLIENTS.map(c => (
            <button key={c} onClick={() => toggle(c)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all border ${selClients.has(c) ? 'text-white border-transparent' : 'bg-gray-800 text-gray-600 border-gray-700 opacity-40'}`}
              style={selClients.has(c) ? { background: CLIENT_COLOURS[c], borderColor: CLIENT_COLOURS[c] } : {}}>
              {c}
            </button>
          ))}
        </div>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-base font-semibold text-white mb-1">Monthly Job Volumes — {data.periodLabel}</h3>
        <ResponsiveContainer width="100%" height={340}>
          {chartType === 'line' ? (
            <LineChart data={monthlyTrend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} width={30} />
              <Tooltip content={<StackTip />} />
              <Legend formatter={v => <span style={{ color: CLIENT_COLOURS[v as ClientName] ?? '#9ca3af' }}>{v}</span>} />
              {KNOWN_CLIENTS.filter(c => selClients.has(c)).map(c => (
                <Line key={c} type="monotone" dataKey={c} stroke={CLIENT_COLOURS[c]} strokeWidth={2} dot={{ r: 3, fill: CLIENT_COLOURS[c] }} activeDot={{ r: 5 }} />
              ))}
            </LineChart>
          ) : (
            <BarChart data={monthlyTrend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} width={30} />
              <Tooltip content={<StackTip />} />
              <Legend formatter={v => <span style={{ color: CLIENT_COLOURS[v as ClientName] ?? '#9ca3af' }}>{v}</span>} />
              {KNOWN_CLIENTS.filter(c => selClients.has(c)).map((c, i, arr) => (
                <Bar key={c} dataKey={c} stackId="a" fill={CLIENT_COLOURS[c]} radius={i === arr.length - 1 ? [2, 2, 0, 0] : [0, 0, 0, 0]} />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-base font-semibold text-white mb-4">Monthly Totals by Client</h3>
        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left py-2 pr-3 font-medium sticky left-0 bg-gray-900">Client</th>
                {data.months.map(m => <th key={m} className="text-right py-2 pr-2 font-medium whitespace-nowrap">{m}</th>)}
                <th className="text-right py-2 font-medium text-gray-400">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/30">
              {KNOWN_CLIENTS.map(c => {
                const rowTotal = monthlyTrend.reduce((s, m) => s + (m[c] ?? 0), 0);
                return (
                  <tr key={c} className="hover:bg-gray-800/30">
                    <td className="py-2 pr-3 font-semibold sticky left-0 bg-gray-900" style={{ color: CLIENT_COLOURS[c] }}>{c}</td>
                    {monthlyTrend.map(m => <td key={m.month} className={`py-2 pr-2 text-right font-mono ${m[c] > 0 ? 'text-gray-300' : 'text-gray-700'}`}>{m[c] || '—'}</td>)}
                    <td className="py-2 text-right font-mono font-bold text-white">{rowTotal}</td>
                  </tr>
                );
              })}
              <tr className="border-t border-gray-700">
                <td className="py-2 pr-3 font-bold text-white sticky left-0 bg-gray-900">TOTAL</td>
                {totals.map(m => <td key={m.month} className="py-2 pr-2 text-right font-mono font-bold text-gray-200">{m.total}</td>)}
                <td className="py-2 text-right font-mono font-bold text-white">{data.totalJobs}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Region Detail ───────────────────────────────────────────────────────

function RegionDetailTab({ data }: { data: ClientAnalyticsResult }) {
  const { regionClientDetail, months } = data;
  const allRegions = Array.from(new Set(regionClientDetail.map(r => r.region))).sort(
    (a, b) => regionClientDetail.filter(r => r.region === b).reduce((s, r) => s + r.months.reduce((x, v) => x + v, 0), 0)
           - regionClientDetail.filter(r => r.region === a).reduce((s, r) => s + r.months.reduce((x, v) => x + v, 0), 0)
  );
  const [selRegion, setSelRegion] = useState(allRegions[0] || '');
  const rows = regionClientDetail.filter(r => r.region === selRegion);
  const chartData = months.map((month, i) => {
    const e: Record<string, string | number> = { month };
    rows.forEach(r => { e[r.client] = r.months[i] || 0; });
    return e;
  });
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {allRegions.slice(0, 22).map(r => (
          <button key={r} onClick={() => setSelRegion(r)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${selRegion === r ? 'bg-red-600 text-white border-transparent' : 'bg-gray-800 text-gray-400 hover:text-white border-gray-700'}`}>
            {r}
          </button>
        ))}
        {allRegions.length > 22 && <span className="self-center text-xs text-gray-600">+{allRegions.length - 22} more</span>}
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-base font-semibold text-white mb-1">{selRegion} — Monthly by Client</h3>
        <p className="text-xs text-gray-500 mb-4">{data.periodLabel}</p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} width={28} />
            <Tooltip content={<StackTip />} />
            <Legend formatter={v => <span style={{ color: CLIENT_COLOURS[v as ClientName] ?? '#9ca3af' }}>{v}</span>} />
            {rows.map((r, i, arr) => <Bar key={r.client} dataKey={r.client} stackId="a" fill={CLIENT_COLOURS[r.client]} radius={i === arr.length - 1 ? [2, 2, 0, 0] : [0, 0, 0, 0]} />)}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-base font-semibold text-white mb-4">Monthly Breakdown — {selRegion}</h3>
        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left py-2 pr-3 font-medium">Client</th>
                {months.map(m => <th key={m} className="text-right py-2 pr-2 font-medium whitespace-nowrap">{m}</th>)}
                <th className="text-right py-2 font-medium text-gray-400">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/30">
              {rows.map(r => {
                const total = r.months.reduce((s, v) => s + v, 0);
                return (
                  <tr key={r.client} className="hover:bg-gray-800/30">
                    <td className="py-2 pr-3 font-semibold" style={{ color: CLIENT_COLOURS[r.client] }}>{r.client}</td>
                    {r.months.map((v, i) => <td key={i} className={`py-2 pr-2 text-right font-mono ${v > 0 ? 'text-gray-300' : 'text-gray-700'}`}>{v || '—'}</td>)}
                    <td className="py-2 text-right font-mono font-bold text-white">{total}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={months.length + 2} className="py-6 text-center text-gray-500">No data for this region</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Location & Suburbs ──────────────────────────────────────────────────

function LocationTab({ data }: { data: ClientAnalyticsResult }) {
  const { regionGrowth, topSuburbs, stateBreakdown, totalJobs } = data;
  const [suburbLimit, setSuburbLimit] = useState(20);
  const [sortGrowth, setSortGrowth] = useState<'total' | 'change3' | 'change6'>('total');

  const sortedRegions = [...regionGrowth].sort((a, b) => {
    if (sortGrowth === 'change3') return b.change3mo - a.change3mo;
    if (sortGrowth === 'change6') return b.change6mo - a.change6mo;
    return b.total - a.total;
  });

  const statePieData = stateBreakdown.map(s => ({ name: s.state, value: s.jobs }));

  // Bar chart — top 15 regions by total
  const regionBarData = [...regionGrowth].sort((a, b) => b.total - a.total).slice(0, 15);

  // Top suburbs bar (top 15)
  const suburbBarData = topSuburbs.slice(0, 15).map(s => ({ name: s.suburb, jobs: s.jobs, state: s.state }));

  return (
    <div className="space-y-6">

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Jobs', value: totalJobs.toLocaleString() },
          { label: 'Top Region', value: regionGrowth[0]?.region?.replace(' Metro', '') ?? '—' },
          { label: 'Top State', value: stateBreakdown[0]?.state ?? '—' },
          { label: 'Regions Active', value: regionGrowth.length.toString() },
        ].map(kpi => (
          <div key={kpi.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">{kpi.label}</p>
            <p className="text-lg font-bold text-white leading-tight">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* State breakdown + Region bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* State pie */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-base font-semibold text-white mb-1">Jobs by State</h3>
          <p className="text-xs text-gray-500 mb-3">{data.periodLabel}</p>
          <div className="flex items-center gap-4">
            <div className="w-44 h-44 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statePieData} cx="50%" cy="50%" innerRadius={42} outerRadius={78} paddingAngle={3} dataKey="value">
                    {statePieData.map(e => <Cell key={e.name} fill={STATE_COLOURS[e.name] ?? '#6B7280'} />)}
                  </Pie>
                  <Tooltip content={<PieTip total={totalJobs} />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 flex-1">
              {stateBreakdown.map(s => (
                <div key={s.state} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: STATE_COLOURS[s.state] ?? '#6B7280' }} />
                  <span className="text-sm font-semibold text-white w-10">{s.state}</span>
                  <div className="flex-1 bg-gray-800 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: pctFmt(s.pct), background: STATE_COLOURS[s.state] ?? '#6B7280' }} />
                  </div>
                  <span className="text-xs font-mono text-gray-400 w-16 text-right">{s.jobs.toLocaleString()} · {pctFmt(s.pct, 1)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top 15 regions bar */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-base font-semibold text-white mb-1">Top 15 Regions</h3>
          <p className="text-xs text-gray-500 mb-3">By total job volume</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={regionBarData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 10 }} width={30} />
              <YAxis type="category" dataKey="region" tick={{ fill: '#9ca3af', fontSize: 10 }} width={140} />
              <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
                <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-xl">
                  <p className="text-gray-300 font-semibold">{label}</p>
                  <p className="text-red-400 font-mono">{payload[0].value} jobs</p>
                </div>
              ) : null} />
              <Bar dataKey="total" fill="#DC2626" radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Region growth table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-white">Region Growth Analysis</h3>
            <p className="text-xs text-gray-500">{data.periodLabel} — 3mo and 6mo period comparisons</p>
          </div>
          <div className="flex rounded-lg bg-gray-800 border border-gray-700 overflow-hidden text-xs">
            {([['total','Volume'],['change3','3mo Δ'],['change6','6mo Δ']] as const).map(([k, l]) => (
              <button key={k} onClick={() => setSortGrowth(k)}
                className={`px-2.5 py-1.5 transition-colors ${sortGrowth === k ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left py-2 pr-3 font-medium min-w-[150px]">Region</th>
                <th className="text-center py-2 pr-3 font-medium w-10">State</th>
                <th className="text-right py-2 pr-3 font-medium">12mo</th>
                <th className="text-right py-2 pr-3 font-medium">% Share</th>
                <th className="text-right py-2 pr-3 font-medium">Last 3mo</th>
                <th className="text-right py-2 pr-3 font-medium">Prior 3mo</th>
                <th className="text-right py-2 pr-3 font-medium">3mo Δ</th>
                <th className="text-right py-2 pr-3 font-medium">Last 6mo</th>
                <th className="text-right py-2 pr-3 font-medium">Prior 6mo</th>
                <th className="text-right py-2 font-medium">6mo Δ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/30">
              {sortedRegions.map(r => (
                <tr key={r.region} className="hover:bg-gray-800/30 transition-colors">
                  <td className="py-2 pr-3 text-gray-300 font-medium">{r.region}</td>
                  <td className="py-2 pr-3 text-center">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: (STATE_COLOURS[r.state] ?? '#6B7280') + '33', color: STATE_COLOURS[r.state] ?? '#9ca3af' }}>{r.state}</span>
                  </td>
                  <td className="py-2 pr-3 text-right font-mono text-white font-bold">{r.total}</td>
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

      {/* Top suburbs */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2"><MapPin size={16} className="text-red-500" />Top Suburbs by Job Volume</h3>
            <p className="text-xs text-gray-500">{data.periodLabel} · derived from Prime job addresses</p>
          </div>
        </div>

        {/* Bar chart — top 15 */}
        <div className="mb-5">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={suburbBarData} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} width={120} />
              <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
                <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-xl">
                  <p className="text-gray-300 font-semibold">{label}</p>
                  <p className="text-red-400 font-mono">{payload[0].value} jobs</p>
                </div>
              ) : null} />
              <Bar dataKey="jobs" radius={[0, 2, 2, 0]}>
                {suburbBarData.map(entry => (
                  <Cell key={entry.name} fill={STATE_COLOURS[entry.state] ?? '#DC2626'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Full table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left py-2 pr-3 font-medium w-10">#</th>
                <th className="text-left py-2 pr-3 font-medium">Suburb</th>
                <th className="text-left py-2 pr-3 font-medium">State</th>
                <th className="text-right py-2 pr-3 font-medium">Jobs</th>
                <th className="text-left py-2 font-medium">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/30">
              {topSuburbs.slice(0, suburbLimit).map(s => (
                <tr key={s.suburb} className="hover:bg-gray-800/30 transition-colors">
                  <td className="py-2 pr-3 text-gray-600 font-mono">{s.rank}</td>
                  <td className="py-2 pr-3 text-gray-200 font-medium">{s.suburb}</td>
                  <td className="py-2 pr-3">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: (STATE_COLOURS[s.state] ?? '#6B7280') + '33', color: STATE_COLOURS[s.state] ?? '#9ca3af' }}>{s.state}</span>
                  </td>
                  <td className="py-2 pr-3 text-right font-mono text-white">{s.jobs}</td>
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-800 rounded-full h-1.5 w-24 overflow-hidden">
                        <div className="h-full bg-red-600 rounded-full" style={{ width: `${(s.jobs / (topSuburbs[0]?.jobs || 1)) * 100}%` }} />
                      </div>
                      <span className="text-gray-500 font-mono w-10">{pctFmt(s.pct, 2)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {topSuburbs.length > suburbLimit && (
            <button onClick={() => setSuburbLimit(l => l + 20)} className="mt-3 text-xs text-gray-500 hover:text-white transition-colors w-full text-center py-2 border border-gray-800 rounded-lg hover:border-gray-600">
              Show more ({topSuburbs.length - suburbLimit} remaining)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClientsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const [data, setData] = useState<ClientAnalyticsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (bust = false) => {
    try {
      const res = await fetch(`/api/prime/jobs/client-analytics${bust ? '?bust=1' : ''}`);
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

  const generatedAgo = data?.generatedAt ? (() => {
    const ms = Date.now() - new Date(data.generatedAt).getTime();
    const h = Math.floor(ms / 3600000);
    const d = Math.floor(h / 24);
    if (d > 0) return `${d}d ago`;
    if (h > 0) return `${h}h ago`;
    return 'just now';
  })() : null;

  return (
    <div>
      <PageHeader
        title="Client Analytics"
        subtitle={data
          ? `${data.periodLabel} · ${data.totalJobs.toLocaleString()} jobs · live from Prime`
          : 'Jobs by client, region, and location — last 12 months'}
      />

      <div className="flex items-center gap-3 mb-5 text-xs text-gray-500">
        {generatedAgo && (
          <span className="flex items-center gap-1.5"><Clock size={12} />Data from {generatedAgo} · auto-refreshes every Friday 6 PM AEST</span>
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
          <div className="flex gap-1 mb-6 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit flex-wrap">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === t.id ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
                {t.label}
              </button>
            ))}
          </div>
          {activeTab === 'summary'  && <ClientSummaryTab data={data} />}
          {activeTab === 'region'   && <ByRegionTab data={data} />}
          {activeTab === 'trend'    && <MonthlyTrendTab data={data} />}
          {activeTab === 'detail'   && <RegionDetailTab data={data} />}
          {activeTab === 'location' && <LocationTab data={data} />}
        </>
      ) : null}
    </div>
  );
}
