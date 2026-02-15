// ---------------------------------------------------------------------------
// Agents View
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { useAgentsStore } from '@/stores/agents';
import { useConnectionStore } from '@/stores/connection';
import { useIsMobile } from '@/hooks/usePlatform';
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

// ---- Create Agent Modal ---------------------------------------------------

function CreateAgentModal() {
  const { showCreateModal, setShowCreateModal, createAgent } = useAgentsStore();
  const [name, setName] = useState('');
  const [workspace, setWorkspace] = useState('');
  const [emoji, setEmoji] = useState('');

  if (!showCreateModal) return null;

  const handleCreate = async () => {
    if (!name || !workspace) return;
    await createAgent(name, workspace, emoji || undefined);
    setName('');
    setWorkspace('');
    setEmoji('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-700 p-4">
          <h2 className="text-lg font-semibold text-zinc-100">Create Agent</h2>
          <button
            onClick={() => setShowCreateModal(false)}
            className="text-zinc-400 hover:text-zinc-100"
            type="button"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

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
              placeholder="🤖"
            />
          </div>
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
            ✕
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
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="mb-4 text-sm text-zinc-100">
            Are you sure you want to delete "{agent.name || agent.id}"?
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
      <div className="mb-2 flex items-center gap-2">
        {agent.identity?.emoji && <span className="text-lg">{agent.identity.emoji}</span>}
        <span className="text-sm font-semibold text-zinc-100">{agent.name || agent.id}</span>
      </div>

      {isSelected && (
        <div className="flex gap-2">
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

            {/* File Browser */}
            <div className="w-64 overflow-auto border-r border-zinc-700">
              <FileBrowser />
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
