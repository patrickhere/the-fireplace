// ---------------------------------------------------------------------------
// Config View
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { useConfigStore } from '@/stores/config';
import { useConnectionStore } from '@/stores/connection';

export function Config() {
  const {
    config,
    draftConfig,
    isLoading,
    error,
    isDirty,
    showRawEditor,
    loadConfig,
    loadSchema,
    setDraftConfig,
    applyConfig,
    resetDraft,
    setShowRawEditor,
  } = useConfigStore();

  const { status } = useConnectionStore();
  const [rawJson, setRawJson] = useState('');
  const [applyError, setApplyError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'connected') {
      loadConfig();
      loadSchema();
    }
  }, [status, loadConfig, loadSchema]);

  useEffect(() => {
    if (draftConfig && showRawEditor) {
      setRawJson(JSON.stringify(draftConfig, null, 2));
    }
  }, [draftConfig, showRawEditor]);

  const handleApply = async () => {
    try {
      setApplyError(null);
      if (showRawEditor) {
        const parsed = JSON.parse(rawJson);
        setDraftConfig(parsed);
      }
      await applyConfig();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to apply config';
      setApplyError(errorMessage);
    }
  };

  const handleRawJsonChange = (value: string) => {
    setRawJson(value);
    try {
      const parsed = JSON.parse(value);
      setDraftConfig(parsed);
    } catch {
      // Invalid JSON, don't update draft
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-zinc-700 p-4">
        <h1 className="text-lg font-semibold text-zinc-100">Config</h1>
        <p className="text-sm text-zinc-400">Gateway configuration editor</p>

        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setShowRawEditor(!showRawEditor)}
            className={`rounded-md px-3 py-2 text-sm ${
              showRawEditor
                ? 'bg-amber-500 text-zinc-950'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100'
            }`}
            type="button"
          >
            {showRawEditor ? 'Form Editor' : 'Raw JSON'}
          </button>
          <button
            onClick={resetDraft}
            disabled={!isDirty}
            className="rounded-md bg-zinc-800 px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
          >
            Reset
          </button>
          <button
            onClick={handleApply}
            disabled={!isDirty}
            className="rounded-md bg-amber-500 px-3 py-2 text-sm text-zinc-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
          >
            Apply Config
          </button>
          {isDirty && (
            <span className="flex items-center text-sm text-amber-400">Unsaved changes</span>
          )}
        </div>
      </div>

      {/* Error Banners */}
      {error && (
        <div className="border-b border-red-500/20 bg-red-500/10 p-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
      {applyError && (
        <div className="border-b border-red-500/20 bg-red-500/10 p-3">
          <p className="text-sm text-red-400">{applyError}</p>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="text-sm text-zinc-400">Loading config...</div>
        ) : !config ? (
          <div className="text-sm text-zinc-400">No config loaded.</div>
        ) : showRawEditor ? (
          <div className="h-full">
            <textarea
              value={rawJson}
              onChange={(e) => handleRawJsonChange(e.target.value)}
              className="h-full w-full resize-none rounded-md border border-zinc-700 bg-zinc-900 p-4 font-mono text-sm text-zinc-100 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 focus:outline-none"
              spellCheck={false}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-zinc-400">
              Form-based config editor coming soon. Use Raw JSON mode for now.
            </p>
            <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-4">
              <pre className="overflow-x-auto text-xs text-zinc-300">
                {JSON.stringify(config, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
