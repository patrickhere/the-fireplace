// ---------------------------------------------------------------------------
// Usage View
// ---------------------------------------------------------------------------

import { useEffect, useCallback, useMemo } from 'react';
import { useUsageStore, type SessionUsageEntry } from '@/stores/usage';
import { useConnectionStore } from '@/stores/connection';
import { LoadingSpinner, EmptyState, ErrorState } from '@/components/StateIndicators';
import {
  DemonUsageChart,
  ModelDistributionChart,
  SessionActivityChart,
} from '@/components/organisms/UsageCharts';
import { StatusDot } from '@/components/atoms/StatusDot';
import { DataTable } from '@/components/organisms/DataTable';
import type { ColumnDef } from '@tanstack/react-table';

// ---- Token Formatter ------------------------------------------------------

function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(2)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return String(count);
}

function formatCost(usd: number): string {
  if (usd < 0.01) return `<$0.01`;
  return `$${usd.toFixed(2)}`;
}

function formatTimestamp(ts: number): string {
  if (!ts) return '-';
  return new Date(ts).toLocaleString();
}

// ---- Summary Card Component -----------------------------------------------

function SummaryCard({
  label,
  value,
  detail,
  color = 'zinc',
}: {
  label: string;
  value: string;
  detail?: string;
  color?: 'zinc' | 'amber' | 'emerald';
}) {
  const borderColors: Record<string, string> = {
    zinc: 'border-zinc-700',
    amber: 'border-amber-500/30',
    emerald: 'border-emerald-500/30',
  };

  const valueColors: Record<string, string> = {
    zinc: 'text-zinc-100',
    amber: 'text-amber-400',
    emerald: 'text-emerald-400',
  };

  return (
    <div className={`rounded-lg border bg-zinc-800 p-3 ${borderColors[color]}`}>
      <div className="text-xs text-zinc-400">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${valueColors[color]}`}>{value}</div>
      {detail && <div className="mt-0.5 text-xs text-zinc-500">{detail}</div>}
    </div>
  );
}

// ---- Main Usage View ------------------------------------------------------

export function Usage() {
  const { usage, sessionUsage, demonUsage, modelDistribution, isLoading, error, loadAll } =
    useUsageStore();

  const { status } = useConnectionStore();

  const load = useCallback(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (status === 'connected') {
      load();
    }
  }, [status, load]);

  const topSessionActivity = [...sessionUsage]
    .sort((a, b) => b.totalTokens - a.totalTokens)
    .slice(0, 10)
    .map((session) => ({
      name: session.name,
      totalTokens: session.totalTokens,
      inputTokens: session.inputTokens,
      outputTokens: session.outputTokens,
    }));

  const sessionColumns = useMemo<ColumnDef<SessionUsageEntry>[]>(
    () => [
      {
        header: 'Session',
        accessorFn: (row) => row.name,
        id: 'name',
        cell: ({ row }) => (
          <div>
            <div className="text-sm text-zinc-100">{row.original.name}</div>
            <div className="font-mono text-xs text-zinc-500">
              {row.original.sessionKey.length > 16
                ? `${row.original.sessionKey.slice(0, 16)}...`
                : row.original.sessionKey}
            </div>
          </div>
        ),
      },
      {
        header: () => <div className="w-full text-right">Input</div>,
        accessorKey: 'inputTokens',
        cell: ({ row }) => (
          <div className="w-full text-right text-sm text-zinc-100">
            {formatTokens(row.original.inputTokens)}
          </div>
        ),
      },
      {
        header: () => <div className="w-full text-right">Output</div>,
        accessorKey: 'outputTokens',
        cell: ({ row }) => (
          <div className="w-full text-right text-sm text-zinc-100">
            {formatTokens(row.original.outputTokens)}
          </div>
        ),
      },
      {
        header: () => <div className="w-full text-right">Total</div>,
        accessorKey: 'totalTokens',
        cell: ({ row }) => {
          const totalPct =
            row.original.totalTokens > 0
              ? Math.round((row.original.outputTokens / row.original.totalTokens) * 100)
              : 0;

          return (
            <div className="w-full text-right">
              <span className="text-sm font-medium text-zinc-100">
                {formatTokens(row.original.totalTokens)}
              </span>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-zinc-700">
                <div className="h-1 rounded-full bg-amber-500" style={{ width: `${totalPct}%` }} />
              </div>
            </div>
          );
        },
      },
      {
        header: 'Model',
        accessorKey: 'model',
        cell: ({ row }) => (
          <span className="rounded-md bg-zinc-700/50 px-2 py-0.5 text-xs text-zinc-400">
            {row.original.model}
          </span>
        ),
      },
      {
        header: 'Last Activity',
        accessorFn: (row) => row.lastActivity,
        id: 'lastActivity',
        cell: ({ row }) => (
          <span className="text-xs text-zinc-500">
            {formatTimestamp(row.original.lastActivity)}
          </span>
        ),
      },
    ],
    []
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-zinc-700 p-4">
        <h1 className="text-lg font-semibold text-zinc-100">Usage</h1>
        <p className="text-sm text-zinc-400">Token consumption and costs</p>

        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={load}
            disabled={isLoading}
            className="rounded-md bg-amber-500 px-3 py-2 text-sm text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
            type="button"
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {error && !usage ? (
          <ErrorState message={error} onRetry={load} />
        ) : isLoading && !usage ? (
          <LoadingSpinner message="Loading usage data..." />
        ) : !usage ? (
          <EmptyState
            message="No usage data available"
            detail='Click "Refresh" to load usage statistics.'
            action="Refresh"
            onAction={load}
          />
        ) : (
          <div className="space-y-6">
            {/* Summary Cards */}
            {usage && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryCard
                  label="Total Tokens"
                  value={formatTokens(usage.totalTokens)}
                  detail={`${formatTokens(usage.totalInputTokens)} in / ${formatTokens(usage.totalOutputTokens)} out`}
                  color="amber"
                />
                <SummaryCard
                  label="Input Tokens"
                  value={formatTokens(usage.totalInputTokens)}
                  detail="Prompt tokens sent"
                />
                <SummaryCard
                  label="Output Tokens"
                  value={formatTokens(usage.totalOutputTokens)}
                  detail="Completion tokens received"
                />
                <SummaryCard
                  label="Estimated Cost"
                  value={formatCost(usage.estimatedCostUsd)}
                  detail="Approximate total"
                  color="emerald"
                />
              </div>
            )}

            {usage && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <StatusDot status="online" size="sm" />
                  <span className="text-xs text-zinc-400">
                    {usage.activeSessions} active session{usage.activeSessions !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            )}

            {/* Model Distribution */}
            <ModelDistributionChart distribution={modelDistribution} />

            {/* Per-Demon Usage */}
            <DemonUsageChart demons={demonUsage} />

            {/* Disclaimer */}
            <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2">
              <p className="text-xs text-amber-400/80">
                Cost estimates are approximate and may not reflect actual billing. Actual costs
                depend on your provider pricing and any discounts applied.
              </p>
            </div>

            <SessionActivityChart sessions={topSessionActivity} />

            {/* Per-session Table */}
            <div>
              <h2 className="mb-3 text-sm font-medium text-zinc-100">
                Per-Session Usage ({sessionUsage.length})
              </h2>

              <DataTable
                columns={sessionColumns}
                data={sessionUsage}
                emptyMessage="No session usage data"
                emptyDetail="Usage data will appear after sessions are active."
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
