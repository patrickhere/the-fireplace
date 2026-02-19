import { useState } from 'react';
import { useSessionsStore, type SessionListItem } from '@/stores/sessions';
import { formatSessionKey } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function SessionActionsCell({
  session,
  onReplay,
}: {
  session: SessionListItem;
  onReplay: (key: string) => void;
}) {
  const { previewSession, resetSession, deleteSession, compactSession } = useSessionsStore();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showCompactConfirm, setShowCompactConfirm] = useState(false);

  const sessionTitle = session.derivedTitle || formatSessionKey(session.key, session.label);

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
    <>
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
          onClick={() => setShowResetConfirm(true)}
          className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
          type="button"
        >
          Reset
        </button>
        <button
          onClick={() => setShowCompactConfirm(true)}
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

      <Dialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Session</DialogTitle>
            <DialogDescription>
              Reset session "{sessionTitle}"? This clears conversation history.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setShowResetConfirm(false)}
              className="rounded-md bg-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-600"
              type="button"
            >
              Cancel
            </button>
            <button
              onClick={() => void handleReset()}
              className="rounded-md bg-amber-500 px-4 py-2 text-sm text-zinc-950 hover:bg-amber-400"
              type="button"
            >
              Confirm Reset
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCompactConfirm} onOpenChange={setShowCompactConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Compact Session</DialogTitle>
            <DialogDescription>
              Compact session "{sessionTitle}"? This trims old messages.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setShowCompactConfirm(false)}
              className="rounded-md bg-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-600"
              type="button"
            >
              Cancel
            </button>
            <button
              onClick={() => void handleCompact()}
              className="rounded-md bg-zinc-600 px-4 py-2 text-sm text-zinc-100 hover:bg-zinc-500"
              type="button"
            >
              Confirm Compact
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Session</DialogTitle>
            <DialogDescription>Delete session "{sessionTitle}"?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="rounded-md bg-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-600"
              type="button"
            >
              Cancel
            </button>
            <button
              onClick={() => void handleDelete(false)}
              className="rounded-md bg-red-500/10 px-4 py-2 text-sm text-red-400 hover:bg-red-500/20"
              type="button"
            >
              Keep Transcript
            </button>
            <button
              onClick={() => void handleDelete(true)}
              className="rounded-md bg-red-500 px-4 py-2 text-sm text-zinc-950 hover:bg-red-400"
              type="button"
            >
              Delete All
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
