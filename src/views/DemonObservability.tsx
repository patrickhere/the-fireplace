// ---------------------------------------------------------------------------
// Agent Observability Dashboard View
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
  useDemonObservabilityStore,
  type DemonObservabilityData,
} from '@/stores/demonObservability';
import { useConnectionStore } from '@/stores/connection';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState, LoadingSpinner } from '@/components/StateIndicators';

// ---- Constants ------------------------------------------------------------

const DEMON_COLORS = [
  '#f59e0b', // amber-500
  '#10b981', // emerald-500
  '#3b82f6', // blue-500
  '#a855f7', // purple-500
  '#f43f5e', // rose-500
  '#06b6d4', // cyan-500
  '#84cc16', // lime-500
  '#fb923c', // orange-400
];

const REFRESH_INTERVAL_MS = 10_000;

// ---- Helpers --------------------------------------------------------------

function formatTokenCount(n: number): string {
  if (n === 0) return '0';
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

function formatLatency(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function avgLatency(samples: DemonObservabilityData['latencySamples']): number | null {
  if (samples.length === 0) return null;
  return samples.reduce((sum, s) => sum + s.latencyMs, 0) / samples.length;
}

function errorRatePct(demon: DemonObservabilityData): number | null {
  if (demon.totalRequests === 0) return null;
  return (demon.totalErrors / demon.totalRequests) * 100;
}

function tokenEfficiency(demon: DemonObservabilityData): string {
  if (demon.totalSuccesses === 0) return '—';
  return formatTokenCount(Math.round(demon.totalTokens / demon.totalSuccesses));
}

function errorRateBadgeClass(pct: number | null): string {
  if (pct === null) return 'bg-zinc-700 text-zinc-400';
  if (pct > 10) return 'bg-red-500/20 text-red-400';
  if (pct > 5) return 'bg-amber-500/20 text-amber-400';
  return 'bg-emerald-500/20 text-emerald-400';
}

function formatBucketTime(startMs: number): string {
  const d = new Date(startMs);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

// ---- Latency Sparkline ----------------------------------------------------

function LatencySparkline({ samples }: { samples: DemonObservabilityData['latencySamples'] }) {
  if (samples.length < 2) {
    return (
      <div className="flex h-[100px] items-center justify-center text-xs text-zinc-600">
        No data yet
      </div>
    );
  }

  const data = samples.map((s) => ({ ts: s.timestamp, latencyMs: s.latencyMs }));

  return (
    <ResponsiveContainer width="100%" height={100}>
      <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="ts" hide />
        <YAxis hide />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const val = payload[0]?.value as number;
            return (
              <div className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200">
                {formatLatency(val)}
              </div>
            );
          }}
        />
        <Area
          type="monotone"
          dataKey="latencyMs"
          stroke="#f59e0b"
          strokeWidth={1.5}
          fill="url(#latencyGradient)"
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ---- Demon Card -----------------------------------------------------------

function DemonCard({ demon }: { demon: DemonObservabilityData }) {
  const errRate = errorRatePct(demon);
  const avg = avgLatency(demon.latencySamples);

  return (
    <Card className="bg-zinc-800">
      <CardContent className="p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {demon.demonEmoji && <span className="text-base">{demon.demonEmoji}</span>}
            <span className="text-sm font-medium text-zinc-100">{demon.demonName}</span>
          </div>
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${errorRateBadgeClass(errRate)}`}
          >
            {errRate === null ? 'No data' : `${Math.round(errRate)}% err`}
          </span>
        </div>

        <LatencySparkline samples={demon.latencySamples} />

        <div className="mt-2 grid grid-cols-3 gap-2 border-t border-zinc-700 pt-2">
          <div>
            <p className="text-[10px] text-zinc-500">Avg latency</p>
            <p className="text-xs font-medium text-zinc-200">
              {avg !== null ? formatLatency(avg) : '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-500">Tok / req</p>
            <p className="text-xs font-medium text-zinc-200">{tokenEfficiency(demon)}</p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-500">Requests</p>
            <p className="text-xs font-medium text-zinc-200">{demon.totalRequests}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---- Hourly Activity Chart ------------------------------------------------

function buildChartData(demons: DemonObservabilityData[]): Record<string, unknown>[] {
  // Collect all unique bucket start times
  const bucketSet = new Set<number>();
  for (const d of demons) {
    for (const b of d.activityBuckets) {
      bucketSet.add(b.startMs);
    }
  }

  const sortedBuckets = Array.from(bucketSet).sort((a, b) => a - b);

  // Only show last 12h worth (144 buckets of 5 min) — down-sample by hour for chart readability
  const hourBuckets = new Map<number, Record<string, number>>();

  for (const startMs of sortedBuckets) {
    const hourStart = Math.floor(startMs / (60 * 60 * 1000)) * (60 * 60 * 1000);
    if (!hourBuckets.has(hourStart)) {
      hourBuckets.set(hourStart, {});
    }
    const bucket = hourBuckets.get(hourStart)!;

    for (const demon of demons) {
      const match = demon.activityBuckets.find((b) => b.startMs === startMs);
      if (match) {
        bucket[demon.demonId] = (bucket[demon.demonId] ?? 0) + match.requests;
      }
    }
  }

  const now = Date.now();
  const cutoff = now - 12 * 60 * 60 * 1000;

  return Array.from(hourBuckets.entries())
    .filter(([ms]) => ms >= cutoff)
    .sort(([a], [b]) => a - b)
    .map(([ms, counts]) => ({
      time: formatBucketTime(ms),
      ...counts,
    }));
}

function ActivityChart({ demons }: { demons: DemonObservabilityData[] }) {
  const data = buildChartData(demons);
  const hasData =
    data.length > 0 && data.some((row) => demons.some((d) => (row[d.demonId] as number) > 0));

  if (!hasData) {
    return (
      <div className="flex h-[160px] items-center justify-center text-xs text-zinc-600">
        No activity recorded yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <defs>
          {demons.map((d, i) => (
            <linearGradient key={d.demonId} id={`grad-${d.demonId}`} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor={DEMON_COLORS[i % DEMON_COLORS.length]}
                stopOpacity={0.4}
              />
              <stop
                offset="95%"
                stopColor={DEMON_COLORS[i % DEMON_COLORS.length]}
                stopOpacity={0}
              />
            </linearGradient>
          ))}
        </defs>
        <XAxis
          dataKey="time"
          tick={{ fill: '#71717a', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fill: '#71717a', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={28}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#18181b',
            border: '1px solid #3f3f46',
            borderRadius: '6px',
            fontSize: '11px',
          }}
          labelStyle={{ color: '#a1a1aa' }}
          itemStyle={{ color: '#e4e4e7' }}
        />
        {demons.map((d, i) => (
          <Area
            key={d.demonId}
            type="monotone"
            dataKey={d.demonId}
            name={d.demonName}
            stroke={DEMON_COLORS[i % DEMON_COLORS.length]}
            strokeWidth={1.5}
            fill={`url(#grad-${d.demonId})`}
            dot={false}
            isAnimationActive={false}
            stackId="1"
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ---- Activity Legend ------------------------------------------------------

function ActivityLegend({ demons }: { demons: DemonObservabilityData[] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {demons.map((d, i) => (
        <div key={d.demonId} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: DEMON_COLORS[i % DEMON_COLORS.length] }}
          />
          <span className="text-[10px] text-zinc-400">{d.demonName}</span>
        </div>
      ))}
    </div>
  );
}

// ---- Summary Bar ----------------------------------------------------------

function SummaryBar({ demons }: { demons: DemonObservabilityData[] }) {
  const totalRequests = demons.reduce((s, d) => s + d.totalRequests, 0);
  const totalErrors = demons.reduce((s, d) => s + d.totalErrors, 0);
  const totalTokens = demons.reduce((s, d) => s + d.totalTokens, 0);
  const overallErrRate = totalRequests > 0 ? Math.round((totalErrors / totalRequests) * 100) : null;

  return (
    <div className="flex items-center gap-4 text-xs text-zinc-400">
      <span>
        <span className="font-medium text-zinc-200">{totalRequests}</span> total requests
      </span>
      <span>
        <span
          className={`font-medium ${overallErrRate !== null && overallErrRate > 5 ? 'text-red-400' : 'text-zinc-200'}`}
        >
          {overallErrRate !== null ? `${overallErrRate}%` : '—'}
        </span>{' '}
        error rate
      </span>
      <span>
        <span className="font-medium text-zinc-200">{formatTokenCount(totalTokens)}</span> tokens
      </span>
    </div>
  );
}

// ---- Main View ------------------------------------------------------------

export function DemonObservability() {
  const { demons, isTracking, startTracking, stopTracking } = useDemonObservabilityStore();
  const { status } = useConnectionStore();
  const [, forceRefresh] = useState(0);

  useEffect(() => {
    if (status === 'connected') {
      startTracking();
    }
    return () => {
      stopTracking();
    };
  }, [status, startTracking, stopTracking]);

  // Refresh display every 10 seconds
  useEffect(() => {
    if (!isTracking) return;
    const interval = setInterval(() => {
      forceRefresh((n) => n + 1);
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isTracking]);

  const isConnected = status === 'connected';

  return (
    <div className="flex h-full flex-col bg-zinc-950">
      {/* Header */}
      <div className="border-b border-zinc-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-zinc-100">Agent Observability</h1>
            {isConnected ? (
              <div className="mt-0.5 flex items-center gap-2">
                <div
                  className={`h-1.5 w-1.5 rounded-full ${isTracking ? 'bg-emerald-500' : 'bg-zinc-600'}`}
                />
                <p className="text-sm text-zinc-400">
                  {isTracking ? 'Tracking live' : 'Waiting for connection...'}
                </p>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">Not connected</p>
            )}
          </div>
          {demons.length > 0 && <SummaryBar demons={demons} />}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {!isTracking && demons.length === 0 ? (
          <LoadingSpinner message="Initializing observability..." />
        ) : demons.length === 0 ? (
          <EmptyState
            message="No agents configured"
            detail="Add agents in the Agents view to monitor them here."
          />
        ) : (
          <>
            {/* Per-demon cards */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {demons.map((demon) => (
                <DemonCard key={demon.demonId} demon={demon} />
              ))}
            </div>

            {/* Hourly Activity */}
            <Card className="bg-zinc-800">
              <CardContent className="p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-200">Activity (last 12h)</span>
                  <ActivityLegend demons={demons} />
                </div>
                <ActivityChart demons={demons} />
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
