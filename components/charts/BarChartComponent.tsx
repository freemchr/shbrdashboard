'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface BarChartProps {
  data: { name: string; value: number }[];
  xKey?: string;
  yKey?: string;
  color?: string;
  height?: number;
  onBarClick?: (name: string) => void;
  activeBar?: string;
}

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm shadow-xl">
        <p className="text-gray-300 font-medium">{label}</p>
        <p className="text-red-400 font-bold">{payload[0].value} jobs</p>
      </div>
    );
  }
  return null;
};

export function BarChartComponent({
  data,
  xKey = 'name',
  yKey = 'value',
  color = '#DC2626',
  height = 300,
  onBarClick,
  activeBar,
}: BarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        margin={{ top: 5, right: 10, left: 0, bottom: 60 }}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onClick={onBarClick ? (e: any) => {
          if (e?.activePayload?.[0]) {
            onBarClick(e.activePayload[0].payload.name);
          }
        } : undefined}
        style={onBarClick ? { cursor: 'pointer' } : undefined}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
        <XAxis
          dataKey={xKey}
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          angle={-35}
          textAnchor="end"
          interval={0}
        />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(220,38,38,0.08)' }} />
        <Bar dataKey={yKey} radius={[3, 3, 0, 0]}>
          {data.map((entry) => (
            <Cell
              key={entry.name}
              fill={activeBar && activeBar === entry.name ? '#f87171' : color}
              opacity={activeBar && activeBar !== entry.name ? 0.5 : 1}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
