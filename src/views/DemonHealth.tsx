// ---------------------------------------------------------------------------
// Demon Health Dashboard View
// ---------------------------------------------------------------------------

import { useEffect, useCallback } from 'react';
import { useDemonHealthStore, type DemonStatus } from '@/stores/demonHealth';
import { useConnectionStore } from '@/stores/connection';
import { useUsageStore } from '@/stores/usage';
import { LoadingSpinner, EmptyState } from '@/components/StateIndicators';
import { StatusDot } from '@/components/atoms/StatusDot';
import { Card, CardContent } from '@/components/ui/card';
import { classifyModel, type ModelTier } from '@/lib/modelTiers';

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
    .replace('gpt-5-mini', 'gpt-5m');
}

// ---- Status Indicator -----------------------------------------------------

function DemonStateIndicator({ state }: { state: DemonStatus['state'] }) {
  const labels: Record<DemonStatus['state'], string> = {
    working: 'Working',
    idle: 'Idle',
    error: 'Error',
    offline: 'Offline',
  };

  return (
    <div className="flex items-center gap-1.5">
      <StatusDot
        status={
          state === 'working'
            ? 'online'
            : state === 'idle'
              ? 'warning'
              : state === 'error'
                ? 'error'
                : 'offline'
        }
      />
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

// ---- Metrics Helpers ------------------------------------------------------

function successRate(demon: DemonStatus): string {
  const total = demon.successCount + demon.errorCount;
  if (total === 0) return '—';
  return `${Math.round((demon.successCount / total) * 100)}%`;
}

function formatTokenCount(tokens: number): string {
  if (tokens === 0) return '0';
  if (tokens < 1000) return String(tokens);
  if (tokens < 1_000_000) return `${(tokens / 1000).toFixed(1)}k`;
  return `${(tokens / 1_000_000).toFixed(2)}M`;
}

function tierColor(tier: ModelTier): string {
  const colors: Record<ModelTier, string> = {
    free: 'bg-emerald-500',
    cheap: 'bg-sky-500',
    premium: 'bg-amber-500',
    max: 'bg-violet-500',
    unknown: 'bg-zinc-500',
  };
  return colors[tier];
}

// ---- Activity Dot Timeline ------------------------------------------------

function ActivityDots({ activity }: { activity: DemonStatus['recentActivity'] }) {
  if (activity.length === 0) return null;
  return (
    <div className="flex items-center gap-0.5">
      {activity.slice(0, 15).map((entry, i) => (
        <div
          key={`${entry.timestamp}-${i}`}
          className={`h-1.5 w-1.5 rounded-full ${
            entry.type === 'success'
              ? 'bg-emerald-500'
              : entry.type === 'error'
                ? 'bg-red-500'
                : 'bg-amber-500'
          }`}
          title={`${entry.type} at ${new Date(entry.timestamp).toLocaleTimeString()}`}
        />
      ))}
    </div>
  );
}

// ---- Success/Error Ratio Bar ----------------------------------------------

function RatioBar({ success, error }: { success: number; error: number }) {
  const total = success + error;
  if (total === 0) return null;
  const successPct = (success / total) * 100;
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-zinc-700">
      <div className="h-full bg-emerald-500 transition-all" style={{ width: `${successPct}%` }} />
      {error > 0 && (
        <div
          className="h-full bg-red-500 transition-all"
          style={{ width: `${100 - successPct}%` }}
        />
      )}
    </div>
  );
}

// ---- Model Tier Badge -----------------------------------------------------

function tierBadgeStyle(tier: ModelTier): string {
  const styles: Record<ModelTier, string> = {
    free: 'bg-emerald-500/20 text-emerald-400',
    cheap: 'bg-sky-500/20 text-sky-400',
    premium: 'bg-amber-500/20 text-amber-400',
    max: 'bg-violet-500/20 text-violet-400',
    unknown: 'bg-zinc-500/20 text-zinc-400',
  };
  return styles[tier];
}

function ModelTierBadge({ model }: { model: string }) {
  if (!model) return null;
  const { tier, label } = classifyModel(model);
  return <span className={`rounded px-1 py-0.5 text-[10px] ${tierBadgeStyle(tier)}`}>{label}</span>;
}

// ---- Demon Card -----------------------------------------------------------

function DemonCard({ demon }: { demon: DemonStatus }) {
  return (
    <Card className="bg-zinc-800">
      <CardContent className="p-3">
        {/* Top: emoji + name + status */}
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">{demon.demonEmoji}</span>
            <span className="text-sm font-medium text-zinc-100">{demon.demonName}</span>
          </div>
          <DemonStateIndicator state={demon.state} />
        </div>

        {/* Middle: current task */}
        <div className="mb-2 min-h-[2.5rem]">
          {demon.currentTask ? (
            <p className="line-clamp-2 text-sm text-zinc-400">{demon.currentTask}</p>
          ) : (
            <p className="text-sm text-zinc-600">&mdash;</p>
          )}
        </div>

        {/* Metrics: success/error ratio bar */}
        {(demon.successCount > 0 || demon.errorCount > 0) && (
          <div className="mb-2 space-y-1">
            <div className="flex items-center justify-between text-[10px] text-zinc-500">
              <span>{successRate(demon)} success</span>
              <span>
                {demon.successCount}/{demon.successCount + demon.errorCount} tasks
              </span>
            </div>
            <RatioBar success={demon.successCount} error={demon.errorCount} />
          </div>
        )}

        {/* Bottom: model badge, sessions, last activity, tokens */}
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <span className="rounded bg-zinc-700 px-1.5 py-0.5 text-zinc-300">
              {shortModel(demon.activeModel)}
            </span>
            <ModelTierBadge model={demon.activeModel} />
          </div>
          <span>{relativeTime(demon.lastActivity)}</span>
        </div>

        <div className="mt-1.5 flex items-center justify-between text-[10px] text-zinc-600">
          <span>
            {demon.activeSessions} {demon.activeSessions === 1 ? 'session' : 'sessions'}
            {demon.totalTokens > 0 && ` · ${formatTokenCount(demon.totalTokens)} tokens`}
          </span>
          <ActivityDots activity={demon.recentActivity} />
        </div>

        {/* CLI Backend indicator */}
        {demon.cliBackend.active && (
          <div className="mt-2 border-t border-zinc-700 pt-2">
            <CliBackendBadge cliBackend={demon.cliBackend} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---- Main View ------------------------------------------------------------

// ---- Cost Efficiency Card -------------------------------------------------

function CostEfficiencyCard({ demons }: { demons: DemonStatus[] }) {
  const { modelDistribution } = useUsageStore();

  // Compute token percentages by tier from usage store
  const totalTokens = modelDistribution.reduce((sum, m) => sum + m.tokenCount, 0);
  if (totalTokens === 0 && demons.every((d) => d.totalTokens === 0)) return null;

  const tierGroups: Record<string, number> = {};
  for (const entry of modelDistribution) {
    const key = entry.tier;
    tierGroups[key] = (tierGroups[key] ?? 0) + entry.tokenCount;
  }

  const tiers: { tier: ModelTier; label: string; tokens: number; pct: number }[] = [];
  for (const [tierName, tokens] of Object.entries(tierGroups)) {
    tiers.push({
      tier: tierName as ModelTier,
      label: tierName,
      tokens,
      pct: totalTokens > 0 ? (tokens / totalTokens) * 100 : 0,
    });
  }
  tiers.sort((a, b) => b.tokens - a.tokens);

  // Efficiency: % tokens on free + cheap tiers
  const cheapTokens = (tierGroups['Free'] ?? 0) + (tierGroups['Low Cost'] ?? 0);
  const efficiencyPct = totalTokens > 0 ? Math.round((cheapTokens / totalTokens) * 100) : 0;

  return (
    <Card className="mb-4 bg-zinc-800">
      <CardContent className="p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-200">Cost Efficiency</span>
          <span
            className={`text-sm font-semibold ${
              efficiencyPct >= 70
                ? 'text-emerald-400'
                : efficiencyPct >= 40
                  ? 'text-amber-400'
                  : 'text-red-400'
            }`}
          >
            {efficiencyPct}% on free/cheap
          </span>
        </div>
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-zinc-700">
          {tiers.map((t) => (
            <div
              key={t.tier}
              className={`h-full ${tierColor(t.tier)}`}
              style={{ width: `${t.pct}%` }}
              title={`${t.label}: ${formatTokenCount(t.tokens)} (${Math.round(t.pct)}%)`}
            />
          ))}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-3 text-[10px] text-zinc-500">
          {tiers.map((t) => (
            <span key={t.tier} className="flex items-center gap-1">
              <span className={`inline-block h-2 w-2 rounded-full ${tierColor(t.tier)}`} />
              {t.label} {Math.round(t.pct)}%
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
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
        {!isMonitoring && demons.length === 0 ? (
          <LoadingSpinner message="Starting health monitor..." />
        ) : demons.length === 0 ? (
          <EmptyState
            message="No demons configured"
            detail="Add agents in the Agents view to monitor their health here."
          />
        ) : (
          <>
            <CostEfficiencyCard demons={demons} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {demons.map((demon) => (
                <DemonCard key={demon.demonId} demon={demon} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
