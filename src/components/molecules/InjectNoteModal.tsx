import { useState } from 'react';

import { useChatStore } from '@/stores/chat';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function InjectNoteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { injectNote } = useChatStore();
  const [note, setNote] = useState('');

  const handleInject = () => {
    if (!note.trim()) return;
    void injectNote(note);
    setNote('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Inject Assistant Note</DialogTitle>
          <DialogDescription>
            Add a note to the assistant's context without triggering a new response.
          </DialogDescription>
        </DialogHeader>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Enter note..."
          className="mb-3 w-full resize-none rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 focus:outline-none"
          rows={6}
        />
        <DialogFooter>
          <button
            onClick={onClose}
            className="rounded-md bg-zinc-800 px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
            type="button"
          >
            Cancel
          </button>
          <button
            onClick={handleInject}
            disabled={!note.trim()}
            className="rounded-md bg-amber-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
            type="button"
          >
            Inject
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
