// ---------------------------------------------------------------------------
// Config View
// ---------------------------------------------------------------------------

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  useConfigStore,
  type UiHint,
  type ParsedProvider,
  type EndpointTestResult,
} from '@/stores/config';
import { useConnectionStore } from '@/stores/connection';
import { useAgentsStore, type Agent } from '@/stores/agents';
import { classifyModel, tierBadgeClasses } from '@/lib/modelTiers';
import { GatewaySettings } from '@/components/organisms/GatewaySettings';
import { DataTable } from '@/components/organisms/DataTable';
import { StatusDot as StatusDotAtom } from '@/components/atoms/StatusDot';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { save as saveDialog, open as openDialog } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';
import { toast } from 'sonner';
import type { ColumnDef } from '@tanstack/react-table';

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
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Model Providers Section ----------------------------------------------

function ProviderRow({
  provider,
  testResult,
  onTest,
}: {
  provider: ParsedProvider;
  testResult: EndpointTestResult | undefined;
  onTest: (name: string) => void;
}) {
  const status = testResult?.status ?? 'unknown';

  return (
    <div className="flex items-center gap-3 border-b border-zinc-700/50 px-3 py-2 last:border-0">
      <StatusDotAtom
        status={
          status === 'ok'
            ? 'online'
            : status === 'error'
              ? 'error'
              : status === 'pending'
                ? 'warning'
                : 'offline'
        }
        pulse={status === 'pending'}
      />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-zinc-100">{provider.name}</div>
        <div className="truncate font-mono text-xs text-zinc-500">{provider.baseUrl}</div>
      </div>
      <span className="rounded border border-zinc-600 px-1.5 py-0.5 text-xs text-zinc-400">
        {provider.api}
      </span>
      <span className="text-xs text-zinc-500">
        {provider.modelCount} model{provider.modelCount !== 1 ? 's' : ''}
      </span>
      <button
        onClick={() => onTest(provider.name)}
        disabled={status === 'pending'}
        className="rounded-md bg-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-600 disabled:opacity-50"
        type="button"
      >
        {status === 'pending' ? 'Testing...' : 'Test'}
      </button>
    </div>
  );
}

function ModelProvidersSection({
  providers,
  endpointResults,
  onTest,
  isOpen,
  onToggle,
}: {
  providers: ParsedProvider[];
  endpointResults: Map<string, EndpointTestResult>;
  onTest: (name: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
        type="button"
      >
        <h3 className="text-sm font-medium text-zinc-100">Model Providers ({providers.length})</h3>
        <span className="text-xs text-zinc-500">{isOpen ? 'Collapse' : 'Expand'}</span>
      </button>

      {isOpen && (
        <div className="border-t border-zinc-700">
          {providers.length === 0 ? (
            <div className="p-3 text-xs text-zinc-500">
              No providers configured in models.providers
            </div>
          ) : (
            providers.map((p) => (
              <ProviderRow
                key={p.name}
                provider={p}
                testResult={endpointResults.get(p.name)}
                onTest={onTest}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ---- Model Routing Section ------------------------------------------------

interface RoutingRow {
  agentId: string;
  agentName: string;
  primaryModel: string;
  fallbacks: string[];
  provider: string;
  costTier: string;
}

function parseAgentRouting(rawConfig: string | null, agents: Agent[]): RoutingRow[] {
  if (!rawConfig) return [];

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawConfig) as Record<string, unknown>;
  } catch {
    return [];
  }

  const agentsConfig = parsed.agents as Record<string, unknown> | undefined;
  if (!agentsConfig) return [];

  // Try agents.list from config for per-agent model assignments
  const agentList = agentsConfig.list as
    | Array<{
        id?: string;
        model?: { primary?: string; fallbacks?: string[] };
      }>
    | undefined;

  if (!Array.isArray(agentList)) return [];

  // Build agent identity lookup from the agents store
  const agentMap = new Map(agents.map((a) => [a.id, a]));

  return agentList
    .filter((a) => a.id && a.model?.primary)
    .map((a) => {
      const agent = agentMap.get(a.id!);
      const emoji = agent?.identity?.emoji ?? '';
      const name = agent?.identity?.name ?? a.id!;
      const primary = a.model!.primary!;
      const fallbacks = a.model!.fallbacks ?? [];
      const provider = primary.includes('/') ? (primary.split('/')[0] ?? 'unknown') : 'unknown';
      const tierInfo = classifyModel(primary);

      return {
        agentId: a.id!,
        agentName: emoji ? `${emoji} ${name}` : name,
        primaryModel: primary,
        fallbacks,
        provider,
        costTier: tierInfo.label,
      };
    });
}

function ModelRoutingSection({
  routing,
  isOpen,
  onToggle,
}: {
  routing: RoutingRow[];
  isOpen: boolean;
  onToggle: () => void;
}) {
  const columns = useMemo<ColumnDef<RoutingRow>[]>(
    () => [
      {
        header: 'Demon',
        accessorKey: 'agentName',
      },
      {
        header: 'Primary Model',
        accessorKey: 'primaryModel',
        cell: ({ row }) => (
          <span className="font-mono text-xs text-zinc-300">{row.original.primaryModel}</span>
        ),
      },
      {
        header: 'Fallbacks',
        id: 'fallbacks',
        accessorFn: (row) => row.fallbacks.join(', '),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-zinc-500">
            {row.original.fallbacks.length > 0 ? row.original.fallbacks.join(', ') : '-'}
          </span>
        ),
      },
      {
        header: 'Provider',
        accessorKey: 'provider',
        cell: ({ row }) => <span className="text-xs text-zinc-400">{row.original.provider}</span>,
      },
      {
        header: 'Cost Tier',
        accessorKey: 'costTier',
        cell: ({ row }) => {
          const tierInfo = classifyModel(row.original.primaryModel);
          return <span className={tierBadgeClasses(tierInfo.tier)}>{row.original.costTier}</span>;
        },
      },
    ],
    []
  );

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
        type="button"
      >
        <h3 className="text-sm font-medium text-zinc-100">Model Routing ({routing.length})</h3>
        <span className="text-xs text-zinc-500">{isOpen ? 'Collapse' : 'Expand'}</span>
      </button>

      {isOpen && (
        <div className="border-t border-zinc-700">
          {routing.length === 0 ? (
            <div className="p-3 text-xs text-zinc-500">
              No per-agent model routing found in config
            </div>
          ) : (
            <DataTable columns={columns} data={routing} />
          )}
        </div>
      )}
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
    endpointResults,
    isLoading,
    isSaving,
    error,
    parsedProviders,
    loadConfig,
    loadSchema,
    saveConfig,
    testEndpoint,
  } = useConfigStore();

  const { status } = useConnectionStore();
  const { agents, loadAgents } = useAgentsStore();

  const [editorValue, setEditorValue] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showProviders, setShowProviders] = useState(true);
  const [showRouting, setShowRouting] = useState(true);
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Load config on mount
  useEffect(() => {
    if (status === 'connected') {
      loadConfig();
      loadSchema();
      loadAgents();
    }
  }, [status, loadConfig, loadSchema, loadAgents]);

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
      if (jsonError) setJsonError(null);
    },
    [rawConfig, jsonError]
  );

  const handleSaveClick = useCallback(() => {
    // Validate JSON before showing confirmation
    try {
      JSON.parse(editorValue);
      setJsonError(null);
    } catch (err) {
      const msg = err instanceof SyntaxError ? err.message : 'Invalid JSON';
      setJsonError(`JSON parse error: ${msg}`);
      return;
    }
    setShowConfirm(true);
  }, [editorValue]);

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

  const handleExportConfig = useCallback(async () => {
    try {
      const filePath = await saveDialog({
        title: 'Export Config',
        defaultPath: 'openclaw-config.json',
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (!filePath) return;
      await writeTextFile(filePath, editorValue);
      toast.success('Config exported');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      toast.error(msg);
    }
  }, [editorValue]);

  const handleImportConfig = useCallback(async () => {
    try {
      const filePath = await openDialog({
        title: 'Import Config',
        multiple: false,
        directory: false,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (!filePath) return;
      const content = await readTextFile(filePath);
      // Validate JSON before applying
      JSON.parse(content);
      setEditorValue(content);
      setHasUnsavedChanges(true);
      toast.success('Config imported — review and save to apply');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Import failed';
      toast.error(msg);
    }
  }, []);

  const providers = parsedProviders();
  const routing = useMemo(() => parseAgentRouting(rawConfig, agents), [rawConfig, agents]);
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
            onClick={handleImportConfig}
            className="rounded-md bg-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-600"
            type="button"
          >
            Import
          </button>

          <button
            onClick={handleExportConfig}
            className="rounded-md bg-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-600"
            type="button"
          >
            Export
          </button>

          <button
            onClick={() => loadConfig(true)}
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

      {/* JSON Validation Error Banner */}
      {jsonError && (
        <div className="border-b border-red-500/30 bg-red-500/10 px-3 py-2">
          <p className="font-mono text-xs text-red-400">{jsonError}</p>
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

        {/* Main Content Area */}
        <div className="flex flex-1 flex-col overflow-y-auto p-3">
          <div className="mb-3">
            <GatewaySettings />
          </div>

          {/* Model Providers Section */}
          <div className="mb-3 space-y-3">
            <ModelProvidersSection
              providers={providers}
              endpointResults={endpointResults}
              onTest={testEndpoint}
              isOpen={showProviders}
              onToggle={() => setShowProviders(!showProviders)}
            />

            <ModelRoutingSection
              routing={routing}
              isOpen={showRouting}
              onToggle={() => setShowRouting(!showRouting)}
            />
          </div>

          {/* Editor Area */}
          <h3 className="mb-2 text-sm font-medium text-zinc-100">Raw JSON Editor</h3>
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
