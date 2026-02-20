// ---------------------------------------------------------------------------
// Task Create Modal — explicit task assignment for demons
// ---------------------------------------------------------------------------

import { useState, useCallback } from 'react';
import { useDemonTasksStore } from '@/stores/demonTasks';
import { useDemonHealthStore } from '@/stores/demonHealth';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function TaskCreateModal({ onClose }: { onClose: () => void }) {
  const { demons } = useDemonHealthStore();
  const { createExplicitTask } = useDemonTasksStore();
  const [description, setDescription] = useState('');
  const [assignTo, setAssignTo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!description.trim() || !assignTo) return;
      setIsSubmitting(true);
      try {
        await createExplicitTask(description.trim(), assignTo);
        onClose();
      } finally {
        setIsSubmitting(false);
      }
    },
    [description, assignTo, createExplicitTask, onClose]
  );

  return (
    <Card className="mb-4 border-amber-500/30 bg-zinc-800">
      <CardContent className="p-4">
        <h3 className="mb-3 text-sm font-semibold text-zinc-200">Create Task</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the task for the demon to execute..."
              rows={3}
              className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-zinc-500">Assign to</label>
            <Select value={assignTo} onValueChange={setAssignTo}>
              <SelectTrigger>
                <SelectValue placeholder="Select a demon..." />
              </SelectTrigger>
              <SelectContent>
                {demons.map((d) => (
                  <SelectItem key={d.demonId} value={d.demonId}>
                    {d.demonEmoji} {d.demonName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!description.trim() || !assignTo || isSubmitting}
              className="rounded-md bg-amber-500 px-4 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
