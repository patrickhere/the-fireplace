// ---------------------------------------------------------------------------
// Demon Health Dashboard View
// ---------------------------------------------------------------------------

import { useEffect, useCallback } from 'react';
import { useDemonHealthStore } from '@/stores/demonHealth';
import { useConnectionStore } from '@/stores/connection';
import type { DemonStatus } from '@/stores/demonHealth';

// ---- Helpers --------------------------------------------------------------

function relativeTime(timestamp: number): string {
  if (!timestamp) return 'never';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function cliElapsedMinutes(startedAt: number | null): string {
  if (!startedAt) return '0m';
  const minutes = Math.floor((Date.now() - startedAt) / 60_000);
  return `${minutes}m`;
}

function shortModel(model: string): string {
  if (!model) return '—';
  // Strip provider prefix for display
  const parts = model.split('/');
  const name = parts[parts.length - 1] ?? model;
  // Shorten common model names
  return name
    .replace('claude-opus-4-6', 'opus-4.6')
    .replace('claude-sonnet-4-5', 'sonnet-4.5')
    .replace('claude-haiku-4-5', 'haiku-4.5')
    .replace('gemini-2.5-flash', 'flash-2.5')
    .replace('gemini-2.5-flash-lite', 'flash-lite')
    .replace('gpt-4.1', 'gpt-4.1')
    .replace('gpt-5-mini', 'gpt-5m')
    .replace('gpt-4o', 'gpt-4o');
}

// ---- Status Dot -----------------------------------------------------------

function StatusDot({ state }: { state: DemonStatus['state'] }) {
  const colors: Record<DemonStatus['state'], string> = {
    working: 'bg-emerald-500',
    idle: 'bg-zinc-400',
    error: 'bg-red-500',
    offline: 'bg-zinc-700',
  };

  const labels: Record<DemonStatus['state'], string> = {
    working: 'Working',
    idle: 'Idle',
    error: 'Error',
    offline: 'Offline',
  };

  return (
    <div className="flex items-center gap-1.5">
      <div className={`h-2 w-2 rounded-full ${colors[state]}`} />
      <span className="text-xs text-zinc-400">{labels[state]}</span>
    </div>
  );
}

// ---- CLI Backend Badge ----------------------------------------------------

function CliBackendBadge({ cliBackend }: { cliBackend: DemonStatus['cliBackend'] }) {
  if (!cliBackend.active || !cliBackend.tool) return null;

  const label = cliBackend.tool === 'claude-code' ? 'Claude Code' : 'Codex';
  const elapsed = cliElapsedMinutes(cliBackend.startedAt);

  return (
    <div className="flex items-center gap-1.5 text-xs text-amber-400">
      <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
      <span>
        {label} ({elapsed})
      </span>
    </div>
  );
}

// ---- Demon Card -----------------------------------------------------------

function DemonCard({ demon }: { demon: DemonStatus }) {
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-3">
      {/* Top: emoji + name + status */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">{demon.demonEmoji}</span>
          <span className="text-sm font-medium text-zinc-100">{demon.demonName}</span>
        </div>
        <StatusDot state={demon.state} />
      </div>

      {/* Middle: current task */}
      <div className="mb-2 min-h-[2.5rem]">
        {demon.currentTask ? (
          <p className="line-clamp-2 text-sm text-zinc-400">{demon.currentTask}</p>
        ) : (
          <p className="text-sm text-zinc-600">&mdash;</p>
        )}
      </div>

      {/* Bottom: model badge, sessions, last activity */}
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <div className="flex items-center gap-2">
          <span className="rounded bg-zinc-700 px-1.5 py-0.5 text-zinc-300">
            {shortModel(demon.activeModel)}
          </span>
          <span>
            {demon.activeSessions} {demon.activeSessions === 1 ? 'session' : 'sessions'}
          </span>
        </div>
        <span>{relativeTime(demon.lastActivity)}</span>
      </div>

      {/* CLI Backend indicator */}
      {demon.cliBackend.active && (
        <div className="mt-2 border-t border-zinc-700 pt-2">
          <CliBackendBadge cliBackend={demon.cliBackend} />
        </div>
      )}
    </div>
  );
}

// ---- Main View ------------------------------------------------------------

export function DemonHealth() {
  const { demons, isMonitoring, startMonitoring, stopMonitoring, refreshAll } =
    useDemonHealthStore();
  const { status } = useConnectionStore();

  // Start monitoring on mount
  useEffect(() => {
    if (status === 'connected') {
      startMonitoring();
    }
    return () => {
      stopMonitoring();
    };
  }, [status, startMonitoring, stopMonitoring]);

  // Refresh every 30 seconds
  useEffect(() => {
    if (!isMonitoring) return;
    const interval = setInterval(() => {
      refreshAll();
    }, 30_000);
    return () => clearInterval(interval);
  }, [isMonitoring, refreshAll]);

  // Summary counts
  const counts = demons.reduce(
    (acc, d) => {
      acc[d.state] = (acc[d.state] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const summaryParts: string[] = [];
  if (counts.working) summaryParts.push(`${counts.working} working`);
  if (counts.idle) summaryParts.push(`${counts.idle} idle`);
  if (counts.error) summaryParts.push(`${counts.error} error`);
  if (counts.offline) summaryParts.push(`${counts.offline} offline`);
  const summary = summaryParts.join(' · ') || 'No demons';

  const handleRefresh = useCallback(() => {
    refreshAll();
  }, [refreshAll]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-zinc-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-zinc-100">Demon Health</h1>
            <p className="text-sm text-zinc-400">{summary}</p>
          </div>
          <button
            onClick={handleRefresh}
            className="rounded-md bg-amber-500 px-3 py-1.5 text-sm text-zinc-950 hover:bg-amber-400"
            type="button"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {demons.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No demons configured. Add agents in the Agents view.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {demons.map((demon) => (
              <DemonCard key={demon.demonId} demon={demon} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
