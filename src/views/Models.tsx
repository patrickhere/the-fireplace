// ---------------------------------------------------------------------------
// Models View
// ---------------------------------------------------------------------------

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useModelsStore } from '@/stores/models';
import { useConnectionStore } from '@/stores/connection';
import type { ModelChoice } from '@/stores/models';

// ---- Context Window Formatter ---------------------------------------------

function formatContextWindow(tokens?: number): string {
  if (!tokens) return '-';
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(0)}k`;
  return String(tokens);
}

// ---- Model Card Component -------------------------------------------------

function ModelCard({
  model,
  isCurrent,
  onSelect,
}: {
  model: ModelChoice;
  isCurrent: boolean;
  onSelect: () => void;
}) {
  const [isSettling, setIsSettling] = useState(false);

  const handleSet = async () => {
    setIsSettling(true);
    onSelect();
    // The store will update currentModelId optimistically
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

          <div className="text-xs text-zinc-500">{model.provider}</div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
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
  const {
    models,
    currentModelId,
    isLoading,
    error,
    loadModels,
    setModel,
  } = useModelsStore();

  const { status } = useConnectionStore();

  const load = useCallback(() => {
    loadModels();
  }, [loadModels]);

  useEffect(() => {
    if (status === 'connected') {
      load();
    }
  }, [status, load]);

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

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-zinc-700 p-4">
        <h1 className="text-lg font-semibold text-zinc-100">Models</h1>
        <p className="text-sm text-zinc-400">Available AI models</p>

        <div className="mt-3 flex items-center gap-3">
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
          <div className="text-sm text-zinc-500">
            No models available. Click "Refresh" to load.
          </div>
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
