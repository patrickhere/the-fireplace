// ---------------------------------------------------------------------------
// Exec Approvals View
// ---------------------------------------------------------------------------

import { useEffect, useState, useCallback } from 'react';
import { useApprovalsStore } from '@/stores/approvals';
import { useConnectionStore } from '@/stores/connection';
import { useAgentsStore } from '@/stores/agents';
import { LoadingSpinner, ErrorState } from '@/components/StateIndicators';
import type {
  ExecApprovalRequest,
  ExecApprovalsFile,
  ExecApprovalsDefaults,
  ExecApprovalsAgent,
  ExecApprovalsAllowlistEntry,
} from '@/stores/approvals';

// ---- Time Formatting Helper -----------------------------------------------

function formatTimeAgo(ms: number): string {
  const seconds = Math.floor((Date.now() - ms) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

// ---- CLI Backend Helpers --------------------------------------------------

function isCliBackendCommand(command: string): boolean {
  return command.startsWith('claude ') || command.startsWith('codex ');
}

function getBackendName(command: string): string {
  if (command.startsWith('claude ')) return 'Claude Code';
  if (command.startsWith('codex ')) return 'Codex';
  return 'Unknown';
}

function formatElapsed(receivedAt: number): string {
  const seconds = Math.floor((Date.now() - receivedAt) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

// ---- CLI Backend Card ----------------------------------------------------

function CliBackendCard({
  request,
  agentName,
  agentEmoji,
}: {
  request: ExecApprovalRequest;
  agentName: string;
  agentEmoji: string;
}) {
  const backendName = getBackendName(request.command);
  const truncatedCommand =
    request.command.length > 80 ? request.command.slice(0, 80) + '…' : request.command;
  const [elapsed, setElapsed] = useState(() => formatElapsed(request.receivedAt));

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(formatElapsed(request.receivedAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [request.receivedAt]);

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">{agentEmoji}</span>
          <span className="text-sm font-medium text-zinc-200">{agentName}</span>
          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-500">
            {backendName}
          </span>
        </div>
        <span className="text-xs text-zinc-500">{elapsed}</span>
      </div>
      <div className="rounded-md bg-zinc-900 p-2">
        <code className="font-mono text-xs break-all text-zinc-300">{truncatedCommand}</code>
      </div>
    </div>
  );
}

// ---- Pending Approval Card ------------------------------------------------

function ApprovalCard({
  request,
  onApprove,
  onDeny,
}: {
  request: ExecApprovalRequest;
  onApprove: (id: string) => void;
  onDeny: (id: string) => void;
}) {
  const [isResolving, setIsResolving] = useState(false);

  const handleApprove = useCallback(async () => {
    if (!request.id) return;
    setIsResolving(true);
    onApprove(request.id);
  }, [request.id, onApprove]);

  const handleDeny = useCallback(async () => {
    if (!request.id) return;
    setIsResolving(true);
    onDeny(request.id);
  }, [request.id, onDeny]);

  const hasTimeout = request.timeoutMs !== undefined && request.timeoutMs > 0;

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
      <div className="mb-2 flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
            <span className="text-xs text-amber-400">
              {formatTimeAgo(request.receivedAt)}
              {hasTimeout && (
                <span className="ml-2 text-zinc-500">
                  timeout: {Math.round((request.timeoutMs ?? 0) / 1000)}s
                </span>
              )}
            </span>
          </div>
          {request.agentId && (
            <span className="mt-1 inline-block rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-400">
              agent: {request.agentId}
            </span>
          )}
        </div>
      </div>

      {/* Command */}
      <div className="mb-2 rounded-md bg-zinc-900 p-2">
        <code className="font-mono text-sm break-all text-zinc-100">{request.command}</code>
      </div>

      {/* Metadata */}
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
        {request.cwd && (
          <span>
            <span className="text-zinc-600">cwd:</span> {request.cwd}
          </span>
        )}
        {request.host && (
          <span>
            <span className="text-zinc-600">host:</span> {request.host}
          </span>
        )}
        {request.security && (
          <span>
            <span className="text-zinc-600">security:</span>{' '}
            <span className={request.security === 'high' ? 'text-red-400' : ''}>
              {request.security}
            </span>
          </span>
        )}
        {request.sessionKey && (
          <span>
            <span className="text-zinc-600">session:</span> {request.sessionKey}
          </span>
        )}
      </div>

      {/* Ask reason */}
      {request.ask && (
        <div className="mb-3 rounded-md bg-zinc-800/50 p-2 text-xs text-zinc-400">
          {request.ask}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleApprove}
          disabled={isResolving || !request.id}
          className="flex-1 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          type="button"
        >
          Approve
        </button>
        <button
          onClick={handleDeny}
          disabled={isResolving || !request.id}
          className="flex-1 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
          type="button"
        >
          Reject
        </button>
      </div>
    </div>
  );
}

// ---- Allowlist Entry Row --------------------------------------------------

function AllowlistEntryRow({
  entry,
  onRemove,
}: {
  entry: ExecApprovalsAllowlistEntry;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2">
      <code className="flex-1 font-mono text-sm text-zinc-200">{entry.pattern}</code>
      {entry.lastUsedAt && (
        <span className="text-xs text-zinc-500" title={new Date(entry.lastUsedAt).toLocaleString()}>
          used {formatTimeAgo(entry.lastUsedAt)}
        </span>
      )}
      {entry.lastUsedCommand && (
        <span className="max-w-xs truncate text-xs text-zinc-600" title={entry.lastUsedCommand}>
          "{entry.lastUsedCommand}"
        </span>
      )}
      <button
        onClick={onRemove}
        className="rounded px-1.5 py-0.5 text-xs text-red-400 hover:bg-red-500/10"
        type="button"
      >
        Remove
      </button>
    </div>
  );
}

// ---- Add Allowlist Entry Form ---------------------------------------------

function AddAllowlistEntryForm({ onAdd }: { onAdd: (pattern: string) => void }) {
  const [patternInput, setPatternInput] = useState('');

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!patternInput.trim()) return;
      onAdd(patternInput.trim());
      setPatternInput('');
    },
    [patternInput, onAdd]
  );

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2">
      <div className="flex-1">
        <label className="mb-1 block text-xs text-zinc-500">Pattern</label>
        <input
          type="text"
          value={patternInput}
          onChange={(e) => setPatternInput(e.target.value)}
          placeholder="e.g. ls *, cat *, git status"
          className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 font-mono text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-amber-500"
        />
      </div>
      <button
        type="submit"
        disabled={!patternInput.trim()}
        className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
      >
        Add
      </button>
    </form>
  );
}

// ---- Config Section -------------------------------------------------------

function ConfigSection({
  title,
  config,
  onUpdate,
}: {
  title: string;
  config: ExecApprovalsDefaults | ExecApprovalsAgent;
  onUpdate: (updated: ExecApprovalsDefaults | ExecApprovalsAgent) => void;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-zinc-300">{title}</h3>

      <div className="grid gap-3 lg:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-zinc-500">Security Level</label>
          <select
            value={config.security ?? ''}
            onChange={(e) => onUpdate({ ...config, security: e.target.value || undefined })}
            className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-amber-500"
          >
            <option value="">Default</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        <div>
          <label className="mb-1 flex items-center gap-2 text-xs text-zinc-500">
            <input
              type="checkbox"
              checked={config.autoAllowSkills ?? false}
              onChange={(e) =>
                onUpdate({ ...config, autoAllowSkills: e.target.checked || undefined })
              }
              className="rounded border-zinc-700 bg-zinc-800 text-amber-500 focus:ring-amber-500"
            />
            Auto-allow skills
          </label>
          <p className="mt-1 text-xs text-zinc-600">
            Automatically approve commands from skill invocations
          </p>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs text-zinc-500">Ask Prompt</label>
        <input
          type="text"
          value={config.ask ?? ''}
          onChange={(e) => onUpdate({ ...config, ask: e.target.value || undefined })}
          placeholder="Custom prompt to show in approval requests"
          className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-amber-500"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-zinc-500">Ask Fallback</label>
        <input
          type="text"
          value={config.askFallback ?? ''}
          onChange={(e) => onUpdate({ ...config, askFallback: e.target.value || undefined })}
          placeholder="Fallback prompt if main ask is not set"
          className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-amber-500"
        />
      </div>
    </div>
  );
}

// ---- Agent Override Section -----------------------------------------------

function AgentOverrideSection({
  agentId,
  config,
  onUpdate,
  onDelete,
}: {
  agentId: string;
  config: ExecApprovalsAgent;
  onUpdate: (updated: ExecApprovalsAgent) => void;
  onDelete: () => void;
}) {
  const handleAddAllowlistEntry = useCallback(
    (pattern: string) => {
      const allowlist = config.allowlist ?? [];
      onUpdate({ ...config, allowlist: [...allowlist, { pattern }] });
    },
    [config, onUpdate]
  );

  const handleRemoveAllowlistEntry = useCallback(
    (index: number) => {
      const allowlist = config.allowlist ?? [];
      onUpdate({ ...config, allowlist: allowlist.filter((_, i) => i !== index) });
    },
    [config, onUpdate]
  );

  return (
    <div className="space-y-4 rounded-lg border border-zinc-700 bg-zinc-900/50 p-4">
      <div className="flex items-center justify-between">
        <h4 className="font-mono text-sm font-medium text-amber-400">Agent: {agentId}</h4>
        <button
          onClick={onDelete}
          className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
          type="button"
        >
          Delete Override
        </button>
      </div>

      <ConfigSection title="Agent Settings" config={config} onUpdate={onUpdate} />

      <div className="space-y-2 border-t border-zinc-800 pt-4">
        <h5 className="text-sm font-medium text-zinc-300">Allowlist</h5>
        {config.allowlist && config.allowlist.length > 0 ? (
          <div className="space-y-1">
            {config.allowlist.map((entry, index) => (
              <AllowlistEntryRow
                key={entry.id ?? `${entry.pattern}-${index}`}
                entry={entry}
                onRemove={() => handleRemoveAllowlistEntry(index)}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-zinc-600">No allowlist entries configured.</p>
        )}
        <AddAllowlistEntryForm onAdd={handleAddAllowlistEntry} />
      </div>
    </div>
  );
}

// ---- Main Approvals View --------------------------------------------------

export function Approvals() {
  const {
    snapshot,
    pendingRequests,
    isLoading,
    error,
    loadApprovals,
    saveApprovals,
    resolveApproval,
    subscribeToEvents,
    unsubscribeFromEvents,
  } = useApprovalsStore();

  const { status } = useConnectionStore();
  const { agents } = useAgentsStore();

  const [localFile, setLocalFile] = useState<ExecApprovalsFile | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load on mount
  useEffect(() => {
    if (status === 'connected') {
      loadApprovals();
      subscribeToEvents();
    }

    return () => {
      unsubscribeFromEvents();
    };
  }, [status, loadApprovals, subscribeToEvents, unsubscribeFromEvents]);

  // Sync snapshot file into local state
  useEffect(() => {
    if (snapshot?.file) {
      setLocalFile(snapshot.file);
      setIsDirty(false);
    }
  }, [snapshot]);

  const handleApprove = useCallback(
    (id: string) => {
      resolveApproval(id, 'approve');
    },
    [resolveApproval]
  );

  const handleDeny = useCallback(
    (id: string) => {
      resolveApproval(id, 'deny');
    },
    [resolveApproval]
  );

  const handleUpdateDefaults = useCallback(
    (defaults: ExecApprovalsDefaults) => {
      if (!localFile) return;
      setLocalFile({ ...localFile, defaults });
      setIsDirty(true);
    },
    [localFile]
  );

  const handleUpdateAgent = useCallback(
    (agentId: string, agentConfig: ExecApprovalsAgent) => {
      if (!localFile) return;
      const agents = { ...localFile.agents, [agentId]: agentConfig };
      setLocalFile({ ...localFile, agents });
      setIsDirty(true);
    },
    [localFile]
  );

  const handleDeleteAgent = useCallback(
    (agentId: string) => {
      if (!localFile || !localFile.agents) return;
      const agents = { ...localFile.agents };
      delete agents[agentId];
      setLocalFile({ ...localFile, agents });
      setIsDirty(true);
    },
    [localFile]
  );

  const [newAgentId, setNewAgentId] = useState('');

  const handleAddAgent = useCallback(() => {
    if (!localFile || !newAgentId.trim()) return;
    const agents = localFile.agents ?? {};
    if (agents[newAgentId.trim()]) return;
    setLocalFile({
      ...localFile,
      agents: { ...agents, [newAgentId.trim()]: {} },
    });
    setNewAgentId('');
    setIsDirty(true);
  }, [localFile, newAgentId]);

  const handleSave = useCallback(async () => {
    if (!localFile) return;
    setIsSaving(true);
    try {
      await saveApprovals(localFile, snapshot?.hash);
      setIsDirty(false);
    } finally {
      setIsSaving(false);
    }
  }, [localFile, snapshot?.hash, saveApprovals]);

  // CLI backend requests: pending exec approvals where command starts with "claude " or "codex "
  const cliBackendRequests = pendingRequests.filter(
    (r) => r.command && isCliBackendCommand(r.command)
  );

  const handleQuickAllow = useCallback(
    (pattern: string) => {
      if (!localFile) return;
      const agents = localFile.agents ?? {};
      // Add pattern to all existing agents' allowlists, and create a __defaults__ agent
      // if no agents exist yet, so the pattern applies globally
      const agentId = '__defaults__';
      const existing = agents[agentId] ?? {};
      const allowlist = existing.allowlist ?? [];
      const alreadyExists = allowlist.some((e) => e.pattern === pattern);
      if (alreadyExists) return;
      setLocalFile({
        ...localFile,
        agents: {
          ...agents,
          [agentId]: {
            ...existing,
            allowlist: [...allowlist, { pattern }],
          },
        },
      });
      setIsDirty(true);
    },
    [localFile]
  );

  const getAgentInfo = useCallback(
    (agentId?: string) => {
      if (!agentId) return { name: 'Unknown Agent', emoji: '[bot]' };
      const agent = agents.find((a) => a.id === agentId);
      if (!agent) return { name: agentId, emoji: '[bot]' };
      return {
        name: agent.identity?.name ?? agent.name ?? agentId,
        emoji: agent.identity?.emoji ?? '[bot]',
      };
    },
    [agents]
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-700 p-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">Exec Approvals</h1>
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span>Command approval requests and allowlists</span>
            {pendingRequests.length > 0 && (
              <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-400">
                {pendingRequests.length} pending
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadApprovals()}
            disabled={isLoading}
            className="rounded-md bg-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-600 disabled:opacity-50"
            type="button"
          >
            Reload
          </button>
          {isDirty && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-md bg-amber-500 px-4 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
              type="button"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {error && !snapshot ? (
          <ErrorState message={error} onRetry={loadApprovals} />
        ) : isLoading && !snapshot ? (
          <LoadingSpinner message="Loading approvals..." />
        ) : (
          <div className="space-y-6">
            {/* CLI Backends Section */}
            {cliBackendRequests.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-semibold tracking-wider text-zinc-500 uppercase">
                  CLI Backends
                </h2>
                <div className="grid gap-3 lg:grid-cols-2">
                  {cliBackendRequests.map((req, index) => {
                    const { name, emoji } = getAgentInfo(req.agentId);
                    return (
                      <CliBackendCard
                        key={req.id ?? `cli-${index}`}
                        request={req}
                        agentName={name}
                        agentEmoji={emoji}
                      />
                    );
                  })}
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleQuickAllow('claude --print *')}
                    className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
                    type="button"
                  >
                    Allow <code className="font-mono text-amber-400">claude --print *</code>
                  </button>
                  <button
                    onClick={() => handleQuickAllow('codex --print *')}
                    className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
                    type="button"
                  >
                    Allow <code className="font-mono text-amber-400">codex --print *</code>
                  </button>
                </div>
              </section>
            )}

            {/* Pending Approvals Section */}
            <section>
              <h2 className="mb-3 text-sm font-semibold tracking-wider text-zinc-500 uppercase">
                Pending Approvals
              </h2>
              {pendingRequests.length === 0 ? (
                <div className="rounded-lg border border-zinc-700/50 bg-zinc-900/50 p-4 text-center">
                  <p className="text-sm text-zinc-500">No pending approval requests.</p>
                  <p className="mt-1 text-xs text-zinc-600">
                    Approval requests will appear here in real-time when agents request exec
                    permissions.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {pendingRequests.map((req, index) => (
                    <ApprovalCard
                      key={req.id ?? `pending-${index}`}
                      request={req}
                      onApprove={handleApprove}
                      onDeny={handleDeny}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Configuration Section */}
            <section>
              <h2 className="mb-3 text-sm font-semibold tracking-wider text-zinc-500 uppercase">
                Configuration
              </h2>

              {!localFile ? (
                <div className="rounded-lg border border-zinc-700/50 bg-zinc-900/50 p-4 text-center">
                  <p className="text-sm text-zinc-500">
                    {snapshot?.exists === false
                      ? 'No approvals file exists yet. Configure settings below to create one.'
                      : 'Loading configuration...'}
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* File Info */}
                  {snapshot && (
                    <div className="flex items-center gap-3 text-xs text-zinc-600">
                      <span>
                        <span className="text-zinc-500">path:</span> {snapshot.path}
                      </span>
                      <span>
                        <span className="text-zinc-500">hash:</span> {snapshot.hash.slice(0, 12)}...
                      </span>
                      <span>
                        <span className="text-zinc-500">version:</span> {localFile.version}
                      </span>
                    </div>
                  )}

                  {/* Default Settings */}
                  <div className="rounded-lg border border-zinc-700 bg-zinc-900/50 p-4">
                    <ConfigSection
                      title="Default Settings (all agents)"
                      config={localFile.defaults ?? {}}
                      onUpdate={handleUpdateDefaults}
                    />
                  </div>

                  {/* Agent Overrides */}
                  {localFile.agents && Object.entries(localFile.agents).length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-zinc-300">Agent Overrides</h3>
                      {Object.entries(localFile.agents).map(([agentId, agentConfig]) => (
                        <AgentOverrideSection
                          key={agentId}
                          agentId={agentId}
                          config={agentConfig}
                          onUpdate={(updated) => handleUpdateAgent(agentId, updated)}
                          onDelete={() => handleDeleteAgent(agentId)}
                        />
                      ))}
                    </div>
                  )}

                  {/* Add Agent Override */}
                  <div className="flex items-end gap-2 border-t border-zinc-800 pt-3">
                    <div className="flex-1">
                      <label className="mb-1 block text-xs text-zinc-500">Add agent override</label>
                      <input
                        type="text"
                        value={newAgentId}
                        onChange={(e) => setNewAgentId(e.target.value)}
                        placeholder="Agent ID"
                        className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-amber-500"
                      />
                    </div>
                    <button
                      onClick={handleAddAgent}
                      disabled={!newAgentId.trim()}
                      className="rounded-md bg-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-600 disabled:opacity-50"
                      type="button"
                    >
                      Add Agent
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
