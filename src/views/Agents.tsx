import { useEffect, useMemo, useState } from 'react';
import { useAgentsStore, type Agent } from '@/stores/agents';
import { useConnectionStore } from '@/stores/connection';
import { useIsMobile } from '@/hooks/usePlatform';
import { LoadingSpinner, EmptyState, ErrorState } from '@/components/StateIndicators';
import { ModelBadge } from '@/components/atoms/ModelBadge';
import { AgentCard } from '@/components/molecules/AgentCard';
import { AgentEditor } from '@/components/organisms/AgentEditor';
import { AgentEditModal } from '@/components/organisms/AgentEditModal';
import { AgentDeleteModal } from '@/components/organisms/AgentDeleteModal';
import { TemplatePickerModal } from '@/components/organisms/TemplatePickerModal';

function SoulRolePreview({ content }: { content: string }) {
  const preview = content.split('\n').slice(0, 8).join('\n').trim();
  if (!preview) return null;

  return (
    <div className="mt-2 border-t border-zinc-700 pt-2">
      <div className="mb-1 text-xs font-medium text-zinc-400">Role</div>
      <pre className="text-xs leading-relaxed whitespace-pre-wrap text-zinc-500">{preview}</pre>
    </div>
  );
}

function AgentDetailPanel({ agent }: { agent: Agent }) {
  const { selectedFile, fileContent } = useAgentsStore();
  const isSoulFile = selectedFile?.name === 'soul.md';

  return (
    <div className="space-y-3 border-b border-zinc-700 p-3">
      <div className="flex items-center gap-2">
        {agent.identity?.emoji && <span className="text-2xl">{agent.identity.emoji}</span>}
        <div>
          <div className="text-sm font-semibold text-zinc-100">{agent.name || agent.id}</div>
          <div className="text-xs text-zinc-500">{agent.id}</div>
        </div>
      </div>

      {agent.model && (
        <div>
          <div className="mb-1 text-xs font-medium text-zinc-400">Model</div>
          <div className="flex items-center gap-1">
            <ModelBadge model={agent.model.primary} />
            <span className="text-xs text-zinc-500">primary</span>
          </div>
          {agent.model.fallbacks.length > 0 && (
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {agent.model.fallbacks.map((fallback) => (
                <ModelBadge key={fallback} model={fallback} />
              ))}
              <span className="text-xs text-zinc-500">fallbacks</span>
            </div>
          )}
        </div>
      )}

      {isSoulFile && fileContent && <SoulRolePreview content={fileContent} />}
    </div>
  );
}

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

export function Agents() {
  const {
    agents,
    selectedAgentId,
    isLoading,
    error,
    selectedFile,
    fileContent,
    isSavingFile,
    setShowCreateModal,
    setShowEditModal,
    setShowDeleteModal,
    selectAgent,
    saveFile,
    loadAgents,
    subscribeToEvents,
    unsubscribeFromEvents,
  } = useAgentsStore();

  const { status } = useConnectionStore();
  const isMobile = useIsMobile();
  const [mobileTab, setMobileTab] = useState<'agents' | 'files' | 'editor'>('agents');

  useEffect(() => {
    if (status === 'connected') {
      loadAgents();
      subscribeToEvents();
    }

    return () => {
      unsubscribeFromEvents();
    };
  }, [status, loadAgents, subscribeToEvents, unsubscribeFromEvents]);

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId) ?? null,
    [agents, selectedAgentId]
  );

  return (
    <div className="flex h-full flex-col">
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

        {isMobile && (
          <div className="mt-3 flex gap-2">
            {(['agents', 'files', 'editor'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setMobileTab(tab)}
                className={`flex-1 rounded-md px-3 py-2 text-sm ${
                  mobileTab === tab ? 'bg-amber-500 text-zinc-950' : 'bg-zinc-800 text-zinc-400'
                }`}
                type="button"
              >
                {tab[0]!.toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {error && !isLoading ? (
          <ErrorState message={error} onRetry={() => loadAgents(true)} />
        ) : isLoading && agents.length === 0 ? (
          <LoadingSpinner message="Loading agents..." />
        ) : isMobile ? (
          <div className="flex-1 overflow-auto">
            {mobileTab === 'agents' && (
              <div className="space-y-2 p-3">
                {agents.length === 0 ? (
                  <EmptyState
                    message="No agents configured"
                    detail="Create your first agent to get started."
                  />
                ) : (
                  agents.map((agent) => (
                    <AgentCard
                      key={agent.id}
                      agent={agent}
                      isSelected={selectedAgentId === agent.id}
                      onSelect={() => selectAgent(agent.id)}
                      onEdit={() => setShowEditModal(true)}
                      onDelete={() => setShowDeleteModal(true)}
                    />
                  ))
                )}
              </div>
            )}
            {mobileTab === 'files' && <FileBrowser />}
            {mobileTab === 'editor' && (
              <AgentEditor
                selectedAgentId={selectedAgentId}
                selectedFile={selectedFile}
                fileContent={fileContent}
                isSavingFile={isSavingFile}
                onSave={saveFile}
              />
            )}
          </div>
        ) : (
          <>
            <div className="w-64 overflow-auto border-r border-zinc-700">
              {agents.length === 0 ? (
                <EmptyState message="No agents" detail="Create your first agent." />
              ) : (
                <div className="space-y-2 p-3">
                  {agents.map((agent) => (
                    <AgentCard
                      key={agent.id}
                      agent={agent}
                      isSelected={selectedAgentId === agent.id}
                      onSelect={() => selectAgent(agent.id)}
                      onEdit={() => setShowEditModal(true)}
                      onDelete={() => setShowDeleteModal(true)}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="flex w-64 flex-col overflow-auto border-r border-zinc-700">
              {selectedAgent && <AgentDetailPanel agent={selectedAgent} />}
              <div className="flex-1 overflow-auto">
                <FileBrowser />
              </div>
            </div>

            <div className="flex-1 overflow-hidden">
              <AgentEditor
                selectedAgentId={selectedAgentId}
                selectedFile={selectedFile}
                fileContent={fileContent}
                isSavingFile={isSavingFile}
                onSave={saveFile}
              />
            </div>
          </>
        )}
      </div>

      <TemplatePickerModal />
      <AgentEditModal agent={selectedAgent} />
      <AgentDeleteModal agent={selectedAgent} />
    </div>
  );
}
