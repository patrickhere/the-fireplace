import { useEffect, useState } from 'react';

import { formatSessionKey } from '@/lib/utils';
import { useConnectionStore } from '@/stores/connection';
import { useModelsStore } from '@/stores/models';
import { useSessionsStore, type SessionConfig } from '@/stores/sessions';
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

export function SessionConfigModal() {
  const { showConfigModal, setShowConfigModal, patchSession, sessions } = useSessionsStore();
  const { models, loadModels } = useModelsStore();
  const { status } = useConnectionStore();
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [config, setConfig] = useState<Partial<SessionConfig>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (showConfigModal && sessions.length > 0 && !selectedKey) {
      setSelectedKey(sessions[0]?.key || '');
    }
  }, [showConfigModal, sessions, selectedKey]);

  useEffect(() => {
    if (showConfigModal && status === 'connected' && models.length === 0) {
      void loadModels();
    }
  }, [showConfigModal, status, models.length, loadModels]);

  if (!showConfigModal) return null;

  const handleSave = async () => {
    if (!selectedKey || isSaving) return;
    setIsSaving(true);
    try {
      await patchSession(selectedKey, config);
      setShowConfigModal(false);
      setConfig({});
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={showConfigModal} onOpenChange={(next) => !next && setShowConfigModal(false)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Session Config</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label htmlFor="session-select" className="mb-1 block text-xs text-zinc-400">
              Session
            </label>
            <Select value={selectedKey} onValueChange={setSelectedKey}>
              <SelectTrigger id="session-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sessions.map((session) => (
                  <SelectItem key={session.key} value={session.key}>
                    {session.derivedTitle || formatSessionKey(session.key, session.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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

          <div>
            <label htmlFor="model" className="mb-1 block text-xs text-zinc-400">
              Model
            </label>
            <Select
              value={config.model || '__default_model__'}
              onValueChange={(v) =>
                setConfig({ ...config, model: v === '__default_model__' ? '' : v })
              }
            >
              <SelectTrigger id="model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__default_model__">Default</SelectItem>
                {models.map((m) => (
                  <SelectItem key={`${m.provider}/${m.id}`} value={`${m.provider}/${m.id}`}>
                    {m.name} ({m.provider})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label htmlFor="thinking-level" className="mb-1 block text-xs text-zinc-400">
              Thinking Level
            </label>
            <Select
              value={config.thinkingLevel || '__default_thinking__'}
              onValueChange={(v) =>
                setConfig({ ...config, thinkingLevel: v === '__default_thinking__' ? '' : v })
              }
            >
              <SelectTrigger id="thinking-level">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__default_thinking__">Default</SelectItem>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label htmlFor="send-policy" className="mb-1 block text-xs text-zinc-400">
              Send Policy
            </label>
            <Select
              value={config.sendPolicy || '__default_send_policy__'}
              onValueChange={(v) =>
                setConfig({
                  ...config,
                  sendPolicy: (v === '__default_send_policy__' ? null : v) as
                    | 'allow'
                    | 'deny'
                    | null,
                })
              }
            >
              <SelectTrigger id="send-policy">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__default_send_policy__">Default</SelectItem>
                <SelectItem value="allow">Allow</SelectItem>
                <SelectItem value="deny">Deny</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <button
            onClick={() => setShowConfigModal(false)}
            className="rounded-md bg-zinc-800 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
            type="button"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="rounded-md bg-amber-500 px-4 py-2 text-sm text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
            type="button"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
