import { useState } from 'react';
import { useSessionsStore, type SessionListItem } from '@/stores/sessions';
import { formatSessionKey } from '@/lib/utils';

export function SessionCard({
  session,
  onReplay,
}: {
  session: SessionListItem;
  onReplay: (key: string) => void;
}) {
  const { previewSession, resetSession, deleteSession, compactSession } = useSessionsStore();
  const [showActions, setShowActions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showCompactConfirm, setShowCompactConfirm] = useState(false);

  const handleDelete = async (deleteTranscript: boolean) => {
    await deleteSession(session.key, deleteTranscript);
    setShowDeleteConfirm(false);
  };

  const handleReset = async () => {
    await resetSession(session.key);
    setShowResetConfirm(false);
  };

  const handleCompact = async () => {
    await compactSession(session.key);
    setShowCompactConfirm(false);
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

      {showActions && !showDeleteConfirm && !showResetConfirm && !showCompactConfirm && (
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
            onClick={() => setShowResetConfirm(true)}
            className="rounded-md bg-zinc-800 px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
            type="button"
          >
            Reset
          </button>
          <button
            onClick={() => setShowCompactConfirm(true)}
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

      {showResetConfirm && (
        <div className="mt-3 rounded-md bg-amber-500/5 p-2">
          <p className="mb-2 text-xs text-amber-400">
            Reset this session? Clears conversation history.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => void handleReset()}
              className="flex-1 rounded-md bg-amber-500 px-3 py-1 text-xs text-zinc-950 hover:bg-amber-400"
              type="button"
            >
              Confirm Reset
            </button>
            <button
              onClick={() => setShowResetConfirm(false)}
              className="flex-1 rounded-md bg-zinc-800 px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showCompactConfirm && (
        <div className="mt-3 rounded-md bg-zinc-700/30 p-2">
          <p className="mb-2 text-xs text-zinc-300">Compact this session? Trims old messages.</p>
          <div className="flex gap-2">
            <button
              onClick={() => void handleCompact()}
              className="flex-1 rounded-md bg-zinc-600 px-3 py-1 text-xs text-zinc-100 hover:bg-zinc-500"
              type="button"
            >
              Confirm Compact
            </button>
            <button
              onClick={() => setShowCompactConfirm(false)}
              className="flex-1 rounded-md bg-zinc-800 px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="mt-3 rounded-md bg-red-500/5 p-2">
          <p className="mb-2 text-xs text-red-400">Delete this session?</p>
          <div className="flex gap-2">
            <button
              onClick={() => void handleDelete(false)}
              className="flex-1 rounded-md bg-red-500/10 px-3 py-1 text-xs text-red-400 hover:bg-red-500/20"
              type="button"
            >
              Keep Transcript
            </button>
            <button
              onClick={() => void handleDelete(true)}
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
