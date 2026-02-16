// ---------------------------------------------------------------------------
// Models View
// ---------------------------------------------------------------------------

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useModelsStore } from '@/stores/models';
import { useConnectionStore } from '@/stores/connection';
import { useAgentsStore } from '@/stores/agents';
import { classifyModel, tierBadgeClasses } from '@/lib/modelTiers';
import type { ModelChoice } from '@/stores/models';
import type { Agent } from '@/stores/agents';

// ---- Known demon model assignments (from OpenClaw config) -----------------

const DEMON_MODEL_ASSIGNMENTS: Record<string, string> = {
  calcifer: 'anthropic/claude-sonnet-4-5',
  buer: 'copilot-free/gpt-4.1',
  paimon: 'google/gemini-2.5-flash',
  alloces: 'copilot-free/gpt-4.1',
  dantalion: 'copilot-free/gpt-5-mini',
  andromalius: 'copilot-free/gpt-4.1',
  malphas: 'copilot-free/gpt-4.1',
};

// ---- Context Window Formatter ---------------------------------------------

function formatContextWindow(tokens?: number): string {
  if (!tokens) return '-';
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(0)}k`;
  return String(tokens);
}

// ---- Build demon-to-model reverse map -------------------------------------

function buildModelDemonMap(agents: Agent[]): Record<string, Agent[]> {
  const map: Record<string, Agent[]> = {};
  for (const agent of agents) {
    const primaryModel = DEMON_MODEL_ASSIGNMENTS[agent.id];
    if (!primaryModel) continue;
    if (!map[primaryModel]) {
      map[primaryModel] = [];
    }
    map[primaryModel].push(agent);
  }
  return map;
}

// ---- Demon Badge ----------------------------------------------------------

function DemonBadge({ agent }: { agent: Agent }) {
  const emoji = agent.identity?.emoji ?? '?';
  const name = agent.identity?.name ?? agent.id;
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded bg-zinc-700/50 px-1.5 py-0.5 text-xs text-zinc-300"
      title={name}
    >
      <span>{emoji}</span>
      <span className="text-zinc-400">{name}</span>
    </span>
  );
}

// ---- Model Card Component -------------------------------------------------

function ModelCard({
  model,
  isCurrent,
  onSelect,
  assignedDemons,
}: {
  model: ModelChoice;
  isCurrent: boolean;
  onSelect: () => void;
  assignedDemons: Agent[];
}) {
  const [isSettling, setIsSettling] = useState(false);
  const tierInfo = classifyModel(`${model.provider}/${model.id}`);
  const badgeClasses = tierBadgeClasses(tierInfo.tier);

  const handleSet = async () => {
    setIsSettling(true);
    onSelect();
    setTimeout(() => setIsSettling(false), 1000);
  };

  return (
    <div
      className={`rounded-lg border p-3 transition-colors ${
        isCurrent
          ? 'border-amber-500 bg-amber-500/5'
          : 'border-zinc-700 bg-zinc-800 hover:border-zinc-600'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-100">{model.name}</span>
            {isCurrent && (
              <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-medium text-zinc-950">
                Default
              </span>
            )}
          </div>

          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs text-zinc-500">{model.provider}</span>
            <span className={badgeClasses}>{tierInfo.label}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {model.contextWindow && (
              <span className="rounded-md bg-zinc-700/50 px-2 py-0.5 text-xs text-zinc-400">
                {formatContextWindow(model.contextWindow)} context
              </span>
            )}
            {model.reasoning && (
              <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">
                Reasoning
              </span>
            )}
          </div>

          {/* Assigned Demons */}
          {assignedDemons.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1">
              <span className="text-xs text-zinc-500">Demons:</span>
              {assignedDemons.map((agent) => (
                <DemonBadge key={agent.id} agent={agent} />
              ))}
            </div>
          )}
        </div>

        {!isCurrent && (
          <button
            onClick={handleSet}
            disabled={isSettling}
            className="rounded-md bg-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-600 hover:text-zinc-100 disabled:opacity-50"
            type="button"
          >
            {isSettling ? 'Setting...' : 'Set Default'}
          </button>
        )}
      </div>
    </div>
  );
}

// ---- Main Models View -----------------------------------------------------

export function Models() {
  const { models, currentModelId, isLoading, error, loadModels, setModel } = useModelsStore();
  const { agents, loadAgents } = useAgentsStore();
  const { status } = useConnectionStore();

  const load = useCallback(() => {
    loadModels();
    loadAgents();
  }, [loadModels, loadAgents]);

  useEffect(() => {
    if (status === 'connected') {
      load();
    }
  }, [status, load]);

  // Build reverse map: modelId -> demons using it as primary
  const modelDemonMap = useMemo(() => buildModelDemonMap(agents), [agents]);

  // Group models by provider
  const groupedModels = useMemo(() => {
    const groups: Record<string, ModelChoice[]> = {};
    for (const model of models) {
      const provider = model.provider || 'Other';
      if (!groups[provider]) {
        groups[provider] = [];
      }
      groups[provider].push(model);
    }
    // Sort providers alphabetically, but put the current model's provider first
    const currentProvider = models.find((m) => m.id === currentModelId)?.provider;
    const entries = Object.entries(groups).sort(([a], [b]) => {
      if (a === currentProvider) return -1;
      if (b === currentProvider) return 1;
      return a.localeCompare(b);
    });
    return entries;
  }, [models, currentModelId]);

  // Count models by tier
  const tierCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const model of models) {
      const tier = classifyModel(`${model.provider}/${model.id}`);
      counts[tier.label] = (counts[tier.label] || 0) + 1;
    }
    return counts;
  }, [models]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-zinc-700 p-4">
        <h1 className="text-lg font-semibold text-zinc-100">Models</h1>
        <p className="text-sm text-zinc-400">Available AI models</p>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            onClick={load}
            disabled={isLoading}
            className="rounded-md bg-amber-500 px-3 py-2 text-sm text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
            type="button"
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
          <span className="text-xs text-zinc-500">
            {models.length} model{models.length !== 1 ? 's' : ''} available
          </span>
          {Object.entries(tierCounts).map(([label, count]) => (
            <span key={label} className="text-xs text-zinc-500">
              {count} {label}
            </span>
          ))}
          {currentModelId && (
            <span className="text-xs text-zinc-400">
              Current: <span className="text-amber-400">{currentModelId}</span>
            </span>
          )}
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
        {isLoading && models.length === 0 ? (
          <div className="text-sm text-zinc-400">Loading models...</div>
        ) : models.length === 0 ? (
          <div className="text-sm text-zinc-500">No models available. Click "Refresh" to load.</div>
        ) : (
          <div className="space-y-6">
            {groupedModels.map(([provider, providerModels]) => (
              <div key={provider}>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-300">
                  <span>{provider}</span>
                  <span className="text-xs text-zinc-500">({providerModels.length})</span>
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {providerModels.map((model) => (
                    <ModelCard
                      key={model.id}
                      model={model}
                      isCurrent={model.id === currentModelId}
                      onSelect={() => setModel(model.id)}
                      assignedDemons={modelDemonMap[`${model.provider}/${model.id}`] ?? []}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
