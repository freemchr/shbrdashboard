'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  LineChart, Line,
} from 'recharts';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';

// ─── Static data from Prime export ────────────────────────────────────────────
// Source: Jobs_by_Client_Location_Apr2025_Apr2026_v3.xlsx

const CLIENT_COLOURS: Record<string, string> = {
  Suncorp: '#DC2626',
  Youi:    '#F97316',
  Hollard: '#EAB308',
  Allianz: '#22C55E',
  Guild:   '#3B82F6',
  Others:  '#6B7280',
};

const clientSummary = [
  { client: 'Suncorp', total: 950,  pct: 0.4237, last3: 197, prior3: 289, change: -0.3183 },
  { client: 'Youi',    total: 583,  pct: 0.2600, last3: 240, prior3: 240, change: 0       },
  { client: 'Hollard', total: 456,  pct: 0.2034, last3: 69,  prior3: 89,  change: -0.2247 },
  { client: 'Allianz', total: 149,  pct: 0.0665, last3: 25,  prior3: 33,  change: -0.2424 },
  { client: 'Guild',   total: 79,   pct: 0.0352, last3: 16,  prior3: 25,  change: -0.36   },
  { client: 'Others',  total: 25,   pct: 0.0112, last3: 9,   prior3: 8,   change: 0.125   },
];
const TOTAL_JOBS = 2242;

const regionData = [
  { region: 'Sydney Metro West',      Suncorp: 51,  Youi: 67,  Hollard: 80,  Allianz: 41, Guild: 14, Others: 1  },
  { region: 'Sydney Metro South',     Suncorp: 95,  Youi: 41,  Hollard: 50,  Allianz: 21, Guild: 11, Others: 2  },
  { region: 'Sydney Metro North',     Suncorp: 80,  Youi: 44,  Hollard: 42,  Allianz: 29, Guild: 10, Others: 4  },
  { region: 'NSW North Coast',        Suncorp: 111, Youi: 41,  Hollard: 21,  Allianz: 0,  Guild: 6,  Others: 0  },
  { region: 'Newcastle Hunter Valley',Suncorp: 59,  Youi: 58,  Hollard: 34,  Allianz: 0,  Guild: 3,  Others: 4  },
  { region: 'Sydney Metro East',      Suncorp: 54,  Youi: 26,  Hollard: 41,  Allianz: 13, Guild: 14, Others: 8  },
  { region: 'Illawarra Wollongong',   Suncorp: 102, Youi: 24,  Hollard: 17,  Allianz: 0,  Guild: 3,  Others: 1  },
  { region: 'Brisbane',               Suncorp: 141, Youi: 0,   Hollard: 0,   Allianz: 3,  Guild: 0,  Others: 0  },
  { region: 'Central Coast',          Suncorp: 36,  Youi: 39,  Hollard: 49,  Allianz: 16, Guild: 2,  Others: 1  },
  { region: 'NSW Mid North Coast',    Suncorp: 91,  Youi: 11,  Hollard: 15,  Allianz: 0,  Guild: 2,  Others: 1  },
  { region: 'ACT',                    Suncorp: 4,   Youi: 53,  Hollard: 48,  Allianz: 1,  Guild: 0,  Others: 1  },
  { region: 'Tamworth Armidale',      Suncorp: 26,  Youi: 24,  Hollard: 6,   Allianz: 0,  Guild: 0,  Others: 0  },
  { region: 'NSW Rural South West',   Suncorp: 4,   Youi: 23,  Hollard: 11,  Allianz: 0,  Guild: 7,  Others: 0  },
  { region: 'NSW North West',         Suncorp: 21,  Youi: 17,  Hollard: 3,   Allianz: 0,  Guild: 0,  Others: 0  },
  { region: 'NSW South Coast',        Suncorp: 7,   Youi: 30,  Hollard: 2,   Allianz: 0,  Guild: 0,  Others: 1  },
  { region: 'Bathurst Dubbo',         Suncorp: 1,   Youi: 22,  Hollard: 9,   Allianz: 0,  Guild: 1,  Others: 0  },
  { region: 'NSW Southern Highlands', Suncorp: 9,   Youi: 17,  Hollard: 6,   Allianz: 0,  Guild: 0,  Others: 0  },
  { region: 'Blue Mountains',         Suncorp: 9,   Youi: 8,   Hollard: 3,   Allianz: 2,  Guild: 1,  Others: 0  },
  { region: 'NSW Rural West',         Suncorp: 2,   Youi: 3,   Hollard: 6,   Allianz: 0,  Guild: 1,  Others: 0  },
  { region: 'Sunshine Coast',         Suncorp: 9,   Youi: 0,   Hollard: 0,   Allianz: 1,  Guild: 0,  Others: 0  },
  { region: 'Gold Coast',             Suncorp: 2,   Youi: 0,   Hollard: 0,   Allianz: 2,  Guild: 0,  Others: 0  },
  { region: 'Far North Queensland',   Suncorp: 0,   Youi: 0,   Hollard: 0,   Allianz: 0,  Guild: 0,  Others: 1  },
];

const MONTHS = ['Apr 25','May 25','Jun 25','Jul 25','Aug 25','Sep 25','Oct 25','Nov 25','Dec 25','Jan 26','Feb 26','Mar 26','Apr 26'];

const monthlyTrend = [
  { month: 'Apr 25', Suncorp: 32,  Youi: 0,   Hollard: 17, Allianz: 0,  Guild: 1,  Others: 1  },
  { month: 'May 25', Suncorp: 108, Youi: 0,   Hollard: 51, Allianz: 0,  Guild: 9,  Others: 1  },
  { month: 'Jun 25', Suncorp: 100, Youi: 0,   Hollard: 33, Allianz: 0,  Guild: 6,  Others: 3  },
  { month: 'Jul 25', Suncorp: 65,  Youi: 0,   Hollard: 56, Allianz: 1,  Guild: 5,  Others: 0  },
  { month: 'Aug 25', Suncorp: 46,  Youi: 1,   Hollard: 51, Allianz: 26, Guild: 8,  Others: 2  },
  { month: 'Sep 25', Suncorp: 34,  Youi: 33,  Hollard: 39, Allianz: 37, Guild: 5,  Others: 0  },
  { month: 'Oct 25', Suncorp: 79,  Youi: 69,  Hollard: 51, Allianz: 27, Guild: 4,  Others: 1  },
  { month: 'Nov 25', Suncorp: 131, Youi: 88,  Hollard: 30, Allianz: 22, Guild: 6,  Others: 3  },
  { month: 'Dec 25', Suncorp: 99,  Youi: 69,  Hollard: 29, Allianz: 3,  Guild: 11, Others: 3  },
  { month: 'Jan 26', Suncorp: 59,  Youi: 83,  Hollard: 30, Allianz: 8,  Guild: 8,  Others: 2  },
  { month: 'Feb 26', Suncorp: 57,  Youi: 69,  Hollard: 21, Allianz: 9,  Guild: 6,  Others: 3  },
  { month: 'Mar 26', Suncorp: 44,  Youi: 113, Hollard: 35, Allianz: 10, Guild: 6,  Others: 2  },
  { month: 'Apr 26', Suncorp: 96,  Youi: 58,  Hollard: 13, Allianz: 6,  Guild: 4,  Others: 4  },
];

// Enrich region data with totals, sorted by total desc
const enrichedRegions = regionData.map(r => ({
  ...r,
  total: r.Suncorp + r.Youi + r.Hollard + r.Allianz + r.Guild + r.Others,
  dominant: (['Suncorp','Youi','Hollard','Allianz','Guild','Others'] as const).reduce((a, b) =>
    (r[a] ?? 0) >= (r[b] ?? 0) ? a : b
  ),
})).sort((a, b) => b.total - a.total);

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

function PieTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm shadow-xl">
      <p className="font-semibold" style={{ color: CLIENT_COLOURS[name] }}>{name}</p>
      <p className="text-gray-300">{value} jobs &mdash; {pct(value / TOTAL_JOBS)}</p>
    </div>
  );
}

function TrendTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (p.value ?? 0), 0);
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-xs shadow-xl min-w-[140px]">
      <p className="text-gray-400 font-semibold mb-1.5">{label} — {total} jobs</p>
      {[...payload].sort((a, b) => b.value - a.value).map(p => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="text-white font-mono">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

function RegionTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (p.value ?? 0), 0);
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-xs shadow-xl min-w-[160px]">
      <p className="text-gray-300 font-semibold mb-1.5">{label} — {total} jobs</p>
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

function ClientSummaryTab() {
  const pieData = clientSummary.map(c => ({ name: c.client, value: c.total }));

  return (
    <div className="space-y-6">
      {/* Pie + legend */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-base font-semibold text-white mb-1">Jobs by Client — Last 12 Months</h3>
        <p className="text-xs text-gray-500 mb-4">Apr 2025 – Apr 2026 · {TOTAL_JOBS.toLocaleString()} total jobs</p>
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="w-full md:w-64 h-64 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={110}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieData.map(entry => (
                    <Cell key={entry.name} fill={CLIENT_COLOURS[entry.name]} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Legend chips */}
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

      {/* Summary table */}
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
                  <td className="py-2.5 pr-4 text-right font-mono text-gray-300">{c.last3 ?? '—'}</td>
                  <td className="py-2.5 pr-4 text-right font-mono text-gray-400">{c.prior3 ?? '—'}</td>
                  <td className="py-2.5 text-right">
                    {c.last3 !== null ? <ChangeChip change={c.change} /> : <span className="text-gray-700">—</span>}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-gray-700">
                <td className="py-2.5 pr-4 font-bold text-white">TOTAL</td>
                <td className="py-2.5 pr-4 text-right font-bold font-mono text-white">{TOTAL_JOBS.toLocaleString()}</td>
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

const CLIENTS = ['Suncorp', 'Youi', 'Hollard', 'Allianz', 'Guild', 'Others'] as const;
type ClientName = typeof CLIENTS[number];

function ByRegionTab() {
  const [selectedClient, setSelectedClient] = useState<ClientName | 'all'>('all');

  const chartData = enrichedRegions.map(r => {
    if (selectedClient === 'all') return r;
    return { ...r, [selectedClient]: r[selectedClient] };
  });

  const activeClients = selectedClient === 'all' ? CLIENTS : [selectedClient];
  const chartWidth = Math.max(700, enrichedRegions.length * 38);

  return (
    <div className="space-y-5">
      {/* Client filter pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedClient('all')}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${selectedClient === 'all' ? 'bg-gray-200 text-gray-900' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
        >
          All Clients
        </button>
        {CLIENTS.map(c => (
          <button
            key={c}
            onClick={() => setSelectedClient(c === selectedClient ? 'all' : c)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors border ${
              selectedClient === c
                ? 'text-white border-transparent'
                : 'bg-gray-800 text-gray-400 hover:text-white border-gray-700'
            }`}
            style={selectedClient === c ? { background: CLIENT_COLOURS[c], borderColor: CLIENT_COLOURS[c] } : {}}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Stacked bar chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-base font-semibold text-white mb-1">Jobs by Region</h3>
        <p className="text-xs text-gray-500 mb-4">Last 12 months · sorted by total volume · scroll →</p>
        <div className="overflow-x-auto scrollbar-hide">
          <div style={{ width: chartWidth, minWidth: '100%' }}>
            <BarChart
              width={chartWidth}
              height={340}
              data={chartData}
              margin={{ top: 8, right: 8, left: 0, bottom: 90 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis
                dataKey="region"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                angle={-45}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} width={30} />
              <Tooltip content={<RegionTooltip />} cursor={{ fill: 'rgba(220,38,38,0.06)' }} />
              <Legend
                wrapperStyle={{ paddingTop: 8, fontSize: 11, color: '#9ca3af' }}
                formatter={(value) => <span style={{ color: CLIENT_COLOURS[value as ClientName] ?? '#9ca3af' }}>{value}</span>}
              />
              {activeClients.map(c => (
                <Bar key={c} dataKey={c} stackId="a" fill={CLIENT_COLOURS[c]} radius={c === activeClients[activeClients.length - 1] ? [2, 2, 0, 0] : [0, 0, 0, 0]} />
              ))}
            </BarChart>
          </div>
        </div>
      </div>

      {/* Region table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-base font-semibold text-white mb-4">Region × Client Table</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left py-2 pr-3 font-medium min-w-[160px]">Region</th>
                {CLIENTS.map(c => (
                  <th key={c} className="text-right py-2 pr-3 font-medium" style={{ color: CLIENT_COLOURS[c] }}>{c}</th>
                ))}
                <th className="text-right py-2 font-medium text-gray-400">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/30">
              {enrichedRegions.map(r => (
                <tr key={r.region} className="hover:bg-gray-800/30 transition-colors">
                  <td className="py-2 pr-3 text-gray-300 font-medium">{r.region}</td>
                  {CLIENTS.map(c => (
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

function MonthlyTrendTab() {
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  const [selectedClients, setSelectedClients] = useState<Set<ClientName>>(new Set(CLIENTS));

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
    total: CLIENTS.reduce((s, c) => s + (m[c] ?? 0), 0),
  }));

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg bg-gray-800 border border-gray-700 overflow-hidden">
          <button onClick={() => setChartType('line')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${chartType === 'line' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            Line
          </button>
          <button onClick={() => setChartType('bar')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${chartType === 'bar' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            Bar
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CLIENTS.map(c => (
            <button
              key={c}
              onClick={() => toggle(c)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all border ${
                selectedClients.has(c)
                  ? 'text-white border-transparent'
                  : 'bg-gray-800 text-gray-600 border-gray-700 opacity-40 hover:opacity-70'
              }`}
              style={selectedClients.has(c) ? { background: CLIENT_COLOURS[c], borderColor: CLIENT_COLOURS[c] } : {}}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-base font-semibold text-white mb-1">Monthly Job Volumes — Last 13 Months</h3>
        <p className="text-xs text-gray-500 mb-4">Apr 2025 – Apr 2026 · click legend to toggle</p>
        <ResponsiveContainer width="100%" height={340}>
          {chartType === 'line' ? (
            <LineChart data={monthlyTrend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} width={30} />
              <Tooltip content={<TrendTooltip />} />
              <Legend
                formatter={(value) => <span style={{ color: CLIENT_COLOURS[value as ClientName] ?? '#9ca3af' }}>{value}</span>}
              />
              {CLIENTS.filter(c => selectedClients.has(c)).map(c => (
                <Line
                  key={c}
                  type="monotone"
                  dataKey={c}
                  stroke={CLIENT_COLOURS[c]}
                  strokeWidth={2}
                  dot={{ r: 3, fill: CLIENT_COLOURS[c] }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          ) : (
            <BarChart data={monthlyTrend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} width={30} />
              <Tooltip content={<TrendTooltip />} />
              <Legend
                formatter={(value) => <span style={{ color: CLIENT_COLOURS[value as ClientName] ?? '#9ca3af' }}>{value}</span>}
              />
              {CLIENTS.filter(c => selectedClients.has(c)).map((c, i, arr) => (
                <Bar
                  key={c}
                  dataKey={c}
                  stackId="a"
                  fill={CLIENT_COLOURS[c]}
                  radius={i === arr.length - 1 ? [2, 2, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Summary totals table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-base font-semibold text-white mb-4">Monthly Totals by Client</h3>
        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left py-2 pr-3 font-medium sticky left-0 bg-gray-900">Client</th>
                {MONTHS.map(m => <th key={m} className="text-right py-2 pr-2 font-medium whitespace-nowrap">{m}</th>)}
                <th className="text-right py-2 font-medium text-gray-400">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/30">
              {CLIENTS.map(c => {
                const rowTotal = monthlyTrend.reduce((s, m) => s + (m[c] ?? 0), 0);
                return (
                  <tr key={c} className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-2 pr-3 font-semibold sticky left-0 bg-gray-900" style={{ color: CLIENT_COLOURS[c] }}>{c}</td>
                    {monthlyTrend.map(m => (
                      <td key={m.month} className="py-2 pr-2 text-right font-mono text-gray-300">{m[c] || '—'}</td>
                    ))}
                    <td className="py-2 text-right font-mono font-bold text-white">{rowTotal}</td>
                  </tr>
                );
              })}
              <tr className="border-t border-gray-700">
                <td className="py-2 pr-3 font-bold text-white sticky left-0 bg-gray-900">TOTAL</td>
                {totals.map(m => (
                  <td key={m.month} className="py-2 pr-2 text-right font-mono font-bold text-gray-200">{m.total}</td>
                ))}
                <td className="py-2 text-right font-mono font-bold text-white">{TOTAL_JOBS}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Region Detail ───────────────────────────────────────────────────────

// Region × Client monthly detail data (from sheet 4)
const regionClientDetail: Record<string, Partial<Record<ClientName, number[]>>> = {
  'Sydney Metro West': {
    Suncorp: [10,6,2,6,1,1,4,9,3,2,1,3,3],
    Youi:    [0,0,0,0,0,5,8,8,13,6,6,16,5],
    Hollard: [3,12,4,9,9,4,7,8,6,5,4,5,4],
    Allianz: [0,0,0,0,4,12,8,5,2,3,4,1,2],
    Guild:   [0,0,1,2,3,1,1,2,2,2,0,0,0],
    Others:  [0,0,0,0,0,0,0,0,0,0,1,0,0],
  },
  'Sydney Metro South': {
    Suncorp: [2,17,6,11,7,8,7,18,2,3,4,6,4],
    Youi:    [0,0,0,0,0,2,3,7,4,5,9,6,5],
    Hollard: [2,4,5,5,8,6,9,3,3,1,1,2,1],
    Allianz: [0,0,0,0,5,6,3,6,0,1,0,0,0],
    Guild:   [0,1,1,0,0,0,2,1,0,4,2,0,0],
    Others:  [0,0,0,0,0,0,1,0,0,0,0,0,1],
  },
  'Sydney Metro North': {
    Suncorp: [6,7,6,4,6,10,3,7,6,9,5,10,1],
    Youi:    [0,0,0,0,0,1,3,7,0,11,5,14,3],
    Hollard: [0,1,4,2,4,2,3,3,8,4,4,5,2],
    Allianz: [0,0,0,0,6,7,4,3,0,1,1,6,1],
    Guild:   [0,1,0,1,1,1,1,1,1,1,2,0,0],
    Others:  [0,0,1,0,0,0,0,1,0,0,0,2,0],
  },
};

function RegionDetailTab() {
  const [selectedRegion, setSelectedRegion] = useState<string>('Sydney Metro West');
  const regions = Object.keys(regionClientDetail);
  const detail = regionClientDetail[selectedRegion] ?? {};

  const chartData = MONTHS.map((month, i) => {
    const entry: Record<string, string | number> = { month };
    CLIENTS.forEach(c => { entry[c] = detail[c]?.[i] ?? 0; });
    return entry;
  });

  return (
    <div className="space-y-5">
      {/* Region picker */}
      <div className="flex flex-wrap gap-2">
        {regions.map(r => (
          <button
            key={r}
            onClick={() => setSelectedRegion(r)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              selectedRegion === r
                ? 'bg-red-600 text-white border-transparent'
                : 'bg-gray-800 text-gray-400 hover:text-white border-gray-700'
            }`}
          >
            {r}
          </button>
        ))}
        <span className="self-center text-xs text-gray-600 pl-1">
          More regions coming — data from Prime export
        </span>
      </div>

      {/* Stacked area / bar */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-base font-semibold text-white mb-1">{selectedRegion} — Monthly by Client</h3>
        <p className="text-xs text-gray-500 mb-4">Apr 2025 – Apr 2026</p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} width={28} />
            <Tooltip content={<TrendTooltip />} />
            <Legend formatter={(value) => <span style={{ color: CLIENT_COLOURS[value as ClientName] ?? '#9ca3af' }}>{value}</span>} />
            {CLIENTS.map((c, i, arr) => (
              <Bar
                key={c}
                dataKey={c}
                stackId="a"
                fill={CLIENT_COLOURS[c]}
                radius={i === arr.length - 1 ? [2, 2, 0, 0] : [0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detail table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-base font-semibold text-white mb-4">Monthly Breakdown — {selectedRegion}</h3>
        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left py-2 pr-3 font-medium">Client</th>
                {MONTHS.map(m => <th key={m} className="text-right py-2 pr-2 font-medium whitespace-nowrap">{m}</th>)}
                <th className="text-right py-2 font-medium text-gray-400">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/30">
              {CLIENTS.map(c => {
                const months = detail[c] ?? Array(13).fill(0);
                const total = months.reduce((s, v) => s + v, 0);
                if (total === 0) return null;
                return (
                  <tr key={c} className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-2 pr-3 font-semibold" style={{ color: CLIENT_COLOURS[c] }}>{c}</td>
                    {months.map((v, i) => (
                      <td key={i} className={`py-2 pr-2 text-right font-mono ${v > 0 ? 'text-gray-300' : 'text-gray-700'}`}>{v || '—'}</td>
                    ))}
                    <td className="py-2 text-right font-mono font-bold text-white">{total}</td>
                  </tr>
                );
              })}
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

  return (
    <div>
      <PageHeader
        title="Client Analytics"
        subtitle="Jobs by client and location — last 12 months (Apr 2025 – Apr 2026)"
      />

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit flex-wrap">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === t.id
                ? 'bg-red-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'summary' && <ClientSummaryTab />}
      {activeTab === 'region'  && <ByRegionTab />}
      {activeTab === 'trend'   && <MonthlyTrendTab />}
      {activeTab === 'detail'  && <RegionDetailTab />}
    </div>
  );
}
