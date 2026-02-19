import { useEffect, useState } from 'react';
import type { Agent } from '@/stores/agents';
import { useAgentsStore } from '@/stores/agents';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function AgentDeleteModal({ agent }: { agent: Agent | null }) {
  const { showDeleteModal, setShowDeleteModal, deleteAgent } = useAgentsStore();
  const [deleteFiles, setDeleteFiles] = useState(false);

  useEffect(() => {
    if (!showDeleteModal) setDeleteFiles(false);
  }, [showDeleteModal]);

  const handleDelete = async () => {
    if (!agent) return;
    await deleteAgent(agent.id, deleteFiles);
    setDeleteFiles(false);
  };

  return (
    <Dialog
      open={showDeleteModal && !!agent}
      onOpenChange={(next) => {
        if (!next) setShowDeleteModal(false);
      }}
    >
      <DialogContent className="max-w-md p-0">
        <DialogHeader>
          <DialogTitle>Delete Agent</DialogTitle>
        </DialogHeader>

        <div className="p-4">
          <p className="mb-4 text-sm text-zinc-100">
            Are you sure you want to delete &ldquo;{agent?.name || agent?.id}&rdquo;?
          </p>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={deleteFiles}
              onChange={(e) => setDeleteFiles(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-amber-500/30"
            />
            <span className="text-sm text-zinc-400">Delete workspace files</span>
          </label>
        </div>

        <DialogFooter>
          <button
            onClick={() => setShowDeleteModal(false)}
            className="rounded-md bg-zinc-800 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
            type="button"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            className="rounded-md bg-red-500 px-4 py-2 text-sm text-zinc-950 hover:bg-red-400"
            type="button"
          >
            Delete
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
