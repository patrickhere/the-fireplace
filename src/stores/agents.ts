// ---------------------------------------------------------------------------
// Agents Store (Zustand)
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import type { Unsubscribe } from '@/gateway/types';

// ---- Agent Types ----------------------------------------------------------

export interface AgentModel {
  primary: string;
  fallbacks: string[];
}

export interface Agent {
  id: string;
  name?: string;
  identity?: {
    name?: string;
    theme?: string;
    emoji?: string;
    avatar?: string;
    avatarUrl?: string;
  };
  model?: AgentModel;
}

export interface AgentFile {
  name: string;
  path: string;
  missing: boolean;
  size?: number;
  updatedAtMs?: number;
  content?: string;
}

export interface AgentsListResult {
  defaultId: string;
  mainKey: string;
  scope: 'per-sender' | 'global';
  agents: Agent[];
}

// ---- Event Payload Types --------------------------------------------------

export interface AgentEventPayload {
  agentId: string;
  type: 'created' | 'updated' | 'deleted' | 'file.changed';
  timestamp: number;
  fileName?: string;
}

// ---- Store Types ----------------------------------------------------------

interface AgentsState {
  // Data
  agents: Agent[];
  selectedAgentId: string | null;
  agentFiles: AgentFile[];
  selectedFile: AgentFile | null;
  fileContent: string | null;

  // UI State
  isLoading: boolean;
  isSavingFile: boolean;
  error: string | null;
  showCreateModal: boolean;
  showEditModal: boolean;
  showDeleteModal: boolean;

  // Event subscription
  eventUnsubscribe: Unsubscribe | null;

  // Actions
  loadAgents: () => Promise<void>;
  selectAgent: (agentId: string) => void;
  createAgent: (name: string, workspace: string, emoji?: string) => Promise<boolean>;
  updateAgent: (agentId: string, updates: Partial<Agent>) => Promise<void>;
  deleteAgent: (agentId: string, deleteFiles: boolean) => Promise<void>;
  loadAgentFiles: (agentId: string) => Promise<void>;
  selectFile: (agentId: string, fileName: string) => Promise<void>;
  saveFile: (agentId: string, fileName: string, content: string) => Promise<void>;
  setShowCreateModal: (show: boolean) => void;
  setShowEditModal: (show: boolean) => void;
  setShowDeleteModal: (show: boolean) => void;
  subscribeToEvents: () => void;
  unsubscribeFromEvents: () => void;
  reset: () => void;
}

// ---- Store ----------------------------------------------------------------

export const useAgentsStore = create<AgentsState>((set, get) => ({
  // Initial state
  agents: [],
  selectedAgentId: null,
  agentFiles: [],
  selectedFile: null,
  fileContent: null,
  isLoading: false,
  isSavingFile: false,
  error: null,
  showCreateModal: false,
  showEditModal: false,
  showDeleteModal: false,
  eventUnsubscribe: null,

  loadAgents: async () => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ isLoading: true, error: null });

      const response = await request<AgentsListResult>('agents.list', {});

      const agents = (response.agents || []).map((agent) => {
        // Parse model field from gateway response — may be raw object
        const raw = agent as Agent & { model?: unknown };
        let model: AgentModel | undefined;
        if (raw.model && typeof raw.model === 'object') {
          const m = raw.model as unknown as Record<string, unknown>;
          if (typeof m.primary === 'string') {
            model = {
              primary: m.primary,
              fallbacks: Array.isArray(m.fallbacks)
                ? (m.fallbacks as unknown[]).filter((f): f is string => typeof f === 'string')
                : [],
            };
          }
        }
        return { ...agent, model };
      });

      set({
        agents,
        isLoading: false,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load agents';
      set({ error: errorMessage, isLoading: false });
      console.error('[Agents] Failed to load agents:', err);
    }
  },

  selectAgent: (agentId: string) => {
    set({ selectedAgentId: agentId, agentFiles: [], selectedFile: null, fileContent: null });
    get().loadAgentFiles(agentId);
  },

  createAgent: async (name: string, workspace: string, emoji?: string) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      await request('agents.create', {
        name,
        workspace,
        emoji,
      });

      // Reload agents
      get().loadAgents();
      set({ showCreateModal: false });
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create agent';
      set({ error: errorMessage });
      console.error('[Agents] Failed to create agent:', err);
      return false;
    }
  },

  updateAgent: async (agentId: string, updates: Partial<Agent>) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      await request('agents.update', {
        agentId,
        ...updates,
      });

      // Reload agents
      get().loadAgents();
      set({ showEditModal: false });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update agent';
      set({ error: errorMessage });
      console.error('[Agents] Failed to update agent:', err);
    }
  },

  deleteAgent: async (agentId: string, deleteFiles: boolean) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      await request('agents.delete', {
        agentId,
        deleteFiles,
      });

      // Clear selection if deleted agent was selected
      if (get().selectedAgentId === agentId) {
        set({ selectedAgentId: null, agentFiles: [], selectedFile: null, fileContent: null });
      }

      // Reload agents
      get().loadAgents();
      set({ showDeleteModal: false });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete agent';
      set({ error: errorMessage });
      console.error('[Agents] Failed to delete agent:', err);
    }
  },

  loadAgentFiles: async (agentId: string) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      const response = await request<{ files: AgentFile[] }>('agents.files.list', {
        agentId,
      });

      set({ agentFiles: response.files || [] });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load agent files';
      set({ error: errorMessage });
      console.error('[Agents] Failed to load agent files:', err);
    }
  },

  selectFile: async (agentId: string, fileName: string) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      const response = await request<{ file: AgentFile }>('agents.files.get', {
        agentId,
        name: fileName,
      });

      set({
        selectedFile: response.file,
        fileContent: response.file.content || '',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load file';
      set({ error: errorMessage });
      console.error('[Agents] Failed to load file:', err);
    }
  },

  saveFile: async (agentId: string, fileName: string, content: string) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ isSavingFile: true, error: null });

      await request('agents.files.set', {
        agentId,
        name: fileName,
        content,
      });

      // Reload files to update metadata
      get().loadAgentFiles(agentId);
      set({ isSavingFile: false });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save file';
      set({ error: errorMessage, isSavingFile: false });
      console.error('[Agents] Failed to save file:', err);
    }
  },

  setShowCreateModal: (show: boolean) => {
    set({ showCreateModal: show });
  },

  setShowEditModal: (show: boolean) => {
    set({ showEditModal: show });
  },

  setShowDeleteModal: (show: boolean) => {
    set({ showDeleteModal: show });
  },

  subscribeToEvents: () => {
    const { eventUnsubscribe } = get();

    if (eventUnsubscribe) {
      eventUnsubscribe();
    }

    (async () => {
      const { useConnectionStore } = await import('./connection');
      const { subscribe } = useConnectionStore.getState();

      const unsub = subscribe<AgentEventPayload>('agent', (payload) => {
        console.log('[Agents] Event received:', payload);

        // Reload agents on any agent event
        if (['created', 'updated', 'deleted'].includes(payload.type)) {
          get().loadAgents();
        }

        // Reload files if file changed for selected agent
        if (payload.type === 'file.changed' && payload.agentId === get().selectedAgentId) {
          get().loadAgentFiles(payload.agentId);
        }
      });

      set({ eventUnsubscribe: unsub });
    })();
  },

  unsubscribeFromEvents: () => {
    const { eventUnsubscribe } = get();
    if (eventUnsubscribe) {
      eventUnsubscribe();
      set({ eventUnsubscribe: null });
    }
  },

  reset: () => {
    const { unsubscribeFromEvents } = get();
    unsubscribeFromEvents();
    set({
      agents: [],
      selectedAgentId: null,
      agentFiles: [],
      selectedFile: null,
      fileContent: null,
      isLoading: false,
      isSavingFile: false,
      error: null,
      showCreateModal: false,
      showEditModal: false,
      showDeleteModal: false,
      eventUnsubscribe: null,
    });
  },
}));
