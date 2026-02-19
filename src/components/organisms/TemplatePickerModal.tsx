import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { DEMON_TEMPLATES, type DemonTemplate } from '@/lib/demonTemplates';
import { ModelBadge } from '@/components/atoms/ModelBadge';
import { useAgentsStore } from '@/stores/agents';
import { useConnectionStore } from '@/stores/connection';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

function TemplatePicker({
  onSelect,
  onSkip,
}: {
  onSelect: (template: DemonTemplate) => void;
  onSkip: () => void;
}) {
  return (
    <div className="space-y-3 p-4">
      <p className="text-sm text-zinc-400">Choose a template to get started, or start blank.</p>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {DEMON_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => (template.id === 'blank' ? onSkip() : onSelect(template))}
            className="group rounded-lg border border-zinc-700 bg-zinc-800 p-3 text-left transition hover:border-amber-500/50 hover:bg-zinc-800/80"
          >
            <div className="mb-1 text-xl">{template.emoji}</div>
            <div className="text-sm font-medium text-zinc-100 group-hover:text-amber-400">
              {template.name}
            </div>
            <div className="mt-0.5 line-clamp-2 text-xs text-zinc-500">{template.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function TemplatePickerModal() {
  const { showCreateModal, setShowCreateModal, createAgent } = useAgentsStore();
  const { request } = useConnectionStore();

  const [step, setStep] = useState<'template' | 'form'>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<DemonTemplate | null>(null);
  const [name, setName] = useState('');
  const [workspace, setWorkspace] = useState('');
  const [emoji, setEmoji] = useState('');
  const [nameError, setNameError] = useState('');
  const [workspaceError, setWorkspaceError] = useState('');

  useEffect(() => {
    if (!showCreateModal) return;
    setStep('template');
    setSelectedTemplate(null);
    setName('');
    setWorkspace('');
    setEmoji('');
    setNameError('');
    setWorkspaceError('');
  }, [showCreateModal]);

  const close = () => setShowCreateModal(false);

  const handleCreate = async () => {
    let valid = true;
    if (!name.trim()) {
      setNameError('Name is required');
      valid = false;
    } else {
      setNameError('');
    }
    if (!workspace.trim()) {
      setWorkspaceError('Workspace path is required');
      valid = false;
    } else {
      setWorkspaceError('');
    }
    if (!valid) return;

    const success = await createAgent(name.trim(), workspace.trim(), emoji || undefined);
    if (!success) return;

    if (selectedTemplate) {
      try {
        await request('agents.files.set', {
          agentId: name,
          name: 'soul.md',
          content: selectedTemplate.soulFile,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to write soul file';
        toast.error(msg);
        console.error('[Agents] Failed to write soul file from template:', err);
      }
    }

    setName('');
    setWorkspace('');
    setEmoji('');
    setSelectedTemplate(null);
    setStep('template');
  };

  return (
    <Dialog open={showCreateModal} onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-w-2xl p-0">
        <DialogHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            {step === 'form' && (
              <button
                onClick={() => {
                  setStep('template');
                  setSelectedTemplate(null);
                }}
                className="text-zinc-400 hover:text-zinc-100"
                type="button"
                aria-label="Back"
              >
                &larr;
              </button>
            )}
            <DialogTitle>{step === 'template' ? 'Choose Template' : 'Create Agent'}</DialogTitle>
            {selectedTemplate && step === 'form' && (
              <span className="text-sm text-zinc-500">
                from {selectedTemplate.emoji} {selectedTemplate.name}
              </span>
            )}
          </div>
        </DialogHeader>

        {step === 'template' ? (
          <TemplatePicker
            onSelect={(template) => {
              setSelectedTemplate(template);
              setName(template.name.toLowerCase().replace(/[^a-z0-9]/g, '-'));
              setEmoji(template.emoji);
              setStep('form');
            }}
            onSkip={() => {
              setSelectedTemplate(null);
              setStep('form');
            }}
          />
        ) : (
          <>
            <div className="space-y-4 p-4">
              <div>
                <label htmlFor="name" className="mb-1 block text-xs text-zinc-400">
                  Name *
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (nameError) setNameError('');
                  }}
                  className={`w-full rounded-md border bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:ring-1 focus:outline-none ${nameError ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30' : 'border-zinc-700 focus:border-amber-500 focus:ring-amber-500/30'}`}
                  placeholder="my-agent"
                />
                {nameError && <p className="mt-1 text-xs text-red-400">{nameError}</p>}
              </div>

              <div>
                <label htmlFor="workspace" className="mb-1 block text-xs text-zinc-400">
                  Workspace *
                </label>
                <input
                  id="workspace"
                  type="text"
                  value={workspace}
                  onChange={(e) => {
                    setWorkspace(e.target.value);
                    if (workspaceError) setWorkspaceError('');
                  }}
                  className={`w-full rounded-md border bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:ring-1 focus:outline-none ${workspaceError ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30' : 'border-zinc-700 focus:border-amber-500 focus:ring-amber-500/30'}`}
                  placeholder="/path/to/workspace"
                />
                {workspaceError && <p className="mt-1 text-xs text-red-400">{workspaceError}</p>}
              </div>

              <div>
                <label htmlFor="emoji" className="mb-1 block text-xs text-zinc-400">
                  Emoji
                </label>
                <input
                  id="emoji"
                  type="text"
                  value={emoji}
                  onChange={(e) => setEmoji(e.target.value)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 focus:outline-none"
                  placeholder="&#x1F916;"
                />
              </div>

              {selectedTemplate && (
                <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-3">
                  <div className="mb-1 text-xs font-medium text-zinc-400">Template</div>
                  <div className="flex items-center gap-2 text-sm text-zinc-100">
                    <span>{selectedTemplate.emoji}</span>
                    <span>{selectedTemplate.name}</span>
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">{selectedTemplate.description}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-zinc-500">Suggested model:</span>
                    <ModelBadge model={selectedTemplate.suggestedModel.primary} />
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    CLI preference: {selectedTemplate.cliPreferences.preferred}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <button
                onClick={close}
                className="rounded-md bg-zinc-800 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!name || !workspace}
                className="rounded-md bg-amber-500 px-4 py-2 text-sm text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
                type="button"
              >
                Create
              </button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
