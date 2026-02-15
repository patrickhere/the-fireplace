// ---------------------------------------------------------------------------
// Config View
// ---------------------------------------------------------------------------

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useConfigStore } from '@/stores/config';
import { useConnectionStore } from '@/stores/connection';
import type { UiHint } from '@/stores/config';

// ---- Confirmation Dialog --------------------------------------------------

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="mx-4 w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-900 p-4">
        <h3 className="mb-2 text-lg font-semibold text-zinc-100">{title}</h3>
        <p className="mb-4 text-sm text-zinc-400">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md bg-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-600"
            type="button"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400"
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Schema Sidebar -------------------------------------------------------

function SchemaSidebar({ uiHints }: { uiHints: Record<string, UiHint> }) {
  const groups = useMemo(() => {
    const groupMap = new Map<string, { keys: string[]; minOrder: number }>();

    for (const [key, hint] of Object.entries(uiHints)) {
      const groupName = hint.group ?? 'Other';
      const existing = groupMap.get(groupName);
      if (existing) {
        existing.keys.push(key);
        if (hint.order !== undefined && hint.order < existing.minOrder) {
          existing.minOrder = hint.order;
        }
      } else {
        groupMap.set(groupName, {
          keys: [key],
          minOrder: hint.order ?? 999,
        });
      }
    }

    return Array.from(groupMap.entries())
      .sort((a, b) => a[1].minOrder - b[1].minOrder)
      .map(([name, data]) => ({
        name,
        keys: data.keys,
      }));
  }, [uiHints]);

  if (groups.length === 0) {
    return <div className="p-3 text-xs text-zinc-500">No schema groups available.</div>;
  }

  return (
    <div className="space-y-1 p-2">
      <h3 className="mb-2 px-1 text-xs font-semibold tracking-wider text-zinc-500 uppercase">
        Config Sections
      </h3>
      {groups.map((group) => (
        <div
          key={group.name}
          className="rounded-md px-2 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
        >
          <div className="font-medium">{group.name}</div>
          <div className="text-xs text-zinc-500">
            {group.keys.length} setting{group.keys.length !== 1 ? 's' : ''}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Editor Area ----------------------------------------------------------

function ConfigEditor({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineCountRef = useRef<HTMLDivElement>(null);

  const lineCount = useMemo(() => {
    return value.split('\n').length;
  }, [value]);

  const handleScroll = useCallback(() => {
    if (textareaRef.current && lineCountRef.current) {
      lineCountRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  return (
    <div className="relative flex flex-1 overflow-hidden rounded-md border border-zinc-700 bg-zinc-950">
      {/* Line numbers */}
      <div
        ref={lineCountRef}
        className="flex-shrink-0 overflow-hidden border-r border-zinc-800 bg-zinc-900/50 px-2 py-2 text-right font-mono text-xs leading-[1.375rem] text-zinc-600 select-none"
        style={{ width: '3.5rem' }}
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={handleScroll}
        disabled={disabled}
        spellCheck={false}
        className="flex-1 resize-none bg-transparent p-2 font-mono text-sm leading-[1.375rem] text-zinc-100 placeholder-zinc-600 outline-none disabled:opacity-50"
        placeholder="Loading config..."
      />
    </div>
  );
}

// ---- Main Config View -----------------------------------------------------

export function Config() {
  const {
    rawConfig,
    configHash,
    uiHints,
    isLoading,
    isSaving,
    error,
    loadConfig,
    loadSchema,
    saveConfig,
  } = useConfigStore();

  const { status } = useConnectionStore();

  const [editorValue, setEditorValue] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);

  // Load config on mount
  useEffect(() => {
    if (status === 'connected') {
      loadConfig();
      loadSchema();
    }
  }, [status, loadConfig, loadSchema]);

  // Sync raw config into editor when loaded
  useEffect(() => {
    if (rawConfig !== null) {
      setEditorValue(rawConfig);
      setHasUnsavedChanges(false);
    }
  }, [rawConfig]);

  const handleEditorChange = useCallback(
    (value: string) => {
      setEditorValue(value);
      setHasUnsavedChanges(value !== rawConfig);
    },
    [rawConfig]
  );

  const handleSaveClick = useCallback(() => {
    setShowConfirm(true);
  }, []);

  const handleConfirmSave = useCallback(async () => {
    setShowConfirm(false);
    await saveConfig(editorValue);
  }, [saveConfig, editorValue]);

  const handleRevert = useCallback(() => {
    if (rawConfig !== null) {
      setEditorValue(rawConfig);
      setHasUnsavedChanges(false);
    }
  }, [rawConfig]);

  const hasHints = Object.keys(uiHints).length > 0;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-700 p-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">Config</h1>
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span>Gateway configuration editor</span>
            {configHash && (
              <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-zinc-500">
                hash: {configHash.slice(0, 12)}...
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasHints && (
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className={`rounded-md px-3 py-1.5 text-sm ${
                showSidebar
                  ? 'bg-zinc-700 text-zinc-200'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
              type="button"
            >
              Sections
            </button>
          )}

          {hasUnsavedChanges && (
            <button
              onClick={handleRevert}
              className="rounded-md bg-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-600"
              type="button"
            >
              Revert
            </button>
          )}

          <button
            onClick={() => loadConfig()}
            disabled={isLoading}
            className="rounded-md bg-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-600 disabled:opacity-50"
            type="button"
          >
            Reload
          </button>

          <button
            onClick={handleSaveClick}
            disabled={isSaving || !hasUnsavedChanges}
            className="rounded-md bg-amber-500 px-4 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
            type="button"
          >
            {isSaving ? 'Saving...' : 'Save & Apply'}
          </button>
        </div>
      </div>

      {/* Unsaved changes indicator */}
      {hasUnsavedChanges && (
        <div className="border-b border-amber-500/20 bg-amber-500/10 px-3 py-1.5">
          <p className="text-xs text-amber-400">You have unsaved changes.</p>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="border-b border-red-500/20 bg-red-500/10 px-3 py-2">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {showSidebar && hasHints && (
          <div className="w-48 flex-shrink-0 overflow-y-auto border-r border-zinc-700 bg-zinc-900/50">
            <SchemaSidebar uiHints={uiHints} />
          </div>
        )}

        {/* Editor Area */}
        <div className="flex flex-1 flex-col p-3">
          {isLoading && rawConfig === null ? (
            <div className="flex flex-1 items-center justify-center">
              <span className="text-sm text-zinc-400">Loading configuration...</span>
            </div>
          ) : (
            <ConfigEditor value={editorValue} onChange={handleEditorChange} disabled={isSaving} />
          )}

          {/* Status bar */}
          <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
            <span>{editorValue.split('\n').length} lines</span>
            <span>{editorValue.length} characters</span>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={showConfirm}
        title="Apply Configuration"
        message="This will apply the new configuration and restart the gateway. Active connections may be briefly interrupted. Are you sure?"
        confirmLabel="Save & Apply"
        onConfirm={handleConfirmSave}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}
