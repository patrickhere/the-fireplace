// ---------------------------------------------------------------------------
// Agents View
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { useAgentsStore } from '@/stores/agents';
import { useConnectionStore } from '@/stores/connection';
import { useIsMobile } from '@/hooks/usePlatform';
import { classifyModel, splitModelId, tierBadgeClasses } from '@/lib/modelTiers';
import { DEMON_TEMPLATES } from '@/lib/demonTemplates';
import type { DemonTemplate } from '@/lib/demonTemplates';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import type { Agent } from '@/stores/agents';

// ---- Helper Functions -----------------------------------------------------

function getLanguageExtension(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
      return javascript({ jsx: true, typescript: true });
    case 'json':
      return json();
    case 'md':
    case 'markdown':
      return markdown();
    default:
      return undefined;
  }
}

/** Get the short model name from a fully-qualified model ID */
function shortModelName(modelId: string): string {
  const [, model] = splitModelId(modelId);
  return model;
}

// ---- Model Badge ----------------------------------------------------------

function ModelBadge({ modelId }: { modelId: string }) {
  const tier = classifyModel(modelId);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 ${tierBadgeClasses(tier.tier)}`}
    >
      {shortModelName(modelId)}
    </span>
  );
}

// ---- Fallback Chain -------------------------------------------------------

function FallbackChain({ fallbacks }: { fallbacks: string[] }) {
  const [expanded, setExpanded] = useState(false);

  if (fallbacks.length === 0) return null;

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(!expanded);
        }}
        className="text-xs text-zinc-500 hover:text-zinc-300"
      >
        {expanded ? 'Hide' : `+${fallbacks.length}`} fallback{fallbacks.length !== 1 ? 's' : ''}
      </button>
      {expanded && (
        <div className="mt-1 flex flex-wrap gap-1">
          {fallbacks.map((fb) => (
            <ModelBadge key={fb} modelId={fb} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Soul Role Preview ----------------------------------------------------

function SoulRolePreview({ content }: { content: string }) {
  // Extract first ~5 meaningful lines (skip empty lines at the top)
  const lines = content.split('\n');
  const preview = lines.slice(0, 8).join('\n').trim();

  if (!preview) return null;

  return (
    <div className="mt-2 border-t border-zinc-700 pt-2">
      <div className="mb-1 text-xs font-medium text-zinc-400">Role</div>
      <pre className="text-xs leading-relaxed whitespace-pre-wrap text-zinc-500">{preview}</pre>
    </div>
  );
}

// ---- Template Picker ------------------------------------------------------

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

// ---- Create Agent Modal ---------------------------------------------------

function CreateAgentModal() {
  const { showCreateModal, setShowCreateModal, createAgent } = useAgentsStore();
  const [step, setStep] = useState<'template' | 'form'>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<DemonTemplate | null>(null);
  const [name, setName] = useState('');
  const [workspace, setWorkspace] = useState('');
  const [emoji, setEmoji] = useState('');

  // Reset state when modal opens/closes
  useEffect(() => {
    if (showCreateModal) {
      setStep('template');
      setSelectedTemplate(null);
      setName('');
      setWorkspace('');
      setEmoji('');
    }
  }, [showCreateModal]);

  if (!showCreateModal) return null;

  const handleSelectTemplate = (template: DemonTemplate) => {
    setSelectedTemplate(template);
    setName(template.name.toLowerCase().replace(/[^a-z0-9]/g, '-'));
    setEmoji(template.emoji);
    setStep('form');
  };

  const handleSkipTemplate = () => {
    setSelectedTemplate(null);
    setStep('form');
  };

  const handleCreate = async () => {
    if (!name || !workspace) return;
    await createAgent(name, workspace, emoji || undefined);

    // If a template was selected, write the soul file
    if (selectedTemplate) {
      // Small delay to allow agent creation to propagate
      setTimeout(async () => {
        try {
          const { useConnectionStore: getConnStore } = await import('@/stores/connection');
          const { request } = getConnStore.getState();
          await request('agents.files.set', {
            agentId: name,
            name: 'soul.md',
            content: selectedTemplate.soulFile,
          });
        } catch (err) {
          console.error('[Agents] Failed to write soul file from template:', err);
        }
      }, 500);
    }

    setName('');
    setWorkspace('');
    setEmoji('');
    setSelectedTemplate(null);
    setStep('template');
  };

  const handleBack = () => {
    setStep('template');
    setSelectedTemplate(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-700 p-4">
          <div className="flex items-center gap-2">
            {step === 'form' && (
              <button
                onClick={handleBack}
                className="text-zinc-400 hover:text-zinc-100"
                type="button"
                aria-label="Back"
              >
                &larr;
              </button>
            )}
            <h2 className="text-lg font-semibold text-zinc-100">
              {step === 'template' ? 'Choose Template' : 'Create Agent'}
            </h2>
            {selectedTemplate && step === 'form' && (
              <span className="text-sm text-zinc-500">
                from {selectedTemplate.emoji} {selectedTemplate.name}
              </span>
            )}
          </div>
          <button
            onClick={() => setShowCreateModal(false)}
            className="text-zinc-400 hover:text-zinc-100"
            type="button"
            aria-label="Close"
          >
            &#x2715;
          </button>
        </div>

        {step === 'template' ? (
          <TemplatePicker onSelect={handleSelectTemplate} onSkip={handleSkipTemplate} />
        ) : (
          <>
            {/* Form */}
            <div className="space-y-4 p-4">
              <div>
                <label htmlFor="name" className="mb-1 block text-xs text-zinc-400">
                  Name *
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 focus:outline-none"
                  placeholder="my-agent"
                />
              </div>

              <div>
                <label htmlFor="workspace" className="mb-1 block text-xs text-zinc-400">
                  Workspace *
                </label>
                <input
                  id="workspace"
                  type="text"
                  value={workspace}
                  onChange={(e) => setWorkspace(e.target.value)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 focus:outline-none"
                  placeholder="/path/to/workspace"
                />
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

              {/* Template info */}
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
                    <ModelBadge modelId={selectedTemplate.suggestedModel.primary} />
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    CLI preference: {selectedTemplate.cliPreferences.preferred}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 border-t border-zinc-700 p-4">
              <button
                onClick={() => setShowCreateModal(false)}
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
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---- Edit Agent Modal -----------------------------------------------------

function EditAgentModal({ agent }: { agent: Agent | null }) {
  const { showEditModal, setShowEditModal, updateAgent } = useAgentsStore();
  const [name, setName] = useState('');

  useEffect(() => {
    if (agent) {
      setName(agent.name || '');
    }
  }, [agent]);

  if (!showEditModal || !agent) return null;

  const handleUpdate = async () => {
    if (!name || !agent) return;
    await updateAgent(agent.id, { name, identity: agent.identity });
    setName('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-700 p-4">
          <h2 className="text-lg font-semibold text-zinc-100">Edit Agent</h2>
          <button
            onClick={() => setShowEditModal(false)}
            className="text-zinc-400 hover:text-zinc-100"
            type="button"
            aria-label="Close"
          >
            &#x2715;
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4 p-4">
          <div>
            <label htmlFor="edit-name" className="mb-1 block text-xs text-zinc-400">
              Name *
            </label>
            <input
              id="edit-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 focus:outline-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 border-t border-zinc-700 p-4">
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
        </div>
      </div>
    </div>
  );
}

// ---- Delete Agent Modal ---------------------------------------------------

function DeleteAgentModal({ agent }: { agent: Agent | null }) {
  const { showDeleteModal, setShowDeleteModal, deleteAgent } = useAgentsStore();
  const [deleteFiles, setDeleteFiles] = useState(false);

  if (!showDeleteModal || !agent) return null;

  const handleDelete = async () => {
    await deleteAgent(agent.id, deleteFiles);
    setDeleteFiles(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-700 p-4">
          <h2 className="text-lg font-semibold text-zinc-100">Delete Agent</h2>
          <button
            onClick={() => setShowDeleteModal(false)}
            className="text-zinc-400 hover:text-zinc-100"
            type="button"
            aria-label="Close"
          >
            &#x2715;
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="mb-4 text-sm text-zinc-100">
            Are you sure you want to delete &ldquo;{agent.name || agent.id}&rdquo;?
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

        {/* Actions */}
        <div className="flex justify-end gap-2 border-t border-zinc-700 p-4">
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
        </div>
      </div>
    </div>
  );
}

// ---- Agent List Item ------------------------------------------------------

function AgentListItem({ agent, isSelected }: { agent: Agent; isSelected: boolean }) {
  const { selectAgent, setShowEditModal, setShowDeleteModal } = useAgentsStore();

  return (
    <div
      className={`cursor-pointer rounded-lg border p-3 ${
        isSelected
          ? 'border-amber-500 bg-amber-500/10'
          : 'border-zinc-700 bg-zinc-900 hover:bg-zinc-800'
      }`}
      onClick={() => selectAgent(agent.id)}
    >
      <div className="flex items-center gap-2">
        {agent.identity?.emoji && <span className="text-lg">{agent.identity.emoji}</span>}
        <div className="min-w-0 flex-1">
          <span className="text-sm font-semibold text-zinc-100">{agent.name || agent.id}</span>
          {agent.model && (
            <div className="mt-0.5 flex items-center gap-1">
              <ModelBadge modelId={agent.model.primary} />
            </div>
          )}
        </div>
      </div>

      {agent.model && <FallbackChain fallbacks={agent.model.fallbacks} />}

      {isSelected && (
        <div className="mt-2 flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowEditModal(true);
            }}
            className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
            type="button"
          >
            Edit
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDeleteModal(true);
            }}
            className="rounded-md bg-red-500/10 px-2 py-1 text-xs text-red-400 hover:bg-red-500/20"
            type="button"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ---- Agent Detail Panel ---------------------------------------------------

function AgentDetailPanel({ agent }: { agent: Agent }) {
  const { selectedFile, fileContent } = useAgentsStore();

  // Show soul.md preview when that file is selected
  const isSoulFile = selectedFile?.name === 'soul.md';

  return (
    <div className="space-y-3 border-b border-zinc-700 p-3">
      {/* Agent header */}
      <div className="flex items-center gap-2">
        {agent.identity?.emoji && <span className="text-2xl">{agent.identity.emoji}</span>}
        <div>
          <div className="text-sm font-semibold text-zinc-100">{agent.name || agent.id}</div>
          <div className="text-xs text-zinc-500">{agent.id}</div>
        </div>
      </div>

      {/* Model info */}
      {agent.model && (
        <div>
          <div className="mb-1 text-xs font-medium text-zinc-400">Model</div>
          <div className="flex items-center gap-1">
            <ModelBadge modelId={agent.model.primary} />
            <span className="text-xs text-zinc-500">primary</span>
          </div>
          {agent.model.fallbacks.length > 0 && (
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {agent.model.fallbacks.map((fb) => (
                <ModelBadge key={fb} modelId={fb} />
              ))}
              <span className="text-xs text-zinc-500">fallbacks</span>
            </div>
          )}
        </div>
      )}

      {/* Soul file role preview */}
      {isSoulFile && fileContent && <SoulRolePreview content={fileContent} />}
    </div>
  );
}

// ---- File Browser ---------------------------------------------------------

function FileBrowser() {
  const { agentFiles, selectedFile, selectedAgentId, selectFile } = useAgentsStore();

  if (!selectedAgentId) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        Select an agent
      </div>
    );
  }

  if (agentFiles.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">No files</div>
    );
  }

  return (
    <div className="space-y-1 p-2">
      {agentFiles.map((file) => (
        <button
          key={file.name}
          onClick={() => selectFile(selectedAgentId, file.name)}
          className={`w-full rounded-md px-3 py-2 text-left text-sm ${
            selectedFile?.name === file.name
              ? 'bg-amber-500 text-zinc-950'
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100'
          }`}
          type="button"
        >
          <div className="flex items-center justify-between">
            <span className="truncate">{file.name}</span>
            {file.missing && <span className="ml-2 text-xs text-red-400">!</span>}
          </div>
        </button>
      ))}
    </div>
  );
}

// ---- File Editor ----------------------------------------------------------

function FileEditor() {
  const { selectedFile, fileContent, selectedAgentId, isSavingFile, saveFile } = useAgentsStore();

  const [editorContent, setEditorContent] = useState('');

  useEffect(() => {
    setEditorContent(fileContent || '');
  }, [fileContent]);

  if (!selectedAgentId || !selectedFile) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        Select a file
      </div>
    );
  }

  const handleSave = () => {
    if (selectedAgentId && selectedFile) {
      saveFile(selectedAgentId, selectedFile.name, editorContent);
    }
  };

  const languageExtension = getLanguageExtension(selectedFile.name);

  return (
    <div className="flex h-full flex-col">
      {/* File Header */}
      <div className="flex items-center justify-between border-b border-zinc-700 p-3">
        <div>
          <div className="text-sm font-semibold text-zinc-100">{selectedFile.name}</div>
          <div className="text-xs text-zinc-500">{selectedFile.path}</div>
        </div>
        <button
          onClick={handleSave}
          disabled={isSavingFile}
          className="rounded-md bg-amber-500 px-3 py-1 text-sm text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
          type="button"
        >
          {isSavingFile ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-auto">
        <CodeMirror
          value={editorContent}
          onChange={(value) => setEditorContent(value)}
          extensions={languageExtension ? [languageExtension] : []}
          theme="dark"
          className="h-full"
          basicSetup={{
            lineNumbers: true,
            highlightActiveLineGutter: true,
            highlightSpecialChars: true,
            foldGutter: true,
            drawSelection: true,
            dropCursor: true,
            allowMultipleSelections: true,
            indentOnInput: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            rectangularSelection: true,
            crosshairCursor: true,
            highlightActiveLine: true,
            highlightSelectionMatches: true,
            closeBracketsKeymap: true,
            searchKeymap: true,
            foldKeymap: true,
            completionKeymap: true,
            lintKeymap: true,
          }}
        />
      </div>
    </div>
  );
}

// ---- Main Agents View -----------------------------------------------------

export function Agents() {
  const {
    agents,
    selectedAgentId,
    isLoading,
    error,
    setShowCreateModal,
    loadAgents,
    subscribeToEvents,
    unsubscribeFromEvents,
  } = useAgentsStore();

  const { status } = useConnectionStore();
  const isMobile = useIsMobile();
  const [mobileTab, setMobileTab] = useState<'agents' | 'files' | 'editor'>('agents');

  // Load agents on mount and subscribe to events
  useEffect(() => {
    if (status === 'connected') {
      loadAgents();
      subscribeToEvents();
    }

    return () => {
      unsubscribeFromEvents();
    };
  }, [status, loadAgents, subscribeToEvents, unsubscribeFromEvents]);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) || null;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-zinc-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-zinc-100">Agents</h1>
            <p className="text-sm text-zinc-400">Manage agents and files</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-md bg-amber-500 px-3 py-2 text-sm text-zinc-950 hover:bg-amber-400"
            type="button"
          >
            New Agent
          </button>
        </div>

        {/* Mobile Tabs */}
        {isMobile && (
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setMobileTab('agents')}
              className={`flex-1 rounded-md px-3 py-2 text-sm ${
                mobileTab === 'agents' ? 'bg-amber-500 text-zinc-950' : 'bg-zinc-800 text-zinc-400'
              }`}
              type="button"
            >
              Agents
            </button>
            <button
              onClick={() => setMobileTab('files')}
              className={`flex-1 rounded-md px-3 py-2 text-sm ${
                mobileTab === 'files' ? 'bg-amber-500 text-zinc-950' : 'bg-zinc-800 text-zinc-400'
              }`}
              type="button"
            >
              Files
            </button>
            <button
              onClick={() => setMobileTab('editor')}
              className={`flex-1 rounded-md px-3 py-2 text-sm ${
                mobileTab === 'editor' ? 'bg-amber-500 text-zinc-950' : 'bg-zinc-800 text-zinc-400'
              }`}
              type="button"
            >
              Editor
            </button>
          </div>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="border-b border-red-500/20 bg-red-500/10 p-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex w-full items-center justify-center text-sm text-zinc-400">
            Loading agents...
          </div>
        ) : isMobile ? (
          // Mobile: Tab-based layout
          <div className="flex-1 overflow-auto">
            {mobileTab === 'agents' && (
              <div className="space-y-2 p-3">
                {agents.map((agent) => (
                  <AgentListItem
                    key={agent.id}
                    agent={agent}
                    isSelected={selectedAgentId === agent.id}
                  />
                ))}
              </div>
            )}
            {mobileTab === 'files' && <FileBrowser />}
            {mobileTab === 'editor' && <FileEditor />}
          </div>
        ) : (
          // Desktop: 3-column layout
          <>
            {/* Agent List */}
            <div className="w-64 overflow-auto border-r border-zinc-700">
              <div className="space-y-2 p-3">
                {agents.map((agent) => (
                  <AgentListItem
                    key={agent.id}
                    agent={agent}
                    isSelected={selectedAgentId === agent.id}
                  />
                ))}
              </div>
            </div>

            {/* File Browser + Detail Panel */}
            <div className="flex w-64 flex-col overflow-auto border-r border-zinc-700">
              {selectedAgent && <AgentDetailPanel agent={selectedAgent} />}
              <div className="flex-1 overflow-auto">
                <FileBrowser />
              </div>
            </div>

            {/* File Editor */}
            <div className="flex-1 overflow-hidden">
              <FileEditor />
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      <CreateAgentModal />
      <EditAgentModal agent={selectedAgent} />
      <DeleteAgentModal agent={selectedAgent} />
    </div>
  );
}
