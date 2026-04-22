'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  LineChart, Line,
} from 'recharts';
import { TrendingDown, TrendingUp, Minus, RefreshCw, Clock } from 'lucide-react';

// ─── Types (mirrors API route) ────────────────────────────────────────────────

const KNOWN_CLIENTS = ['Suncorp', 'Youi', 'Hollard', 'Allianz', 'Guild', 'Others'] as const;
type ClientName = typeof KNOWN_CLIENTS[number];

interface ClientSummaryRow {
  client: ClientName;
  total: number;
  pct: number;
  last3: number;
  prior3: number;
  change: number;
}

interface RegionRow {
  region: string;
  Suncorp: number;
  Youi: number;
  Hollard: number;
  Allianz: number;
  Guild: number;
  Others: number;
  total: number;
}

interface MonthlyRow {
  month: string;
  Suncorp: number;
  Youi: number;
  Hollard: number;
  Allianz: number;
  Guild: number;
  Others: number;
}

interface RegionClientMonthly {
  region: string;
  client: ClientName;
  months: number[];
}

interface ClientAnalyticsResult {
  generatedAt: string;
  periodLabel: string;
  months: string[];
  totalJobs: number;
  clientSummary: ClientSummaryRow[];
  regionData: RegionRow[];
  monthlyTrend: MonthlyRow[];
  regionClientDetail: RegionClientMonthly[];
}

// ─── Colour palette ───────────────────────────────────────────────────────────

const CLIENT_COLOURS: Record<string, string> = {
  Suncorp: '#DC2626',
  Youi:    '#F97316',
  Hollard: '#EAB308',
  Allianz: '#22C55E',
  Guild:   '#3B82F6',
  Others:  '#6B7280',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(n: number) { return (n * 100).toFixed(1) + '%'; }
function abs(n: number) { return n > 0 ? `+${(n * 100).toFixed(0)}%` : `${(n * 100).toFixed(0)}%`; }

function ChangeChip({ change }: { change: number }) {
  if (change === 0) return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-400">
      <Minus size={10} /> 0%
    </span>
  );
  if (change > 0) return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-900/40 text-green-400">
      <TrendingUp size={10} /> {abs(change)}
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-900/30 text-red-400">
      <TrendingDown size={10} /> {abs(change)}
    </span>
  );
}

// ─── Custom Recharts tooltips ──────────────────────────────────────────────────

function PieTooltip({ active, payload, total }: { active?: boolean; payload?: { name: string; value: number }[]; total: number }) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm shadow-xl">
      <p className="font-semibold" style={{ color: CLIENT_COLOURS[name] }}>{name}</p>
      <p className="text-gray-300">{value} jobs &mdash; {pct(value / total)}</p>
    </div>
  );
}

function StackTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
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

type Tab = 'summary' | 'region' | 'trend' | 'detail';
const TABS: { id: Tab; label: string }[] = [
  { id: 'summary', label: 'Client Summary' },
  { id: 'region',  label: 'By Region' },
  { id: 'trend',   label: 'Monthly Trend' },
  { id: 'detail',  label: 'Region Detail' },
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
                  {pieData.map(entry => <Cell key={entry.name} fill={CLIENT_COLOURS[entry.name]} />)}
                </Pie>
                <Tooltip content={<PieTooltip total={totalJobs} />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 gap-3 flex-1">
            {clientSummary.map(c => (
              <div key={c.client} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: CLIENT_COLOURS[c.client] }} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{c.client}</p>
                  <p className="text-xs text-gray-500">{c.total.toLocaleString()} &bull; {pct(c.pct)}</p>
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
                <th className="text-right py-2 font-medium">3mo Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/40">
              {clientSummary.map(c => (
                <tr key={c.client} className="hover:bg-gray-800/30 transition-colors">
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: CLIENT_COLOURS[c.client] }} />
                      <span className="font-semibold text-white">{c.client}</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-4 text-right font-mono text-gray-300">{c.total.toLocaleString()}</td>
                  <td className="py-2.5 pr-4 text-right text-gray-400">{pct(c.pct)}</td>
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
  const [selectedClient, setSelectedClient] = useState<ClientName | 'all'>('all');

  const activeClients = selectedClient === 'all' ? KNOWN_CLIENTS : [selectedClient];
  const chartWidth = Math.max(700, regionData.length * 38);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setSelectedClient('all')}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${selectedClient === 'all' ? 'bg-gray-200 text-gray-900' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
          All Clients
        </button>
        {KNOWN_CLIENTS.map(c => (
          <button key={c} onClick={() => setSelectedClient(c === selectedClient ? 'all' : c)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${selectedClient === c ? 'text-white border-transparent' : 'bg-gray-800 text-gray-400 hover:text-white border-gray-700'}`}
            style={selectedClient === c ? { background: CLIENT_COLOURS[c], borderColor: CLIENT_COLOURS[c] } : {}}>
            {c}
          </button>
        ))}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-base font-semibold text-white mb-1">Jobs by Region</h3>
        <p className="text-xs text-gray-500 mb-4">{data.periodLabel} · sorted by volume · scroll →</p>
        <div className="overflow-x-auto scrollbar-hide">
          <div style={{ width: chartWidth, minWidth: '100%' }}>
            <BarChart width={chartWidth} height={340} data={regionData} margin={{ top: 8, right: 8, left: 0, bottom: 90 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-45} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} width={30} />
              <Tooltip content={<StackTooltip />} cursor={{ fill: 'rgba(220,38,38,0.06)' }} />
              <Legend wrapperStyle={{ paddingTop: 8, fontSize: 11 }} formatter={(v) => <span style={{ color: CLIENT_COLOURS[v as ClientName] ?? '#9ca3af' }}>{v}</span>} />
              {activeClients.map((c, i, arr) => (
                <Bar key={c} dataKey={c} stackId="a" fill={CLIENT_COLOURS[c]} radius={i === arr.length - 1 ? [2, 2, 0, 0] : [0, 0, 0, 0]} />
              ))}
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
                  {KNOWN_CLIENTS.map(c => (
                    <td key={c} className="py-2 pr-3 text-right font-mono" style={{ color: r[c] ? CLIENT_COLOURS[c] : '#374151' }}>
                      {r[c] || '—'}
                    </td>
                  ))}
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
  const [selectedClients, setSelectedClients] = useState<Set<ClientName>>(new Set(KNOWN_CLIENTS));

  const toggle = (c: ClientName) => {
    setSelectedClients(prev => {
      const next = new Set(prev);
      if (next.has(c)) { if (next.size > 1) next.delete(c); }
      else next.add(c);
      return next;
    });
  };

  const totals = monthlyTrend.map(m => ({
    ...m,
    total: KNOWN_CLIENTS.reduce((s, c) => s + (m[c] ?? 0), 0),
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg bg-gray-800 border border-gray-700 overflow-hidden">
          <button onClick={() => setChartType('line')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${chartType === 'line' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}>Line</button>
          <button onClick={() => setChartType('bar')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${chartType === 'bar' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}>Bar</button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {KNOWN_CLIENTS.map(c => (
            <button key={c} onClick={() => toggle(c)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all border ${selectedClients.has(c) ? 'text-white border-transparent' : 'bg-gray-800 text-gray-600 border-gray-700 opacity-40 hover:opacity-70'}`}
              style={selectedClients.has(c) ? { background: CLIENT_COLOURS[c], borderColor: CLIENT_COLOURS[c] } : {}}>
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
              <Tooltip content={<StackTooltip />} />
              <Legend formatter={(v) => <span style={{ color: CLIENT_COLOURS[v as ClientName] ?? '#9ca3af' }}>{v}</span>} />
              {KNOWN_CLIENTS.filter(c => selectedClients.has(c)).map(c => (
                <Line key={c} type="monotone" dataKey={c} stroke={CLIENT_COLOURS[c]} strokeWidth={2}
                  dot={{ r: 3, fill: CLIENT_COLOURS[c] }} activeDot={{ r: 5 }} />
              ))}
            </LineChart>
          ) : (
            <BarChart data={monthlyTrend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} width={30} />
              <Tooltip content={<StackTooltip />} />
              <Legend formatter={(v) => <span style={{ color: CLIENT_COLOURS[v as ClientName] ?? '#9ca3af' }}>{v}</span>} />
              {KNOWN_CLIENTS.filter(c => selectedClients.has(c)).map((c, i, arr) => (
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
                  <tr key={c} className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-2 pr-3 font-semibold sticky left-0 bg-gray-900" style={{ color: CLIENT_COLOURS[c] }}>{c}</td>
                    {monthlyTrend.map(m => (
                      <td key={m.month} className={`py-2 pr-2 text-right font-mono ${m[c] > 0 ? 'text-gray-300' : 'text-gray-700'}`}>{m[c] || '—'}</td>
                    ))}
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

  // All unique regions
  const allRegions = Array.from(new Set(regionClientDetail.map(r => r.region))).sort(
    (a, b) => {
      const totalA = regionClientDetail.filter(r => r.region === a).reduce((s, r) => s + r.months.reduce((x, v) => x + v, 0), 0);
      const totalB = regionClientDetail.filter(r => r.region === b).reduce((s, r) => s + r.months.reduce((x, v) => x + v, 0), 0);
      return totalB - totalA;
    }
  );

  const [selectedRegion, setSelectedRegion] = useState<string>(allRegions[0] || '');

  const regionRows = regionClientDetail.filter(r => r.region === selectedRegion);
  const chartData = months.map((month, i) => {
    const entry: Record<string, string | number> = { month };
    regionRows.forEach(r => { entry[r.client] = r.months[i] || 0; });
    return entry;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {allRegions.slice(0, 20).map(r => (
          <button key={r} onClick={() => setSelectedRegion(r)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${selectedRegion === r ? 'bg-red-600 text-white border-transparent' : 'bg-gray-800 text-gray-400 hover:text-white border-gray-700'}`}>
            {r}
          </button>
        ))}
        {allRegions.length > 20 && <span className="self-center text-xs text-gray-600">+{allRegions.length - 20} more</span>}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-base font-semibold text-white mb-1">{selectedRegion} — Monthly by Client</h3>
        <p className="text-xs text-gray-500 mb-4">{data.periodLabel}</p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} width={28} />
            <Tooltip content={<StackTooltip />} />
            <Legend formatter={(v) => <span style={{ color: CLIENT_COLOURS[v as ClientName] ?? '#9ca3af' }}>{v}</span>} />
            {regionRows.map((r, i, arr) => (
              <Bar key={r.client} dataKey={r.client} stackId="a" fill={CLIENT_COLOURS[r.client]}
                radius={i === arr.length - 1 ? [2, 2, 0, 0] : [0, 0, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-base font-semibold text-white mb-4">Monthly Breakdown — {selectedRegion}</h3>
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
              {regionRows.map(r => {
                const total = r.months.reduce((s, v) => s + v, 0);
                return (
                  <tr key={r.client} className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-2 pr-3 font-semibold" style={{ color: CLIENT_COLOURS[r.client] }}>{r.client}</td>
                    {r.months.map((v, i) => (
                      <td key={i} className={`py-2 pr-2 text-right font-mono ${v > 0 ? 'text-gray-300' : 'text-gray-700'}`}>{v || '—'}</td>
                    ))}
                    <td className="py-2 text-right font-mono font-bold text-white">{total}</td>
                  </tr>
                );
              })}
              {regionRows.length === 0 && (
                <tr><td colSpan={months.length + 2} className="py-6 text-center text-gray-500">No data for this region</td></tr>
              )}
            </tbody>
          </table>
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
      const url = `/api/prime/jobs/client-analytics${bust ? '?bust=1' : ''}`;
      const res = await fetch(url);
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

  const generatedAgo = data?.generatedAt
    ? (() => {
        const ms = Date.now() - new Date(data.generatedAt).getTime();
        const h = Math.floor(ms / 3600000);
        const d = Math.floor(h / 24);
        if (d > 0) return `${d}d ago`;
        if (h > 0) return `${h}h ago`;
        return 'just now';
      })()
    : null;

  return (
    <div>
      <PageHeader
        title="Client Analytics"
        subtitle={data
          ? `${data.periodLabel} · ${data.totalJobs.toLocaleString()} jobs · pulled live from Prime`
          : 'Jobs by client and location — last 12 months'}
      />

      {/* Cache age + refresh bar */}
      <div className="flex items-center gap-3 mb-5 text-xs text-gray-500">
        {generatedAgo && (
          <span className="flex items-center gap-1.5">
            <Clock size={12} />
            Data from {generatedAgo} · refreshes automatically every Friday at 6 PM AEST
          </span>
        )}
        <button
          onClick={handleRefresh}
          disabled={loading || refreshing}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors disabled:opacity-40"
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing…' : 'Refresh now'}
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <LoadingSpinner message="Fetching 12 months of Prime data…" />
          <p className="text-xs text-gray-600">First load may take 1–2 minutes while we page through all jobs</p>
        </div>
      ) : error ? (
        <div className="bg-red-900/20 border border-red-800/40 rounded-xl p-5 text-red-400 text-sm">
          {error}
        </div>
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

          {activeTab === 'summary' && <ClientSummaryTab data={data} />}
          {activeTab === 'region'  && <ByRegionTab data={data} />}
          {activeTab === 'trend'   && <MonthlyTrendTab data={data} />}
          {activeTab === 'detail'  && <RegionDetailTab data={data} />}
        </>
      ) : null}
    </div>
  );
}
