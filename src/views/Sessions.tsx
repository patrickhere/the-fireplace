// ---------------------------------------------------------------------------
// Sessions View
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { useSessionsStore, type SessionListItem, type SessionConfig } from '@/stores/sessions';
import { useConnectionStore } from '@/stores/connection';
import { useModelsStore } from '@/stores/models';
import { useIsMobile } from '@/hooks/usePlatform';
import { SessionReplay } from '@/components/SessionReplay';
import { LoadingSpinner, EmptyState, ErrorState } from '@/components/StateIndicators';
import { formatSessionKey } from '@/lib/utils';

// ---- Session Preview Modal ------------------------------------------------

function SessionPreviewModal() {
  const { selectedSession, showPreviewModal, setShowPreviewModal } = useSessionsStore();

  if (!showPreviewModal || !selectedSession) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-700 p-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Session Preview</h2>
            <p className="text-sm text-zinc-400">{selectedSession.key}</p>
          </div>
          <button
            onClick={() => setShowPreviewModal(false)}
            className="text-zinc-400 hover:text-zinc-100"
            type="button"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Messages */}
        <div className="space-y-3 overflow-y-auto p-4" style={{ maxHeight: 'calc(90vh - 100px)' }}>
          {selectedSession.messages.map((msg, idx) => (
            <div
              key={idx}
              className={`rounded-lg p-3 ${
                msg.role === 'user'
                  ? 'border border-amber-500/20 bg-amber-500/10'
                  : 'border border-zinc-700 bg-zinc-800'
              }`}
            >
              <div className="mb-1 text-xs font-semibold text-zinc-400 uppercase">{msg.role}</div>
              <div className="text-sm whitespace-pre-wrap text-zinc-100">{msg.content}</div>
              {msg.timestamp && (
                <div className="mt-2 text-xs text-zinc-500">
                  {new Date(msg.timestamp).toLocaleString()}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- Session Config Modal -------------------------------------------------

function SessionConfigModal() {
  const { showConfigModal, setShowConfigModal, patchSession, sessions } = useSessionsStore();
  const { models, loadModels } = useModelsStore();
  const { status } = useConnectionStore();
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [config, setConfig] = useState<Partial<SessionConfig>>({});

  useEffect(() => {
    if (showConfigModal && sessions.length > 0 && !selectedKey) {
      setSelectedKey(sessions[0]?.key || '');
    }
  }, [showConfigModal, sessions, selectedKey]);

  useEffect(() => {
    if (showConfigModal && status === 'connected' && models.length === 0) {
      loadModels();
    }
  }, [showConfigModal, status, models.length, loadModels]);

  if (!showConfigModal) return null;

  const handleSave = async () => {
    if (!selectedKey) return;
    await patchSession(selectedKey, config);
    setShowConfigModal(false);
    setConfig({});
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-700 p-4">
          <h2 className="text-lg font-semibold text-zinc-100">Edit Session Config</h2>
          <button
            onClick={() => setShowConfigModal(false)}
            className="text-zinc-400 hover:text-zinc-100"
            type="button"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4 p-4">
          {/* Session Selector */}
          <div>
            <label htmlFor="session-select" className="mb-1 block text-xs text-zinc-400">
              Session
            </label>
            <select
              id="session-select"
              value={selectedKey}
              onChange={(e) => setSelectedKey(e.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 focus:outline-none"
            >
              {sessions.map((session) => (
                <option key={session.key} value={session.key}>
                  {session.derivedTitle || formatSessionKey(session.key, session.label)}
                </option>
              ))}
            </select>
          </div>

          {/* Label */}
          <div>
            <label htmlFor="label" className="mb-1 block text-xs text-zinc-400">
              Label
            </label>
            <input
              id="label"
              type="text"
              value={config.label || ''}
              onChange={(e) => setConfig({ ...config, label: e.target.value })}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 focus:outline-none"
              placeholder="Optional label"
            />
          </div>

          {/* Model */}
          <div>
            <label htmlFor="model" className="mb-1 block text-xs text-zinc-400">
              Model
            </label>
            <select
              id="model"
              value={config.model || ''}
              onChange={(e) => setConfig({ ...config, model: e.target.value })}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 focus:outline-none"
            >
              <option value="">Default</option>
              {models.map((m) => (
                <option key={`${m.provider}/${m.id}`} value={`${m.provider}/${m.id}`}>
                  {m.name} ({m.provider})
                </option>
              ))}
            </select>
          </div>

          {/* Thinking Level */}
          <div>
            <label htmlFor="thinking-level" className="mb-1 block text-xs text-zinc-400">
              Thinking Level
            </label>
            <select
              id="thinking-level"
              value={config.thinkingLevel || ''}
              onChange={(e) => setConfig({ ...config, thinkingLevel: e.target.value })}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 focus:outline-none"
            >
              <option value="">Default</option>
              <option value="none">None</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          {/* Send Policy */}
          <div>
            <label htmlFor="send-policy" className="mb-1 block text-xs text-zinc-400">
              Send Policy
            </label>
            <select
              id="send-policy"
              value={config.sendPolicy || ''}
              onChange={(e) =>
                setConfig({
                  ...config,
                  sendPolicy: (e.target.value || null) as 'allow' | 'deny' | null,
                })
              }
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 focus:outline-none"
            >
              <option value="">Default</option>
              <option value="allow">Allow</option>
              <option value="deny">Deny</option>
            </select>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 border-t border-zinc-700 p-4">
          <button
            onClick={() => setShowConfigModal(false)}
            className="rounded-md bg-zinc-800 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
            type="button"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="rounded-md bg-amber-500 px-4 py-2 text-sm text-zinc-950 hover:bg-amber-400"
            type="button"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Session Usage Modal --------------------------------------------------

function SessionUsageModal() {
  const { usageStats, showUsageModal, setShowUsageModal } = useSessionsStore();

  if (!showUsageModal || !usageStats) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-700 p-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Token Usage</h2>
            <p className="text-sm text-zinc-400">
              Total: {usageStats.totalTokens.toLocaleString()} tokens
            </p>
          </div>
          <button
            onClick={() => setShowUsageModal(false)}
            className="text-zinc-400 hover:text-zinc-100"
            type="button"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Stats */}
        <div className="space-y-3 overflow-y-auto p-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-3">
              <div className="text-xs text-zinc-400">Total Tokens</div>
              <div className="text-lg font-semibold text-zinc-100">
                {usageStats.totalTokens.toLocaleString()}
              </div>
            </div>
            <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-3">
              <div className="text-xs text-zinc-400">Input Tokens</div>
              <div className="text-lg font-semibold text-zinc-100">
                {usageStats.totalInputTokens.toLocaleString()}
              </div>
            </div>
            <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-3">
              <div className="text-xs text-zinc-400">Output Tokens</div>
              <div className="text-lg font-semibold text-zinc-100">
                {usageStats.totalOutputTokens.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Per Session */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-zinc-100">Sessions</h3>
            {usageStats.sessions.map((session, idx) => (
              <div key={idx} className="rounded-lg border border-zinc-700 bg-zinc-800 p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-100">
                    {formatSessionKey(session.key)}
                  </span>
                  <span className="text-xs text-zinc-400">{session.model || 'default'}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-zinc-400">Total:</span>{' '}
                    <span className="text-zinc-100">{session.totalTokens.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400">In:</span>{' '}
                    <span className="text-zinc-100">{session.inputTokens.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400">Out:</span>{' '}
                    <span className="text-zinc-100">{session.outputTokens.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Session Row (Desktop) ------------------------------------------------

function SessionRow({
  session,
  onReplay,
}: {
  session: SessionListItem;
  onReplay: (key: string) => void;
}) {
  const { previewSession, resetSession, deleteSession, compactSession } = useSessionsStore();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = async (deleteTranscript: boolean) => {
    await deleteSession(session.key, deleteTranscript);
    setShowDeleteConfirm(false);
  };

  return (
    <>
      <tr className="border-b border-zinc-700 hover:bg-zinc-800/50">
        <td className="p-3 text-sm text-zinc-100">
          {session.derivedTitle || formatSessionKey(session.key, session.label)}
        </td>
        <td className="p-3 text-sm text-zinc-400">{session.model || 'default'}</td>
        <td className="p-3 text-sm text-zinc-400">{session.messageCount || 0}</td>
        <td className="p-3 text-sm text-zinc-400">
          {session.lastActive ? new Date(session.lastActive).toLocaleDateString() : 'Never'}
        </td>
        <td className="p-3">
          <div className="flex gap-2">
            <button
              onClick={() => onReplay(session.key)}
              className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
              type="button"
              title="Replay session"
            >
              ▶
            </button>
            <button
              onClick={() => previewSession(session.key)}
              className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
              type="button"
            >
              Preview
            </button>
            <button
              onClick={() => resetSession(session.key)}
              className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
              type="button"
            >
              Reset
            </button>
            <button
              onClick={() => compactSession(session.key)}
              className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
              type="button"
            >
              Compact
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded-md bg-red-500/10 px-2 py-1 text-xs text-red-400 hover:bg-red-500/20"
              type="button"
            >
              Delete
            </button>
          </div>
        </td>
      </tr>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <tr>
          <td colSpan={5} className="bg-red-500/5 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-red-400">
                Delete session "
                {session.derivedTitle || formatSessionKey(session.key, session.label)}"?
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDelete(false)}
                  className="rounded-md bg-red-500/10 px-3 py-1 text-xs text-red-400 hover:bg-red-500/20"
                  type="button"
                >
                  Keep Transcript
                </button>
                <button
                  onClick={() => handleDelete(true)}
                  className="rounded-md bg-red-500 px-3 py-1 text-xs text-zinc-950 hover:bg-red-400"
                  type="button"
                >
                  Delete All
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="rounded-md bg-zinc-800 px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ---- Session Card (Mobile) ------------------------------------------------

function SessionCard({
  session,
  onReplay,
}: {
  session: SessionListItem;
  onReplay: (key: string) => void;
}) {
  const { previewSession, resetSession, deleteSession, compactSession } = useSessionsStore();
  const [showActions, setShowActions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = async (deleteTranscript: boolean) => {
    await deleteSession(session.key, deleteTranscript);
    setShowDeleteConfirm(false);
  };

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-100">
          {session.derivedTitle || formatSessionKey(session.key, session.label)}
        </h3>
        <button
          onClick={() => setShowActions(!showActions)}
          className="text-zinc-400 hover:text-zinc-100"
          type="button"
        >
          •••
        </button>
      </div>

      <div className="space-y-1 text-xs text-zinc-400">
        <div>Model: {session.model || 'default'}</div>
        <div>Messages: {session.messageCount || 0}</div>
        <div>
          Last Active:{' '}
          {session.lastActive ? new Date(session.lastActive).toLocaleDateString() : 'Never'}
        </div>
      </div>

      {showActions && !showDeleteConfirm && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => onReplay(session.key)}
            className="rounded-md bg-zinc-800 px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
            type="button"
          >
            ▶ Replay
          </button>
          <button
            onClick={() => previewSession(session.key)}
            className="rounded-md bg-zinc-800 px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
            type="button"
          >
            Preview
          </button>
          <button
            onClick={() => resetSession(session.key)}
            className="rounded-md bg-zinc-800 px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
            type="button"
          >
            Reset
          </button>
          <button
            onClick={() => compactSession(session.key)}
            className="rounded-md bg-zinc-800 px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
            type="button"
          >
            Compact
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="rounded-md bg-red-500/10 px-3 py-1 text-xs text-red-400 hover:bg-red-500/20"
            type="button"
          >
            Delete
          </button>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="mt-3 rounded-md bg-red-500/5 p-2">
          <p className="mb-2 text-xs text-red-400">Delete this session?</p>
          <div className="flex gap-2">
            <button
              onClick={() => handleDelete(false)}
              className="flex-1 rounded-md bg-red-500/10 px-3 py-1 text-xs text-red-400 hover:bg-red-500/20"
              type="button"
            >
              Keep Transcript
            </button>
            <button
              onClick={() => handleDelete(true)}
              className="flex-1 rounded-md bg-red-500 px-3 py-1 text-xs text-zinc-950 hover:bg-red-400"
              type="button"
            >
              Delete All
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 rounded-md bg-zinc-800 px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Main Sessions View ---------------------------------------------------

export function Sessions() {
  const {
    sessions,
    searchQuery,
    activeFilter,
    isLoading,
    error,
    setSearchQuery,
    setFilter,
    setShowConfigModal,
    loadSessions,
    loadUsage,
    subscribeToEvents,
    unsubscribeFromEvents,
  } = useSessionsStore();

  const { status } = useConnectionStore();
  const isMobile = useIsMobile();
  const [replaySessionKey, setReplaySessionKey] = useState<string | null>(null);

  // Load sessions on mount and subscribe to events
  useEffect(() => {
    if (status === 'connected') {
      loadSessions();
      subscribeToEvents();
    }

    return () => {
      unsubscribeFromEvents();
    };
  }, [status, loadSessions, subscribeToEvents, unsubscribeFromEvents]);

  // Filter sessions
  const filteredSessions = sessions.filter((session) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesKey = session.key.toLowerCase().includes(query);
      const matchesLabel = session.label?.toLowerCase().includes(query);
      const matchesTitle = session.derivedTitle?.toLowerCase().includes(query);
      if (!matchesKey && !matchesLabel && !matchesTitle) return false;
    }

    // Active filter
    if (activeFilter === 'recent') {
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      if (!session.lastActive || session.lastActive < oneDayAgo) return false;
    } else if (activeFilter === 'labeled') {
      if (!session.label) return false;
    }

    return true;
  });

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-zinc-700 p-4">
        <h1 className="text-lg font-semibold text-zinc-100">Sessions</h1>
        <p className="text-sm text-zinc-400">Manage chat sessions</p>

        {/* Search and Filters */}
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sessions..."
            className="min-w-[200px] flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 focus:outline-none"
          />

          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`rounded-md px-3 py-2 text-sm ${
                activeFilter === 'all'
                  ? 'bg-amber-500 text-zinc-950'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100'
              }`}
              type="button"
            >
              All
            </button>
            <button
              onClick={() => setFilter('recent')}
              className={`rounded-md px-3 py-2 text-sm ${
                activeFilter === 'recent'
                  ? 'bg-amber-500 text-zinc-950'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100'
              }`}
              type="button"
            >
              Recent
            </button>
            <button
              onClick={() => setFilter('labeled')}
              className={`rounded-md px-3 py-2 text-sm ${
                activeFilter === 'labeled'
                  ? 'bg-amber-500 text-zinc-950'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100'
              }`}
              type="button"
            >
              Labeled
            </button>
          </div>

          <button
            onClick={() => setShowConfigModal(true)}
            className="rounded-md bg-amber-500 px-3 py-2 text-sm text-zinc-950 hover:bg-amber-400"
            type="button"
          >
            Edit Config
          </button>

          <button
            onClick={() => loadUsage()}
            className="rounded-md bg-zinc-800 px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
            type="button"
          >
            Usage Stats
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {error && !isLoading ? (
          <ErrorState message={error} onRetry={loadSessions} />
        ) : isLoading && sessions.length === 0 ? (
          <LoadingSpinner message="Loading sessions..." />
        ) : filteredSessions.length === 0 ? (
          <EmptyState
            message={
              searchQuery || activeFilter !== 'all'
                ? 'No sessions match your filters.'
                : 'No sessions yet'
            }
            detail={
              searchQuery || activeFilter !== 'all'
                ? undefined
                : 'Start chatting to create your first session.'
            }
          />
        ) : isMobile ? (
          <div className="space-y-3 p-4">
            {filteredSessions.map((session) => (
              <SessionCard key={session.key} session={session} onReplay={setReplaySessionKey} />
            ))}
          </div>
        ) : (
          <div className="p-4">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-700">
                  <th className="p-3 text-left text-xs font-semibold text-zinc-400">Name</th>
                  <th className="p-3 text-left text-xs font-semibold text-zinc-400">Model</th>
                  <th className="p-3 text-left text-xs font-semibold text-zinc-400">Messages</th>
                  <th className="p-3 text-left text-xs font-semibold text-zinc-400">Last Active</th>
                  <th className="p-3 text-left text-xs font-semibold text-zinc-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSessions.map((session) => (
                  <SessionRow key={session.key} session={session} onReplay={setReplaySessionKey} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <SessionPreviewModal />
      <SessionConfigModal />
      <SessionUsageModal />
      {replaySessionKey && (
        <SessionReplay sessionKey={replaySessionKey} onClose={() => setReplaySessionKey(null)} />
      )}
    </div>
  );
}
