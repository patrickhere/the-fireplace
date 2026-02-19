import { useEffect, useState } from 'react';
import type { Agent } from '@/stores/agents';
import { useAgentsStore } from '@/stores/agents';
import { useModelsStore } from '@/stores/models';
import { useConnectionStore } from '@/stores/connection';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function AgentEditModal({ agent }: { agent: Agent | null }) {
  const { showEditModal, setShowEditModal, updateAgent } = useAgentsStore();
  const { models, loadModels } = useModelsStore();
  const { status } = useConnectionStore();

  const [name, setName] = useState('');
  const [primaryModel, setPrimaryModel] = useState('');
  const [nameError, setNameError] = useState('');

  useEffect(() => {
    if (!agent) return;
    setName(agent.name || '');
    setPrimaryModel(agent.model?.primary || '__unchanged__');
    setNameError('');
  }, [agent]);

  useEffect(() => {
    if (showEditModal && status === 'connected' && models.length === 0) {
      loadModels();
    }
  }, [showEditModal, status, models.length, loadModels]);

  const handleUpdate = async () => {
    if (!agent) return;
    if (!name.trim()) {
      setNameError('Name is required');
      return;
    }

    const updates: Partial<Agent> = { name: name.trim() };
    if (primaryModel && primaryModel !== '__unchanged__') {
      updates.model = { primary: primaryModel, fallbacks: [] };
    }
    await updateAgent(agent.id, updates);
    setName('');
    setPrimaryModel('__unchanged__');
  };

  return (
    <Dialog
      open={showEditModal && !!agent}
      onOpenChange={(next) => !next && setShowEditModal(false)}
    >
      <DialogContent className="max-w-md p-0">
        <DialogHeader>
          <DialogTitle>Edit Agent</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 p-4">
          <div>
            <label htmlFor="edit-name" className="mb-1 block text-xs text-zinc-400">
              Name *
            </label>
            <input
              id="edit-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError('');
              }}
              className={`w-full rounded-md border bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:ring-1 focus:outline-none ${nameError ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30' : 'border-zinc-700 focus:border-amber-500 focus:ring-amber-500/30'}`}
            />
            {nameError && <p className="mt-1 text-xs text-red-400">{nameError}</p>}
          </div>

          <div>
            <label htmlFor="edit-model" className="mb-1 block text-xs text-zinc-400">
              Primary Model
            </label>
            <Select value={primaryModel} onValueChange={setPrimaryModel}>
              <SelectTrigger id="edit-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__unchanged__">Unchanged</SelectItem>
                {models.map((model) => (
                  <SelectItem
                    key={`${model.provider}/${model.id}`}
                    value={`${model.provider}/${model.id}`}
                  >
                    {model.name} ({model.provider})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <button
            onClick={() => setShowEditModal(false)}
            className="rounded-md bg-zinc-800 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
            type="button"
          >
            Cancel
          </button>
          <button
            onClick={handleUpdate}
            disabled={!name}
            className="rounded-md bg-amber-500 px-4 py-2 text-sm text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
            type="button"
          >
            Save
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
