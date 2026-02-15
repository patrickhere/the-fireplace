// ---------------------------------------------------------------------------
// Exec Approvals View
// ---------------------------------------------------------------------------

import { useEffect, useState, useCallback } from 'react';
import { useApprovalsStore } from '@/stores/approvals';
import { useConnectionStore } from '@/stores/connection';
import type {
  ExecApprovalRequest,
  ExecApprovalPattern,
  ExecApprovalsFile,
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

// ---- Pattern Row ----------------------------------------------------------

function PatternRow({ pattern, onRemove }: { pattern: ExecApprovalPattern; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2">
      <div className={`h-2 w-2 rounded-full ${pattern.allow ? 'bg-emerald-500' : 'bg-red-500'}`} />
      <code className="flex-1 font-mono text-sm text-zinc-200">{pattern.pattern}</code>
      <span className="text-xs text-zinc-500">{pattern.allow ? 'allow' : 'deny'}</span>
      {pattern.note && (
        <span className="text-xs text-zinc-600" title={pattern.note}>
          ({pattern.note})
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

// ---- Add Pattern Form -----------------------------------------------------

function AddPatternForm({ onAdd }: { onAdd: (pattern: ExecApprovalPattern) => void }) {
  const [patternInput, setPatternInput] = useState('');
  const [allow, setAllow] = useState(true);
  const [note, setNote] = useState('');

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!patternInput.trim()) return;

      onAdd({
        pattern: patternInput.trim(),
        allow,
        note: note.trim() || undefined,
      });

      setPatternInput('');
      setNote('');
    },
    [patternInput, allow, note, onAdd]
  );

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2">
      <div className="flex-1">
        <label className="mb-1 block text-xs text-zinc-500">Pattern</label>
        <input
          type="text"
          value={patternInput}
          onChange={(e) => setPatternInput(e.target.value)}
          placeholder="e.g. ls *, cat *"
          className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 font-mono text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-amber-500"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-zinc-500">Action</label>
        <select
          value={allow ? 'allow' : 'deny'}
          onChange={(e) => setAllow(e.target.value === 'allow')}
          className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-amber-500"
        >
          <option value="allow">Allow</option>
          <option value="deny">Deny</option>
        </select>
      </div>
      <div className="w-36">
        <label className="mb-1 block text-xs text-zinc-500">Note</label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional"
          className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-amber-500"
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

// ---- Allowlist Section ----------------------------------------------------

function AllowlistSection({
  title,
  patterns,
  onUpdate,
}: {
  title: string;
  patterns: ExecApprovalPattern[];
  onUpdate: (patterns: ExecApprovalPattern[]) => void;
}) {
  const handleRemove = useCallback(
    (index: number) => {
      const updated = patterns.filter((_, i) => i !== index);
      onUpdate(updated);
    },
    [patterns, onUpdate]
  );

  const handleAdd = useCallback(
    (pattern: ExecApprovalPattern) => {
      onUpdate([...patterns, pattern]);
    },
    [patterns, onUpdate]
  );

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-zinc-300">{title}</h3>
      {patterns.length === 0 ? (
        <p className="text-xs text-zinc-600">No patterns configured.</p>
      ) : (
        <div className="space-y-1">
          {patterns.map((pattern, index) => (
            <PatternRow
              key={`${pattern.pattern}-${index}`}
              pattern={pattern}
              onRemove={() => handleRemove(index)}
            />
          ))}
        </div>
      )}
      <AddPatternForm onAdd={handleAdd} />
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
    (patterns: ExecApprovalPattern[]) => {
      if (!localFile) return;
      setLocalFile({ ...localFile, defaults: patterns });
      setIsDirty(true);
    },
    [localFile]
  );

  const handleUpdateAgentPatterns = useCallback(
    (agentId: string, patterns: ExecApprovalPattern[]) => {
      if (!localFile) return;
      const agents = { ...localFile.agents, [agentId]: patterns };
      // Remove agent key if patterns are empty
      if (patterns.length === 0) {
        delete agents[agentId];
      }
      setLocalFile({ ...localFile, agents });
      setIsDirty(true);
    },
    [localFile]
  );

  const [newAgentId, setNewAgentId] = useState('');

  const handleAddAgent = useCallback(() => {
    if (!localFile || !newAgentId.trim()) return;
    if (localFile.agents[newAgentId.trim()]) return;
    setLocalFile({
      ...localFile,
      agents: { ...localFile.agents, [newAgentId.trim()]: [] },
    });
    setNewAgentId('');
    setIsDirty(true);
  }, [localFile, newAgentId]);

  const handleSave = useCallback(async () => {
    if (!localFile) return;
    setIsSaving(true);
    await saveApprovals(localFile);
    setIsSaving(false);
    setIsDirty(false);
  }, [localFile, saveApprovals]);

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
              {isSaving ? 'Saving...' : 'Save Allowlist'}
            </button>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="border-b border-red-500/20 bg-red-500/10 px-3 py-2">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {isLoading && !snapshot ? (
          <div className="text-sm text-zinc-400">Loading approvals...</div>
        ) : (
          <div className="space-y-6">
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

            {/* Allowlist Management Section */}
            <section>
              <h2 className="mb-3 text-sm font-semibold tracking-wider text-zinc-500 uppercase">
                Allowlist Management
              </h2>

              {!localFile ? (
                <div className="rounded-lg border border-zinc-700/50 bg-zinc-900/50 p-4 text-center">
                  <p className="text-sm text-zinc-500">
                    {snapshot?.exists === false
                      ? 'No approvals file exists yet. Add patterns below to create one.'
                      : 'Loading allowlist...'}
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

                  {/* Default Patterns */}
                  <AllowlistSection
                    title="Default Patterns (all agents)"
                    patterns={localFile.defaults}
                    onUpdate={handleUpdateDefaults}
                  />

                  {/* Per-Agent Overrides */}
                  {Object.entries(localFile.agents).map(([agentId, patterns]) => (
                    <AllowlistSection
                      key={agentId}
                      title={`Agent: ${agentId}`}
                      patterns={patterns}
                      onUpdate={(p) => handleUpdateAgentPatterns(agentId, p)}
                    />
                  ))}

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
