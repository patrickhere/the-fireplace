// ---------------------------------------------------------------------------
// Usage View
// ---------------------------------------------------------------------------

import { useEffect, useCallback, useState } from 'react';
import { useUsageStore } from '@/stores/usage';
import { useConnectionStore } from '@/stores/connection';
import type { SessionUsageEntry } from '@/stores/usage';

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

// ---- Sort Controls --------------------------------------------------------

type SortField = 'totalTokens' | 'lastActivity' | 'name';
type SortDir = 'asc' | 'desc';

function sortSessions(
  sessions: SessionUsageEntry[],
  field: SortField,
  dir: SortDir
): SessionUsageEntry[] {
  return [...sessions].sort((a, b) => {
    let cmp = 0;
    switch (field) {
      case 'totalTokens':
        cmp = a.totalTokens - b.totalTokens;
        break;
      case 'lastActivity':
        cmp = a.lastActivity - b.lastActivity;
        break;
      case 'name':
        cmp = a.name.localeCompare(b.name);
        break;
    }
    return dir === 'desc' ? -cmp : cmp;
  });
}

// ---- Session Row ----------------------------------------------------------

function SessionRow({ session }: { session: SessionUsageEntry }) {
  const totalPct =
    session.totalTokens > 0 ? Math.round((session.outputTokens / session.totalTokens) * 100) : 0;

  return (
    <tr className="border-b border-zinc-700/50 last:border-0">
      <td className="px-3 py-2">
        <div className="text-sm text-zinc-100">{session.name}</div>
        <div className="font-mono text-xs text-zinc-500">{session.sessionKey.slice(0, 16)}...</div>
      </td>
      <td className="px-3 py-2 text-right">
        <span className="text-sm text-zinc-100">{formatTokens(session.inputTokens)}</span>
      </td>
      <td className="px-3 py-2 text-right">
        <span className="text-sm text-zinc-100">{formatTokens(session.outputTokens)}</span>
      </td>
      <td className="px-3 py-2 text-right">
        <span className="text-sm font-medium text-zinc-100">
          {formatTokens(session.totalTokens)}
        </span>
        {/* Token ratio bar */}
        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-zinc-700">
          <div className="h-1 rounded-full bg-amber-500" style={{ width: `${totalPct}%` }} />
        </div>
      </td>
      <td className="px-3 py-2">
        <span className="rounded-md bg-zinc-700/50 px-2 py-0.5 text-xs text-zinc-400">
          {session.model}
        </span>
      </td>
      <td className="px-3 py-2 text-xs text-zinc-500">{formatTimestamp(session.lastActivity)}</td>
    </tr>
  );
}

// ---- Sort Header ----------------------------------------------------------

function SortHeader({
  label,
  field,
  currentField,
  currentDir,
  onSort,
  align = 'left',
}: {
  label: string;
  field: SortField;
  currentField: SortField;
  currentDir: SortDir;
  onSort: (field: SortField) => void;
  align?: 'left' | 'right';
}) {
  const isActive = currentField === field;
  const arrow = isActive ? (currentDir === 'desc' ? ' v' : ' ^') : '';

  return (
    <th
      className={`cursor-pointer px-3 py-2 text-xs font-medium text-zinc-400 select-none hover:text-zinc-200 ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${isActive ? 'text-amber-400' : ''}`}
      onClick={() => onSort(field)}
    >
      {label}
      {arrow}
    </th>
  );
}

// ---- Main Usage View ------------------------------------------------------

export function Usage() {
  const { usage, sessionUsage, isLoading, error, loadAll } = useUsageStore();

  const { status } = useConnectionStore();

  const [sortField, setSortField] = useState<SortField>('totalTokens');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const load = useCallback(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (status === 'connected') {
      load();
    }
  }, [status, load]);

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const sortedSessions = sortSessions(sessionUsage, sortField, sortDir);

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

      {/* Error Banner */}
      {error && (
        <div className="border-b border-red-500/20 bg-red-500/10 p-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading && !usage ? (
          <div className="text-sm text-zinc-400">Loading usage data...</div>
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
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-xs text-zinc-400">
                    {usage.activeSessions} active session{usage.activeSessions !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            )}

            {/* Disclaimer */}
            <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2">
              <p className="text-xs text-amber-400/80">
                Cost estimates are approximate and may not reflect actual billing. Actual costs
                depend on your provider pricing and any discounts applied.
              </p>
            </div>

            {/* Per-session Table */}
            <div>
              <h2 className="mb-3 text-sm font-medium text-zinc-100">
                Per-Session Usage ({sessionUsage.length})
              </h2>

              {sessionUsage.length === 0 ? (
                <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4 text-sm text-zinc-500">
                  No session usage data available
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-zinc-700 bg-zinc-900">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-zinc-700 bg-zinc-800/50">
                        <SortHeader
                          label="Session"
                          field="name"
                          currentField={sortField}
                          currentDir={sortDir}
                          onSort={handleSort}
                        />
                        <th className="px-3 py-2 text-right text-xs font-medium text-zinc-400">
                          Input
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-zinc-400">
                          Output
                        </th>
                        <SortHeader
                          label="Total"
                          field="totalTokens"
                          currentField={sortField}
                          currentDir={sortDir}
                          onSort={handleSort}
                          align="right"
                        />
                        <th className="px-3 py-2 text-xs font-medium text-zinc-400">Model</th>
                        <SortHeader
                          label="Last Activity"
                          field="lastActivity"
                          currentField={sortField}
                          currentDir={sortDir}
                          onSort={handleSort}
                        />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedSessions.map((session) => (
                        <SessionRow key={session.sessionKey} session={session} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
