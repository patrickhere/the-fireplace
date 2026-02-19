import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface ModelDistributionPoint {
  tier: string;
  tokenCount: number;
  percentage: number;
}

interface DemonUsagePoint {
  demonId: string;
  demonName: string;
  totalTokens: number;
  model: string;
}

interface SessionActivityPoint {
  name: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
}

const TIER_COLORS: Record<string, string> = {
  Free: '#10b981',
  'Low Cost': '#d97706',
  Premium: '#f59e0b',
  'MAX Sub': '#a1a1aa',
  Unknown: '#71717a',
};

function formatTokens(value: number): string {
  return value.toLocaleString();
}

function truncateLabel(label: string, max = 20): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; payload?: Record<string, unknown> }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-2 text-sm text-zinc-200">
      {label && <div className="mb-1 text-xs text-zinc-400">{label}</div>}
      {payload.map((entry, idx) => {
        const name = entry.name ?? `Series ${idx + 1}`;
        const value = typeof entry.value === 'number' ? formatTokens(entry.value) : '0';
        return (
          <div key={`${name}-${idx}`} className="flex items-center justify-between gap-3">
            <span className="text-zinc-400">{name}</span>
            <span className="font-medium text-zinc-100">{value}</span>
          </div>
        );
      })}
    </div>
  );
}

export function ModelDistributionChart({
  distribution,
}: {
  distribution: ModelDistributionPoint[];
}) {
  if (distribution.length === 0) return null;

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-3">
      <h3 className="mb-2 text-sm font-medium text-zinc-100">Model Distribution</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart
          data={distribution}
          layout="vertical"
          margin={{ top: 4, right: 12, left: 12, bottom: 4 }}
        >
          <CartesianGrid vertical={false} stroke="#3f3f46" />
          <XAxis type="number" tick={{ fill: '#a1a1aa', fontSize: 12 }} />
          <YAxis
            dataKey="tier"
            type="category"
            tick={{ fill: '#a1a1aa', fontSize: 12 }}
            width={90}
          />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="tokenCount" name="Tokens">
            {distribution.map((entry) => (
              <Cell key={entry.tier} fill={TIER_COLORS[entry.tier] ?? '#71717a'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DemonUsageChart({ demons }: { demons: DemonUsagePoint[] }) {
  if (demons.length === 0) return null;

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-3">
      <h3 className="mb-2 text-sm font-medium text-zinc-100">Per-Demon Usage</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={demons} margin={{ top: 4, right: 12, left: 12, bottom: 24 }}>
          <CartesianGrid vertical={false} stroke="#3f3f46" />
          <XAxis
            dataKey="demonName"
            tick={{ fill: '#a1a1aa', fontSize: 12 }}
            tickFormatter={(label: string) => truncateLabel(label, 16)}
            interval={0}
            angle={-20}
            textAnchor="end"
            height={50}
          />
          <YAxis tick={{ fill: '#a1a1aa', fontSize: 12 }} />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="totalTokens" name="Tokens" fill="#f59e0b" activeBar={{ fill: '#fbbf24' }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SessionActivityChart({ sessions }: { sessions: SessionActivityPoint[] }) {
  if (sessions.length === 0) return null;

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-3">
      <h3 className="mb-2 text-sm font-medium text-zinc-100">Top Session Activity</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={sessions} margin={{ top: 4, right: 12, left: 12, bottom: 24 }}>
          <CartesianGrid vertical={false} stroke="#3f3f46" />
          <XAxis
            dataKey="name"
            tick={{ fill: '#a1a1aa', fontSize: 12 }}
            tickFormatter={(label: string) => truncateLabel(label, 20)}
            interval={0}
            angle={-20}
            textAnchor="end"
            height={50}
          />
          <YAxis tick={{ fill: '#a1a1aa', fontSize: 12 }} />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="inputTokens" name="Input" stackId="tokens" fill="#a1a1aa" />
          <Bar dataKey="outputTokens" name="Output" stackId="tokens" fill="#f59e0b" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
