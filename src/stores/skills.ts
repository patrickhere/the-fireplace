// ---------------------------------------------------------------------------
// Skills Store (Zustand)
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import type { Unsubscribe } from '@/gateway/types';

// ---- Skill Types ----------------------------------------------------------

export interface Skill {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  installed: boolean;
  description?: string;
  author?: string;
  repository?: string;
  homepage?: string;
  config?: Record<string, unknown>;
  installedAt?: number;
  updatedAt?: number;
  capabilities?: string[];
  dependencies?: string[];
}

// ---- Event Payload Types --------------------------------------------------

export interface SkillEventPayload {
  skillId: string;
  type: 'installed' | 'updated' | 'uninstalled' | 'enabled' | 'disabled';
  timestamp: number;
}

// ---- Store Types ----------------------------------------------------------

interface SkillsState {
  // Data
  skills: Skill[];
  selectedSkill: Skill | null;

  // UI State
  isLoading: boolean;
  error: string | null;
  showInstallModal: boolean;
  showConfigModal: boolean;

  // Event subscription
  eventUnsubscribe: Unsubscribe | null;

  // Actions
  loadSkills: () => Promise<void>;
  installSkill: (id: string, version?: string) => Promise<void>;
  uninstallSkill: (id: string) => Promise<void>;
  enableSkill: (id: string) => Promise<void>;
  disableSkill: (id: string) => Promise<void>;
  updateSkill: (id: string, version?: string) => Promise<void>;
  configureSkill: (id: string, config: Record<string, unknown>) => Promise<void>;
  setSelectedSkill: (skill: Skill | null) => void;
  setShowInstallModal: (show: boolean) => void;
  setShowConfigModal: (show: boolean) => void;
  subscribeToEvents: () => void;
  unsubscribeFromEvents: () => void;
  reset: () => void;
}

// ---- Store ----------------------------------------------------------------

export const useSkillsStore = create<SkillsState>((set, get) => ({
  // Initial state
  skills: [],
  selectedSkill: null,
  isLoading: false,
  error: null,
  showInstallModal: false,
  showConfigModal: false,
  eventUnsubscribe: null,

  loadSkills: async () => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ isLoading: true, error: null });

      const response = await request<{ skills: Skill[] }>('skills.list', {
        includeConfig: true,
      });

      set({
        skills: response.skills || [],
        isLoading: false,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load skills';
      set({ error: errorMessage, isLoading: false });
      console.error('[Skills] Failed to load skills:', err);
    }
  },

  installSkill: async (id: string, version?: string) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      await request('skills.install', {
        id,
        version,
      });

      // Reload skills
      get().loadSkills();
      set({ showInstallModal: false });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to install skill';
      set({ error: errorMessage });
      console.error('[Skills] Failed to install skill:', err);
    }
  },

  uninstallSkill: async (id: string) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      await request('skills.uninstall', {
        id,
      });

      // Remove from local state
      set((state) => ({
        skills: state.skills.filter((skill) => skill.id !== id),
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to uninstall skill';
      set({ error: errorMessage });
      console.error('[Skills] Failed to uninstall skill:', err);
    }
  },

  enableSkill: async (id: string) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      await request('skills.enable', {
        id,
      });

      // Update local state
      set((state) => ({
        skills: state.skills.map((skill) =>
          skill.id === id ? { ...skill, enabled: true } : skill
        ),
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to enable skill';
      set({ error: errorMessage });
      console.error('[Skills] Failed to enable skill:', err);
    }
  },

  disableSkill: async (id: string) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      await request('skills.disable', {
        id,
      });

      // Update local state
      set((state) => ({
        skills: state.skills.map((skill) =>
          skill.id === id ? { ...skill, enabled: false } : skill
        ),
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to disable skill';
      set({ error: errorMessage });
      console.error('[Skills] Failed to disable skill:', err);
    }
  },

  updateSkill: async (id: string, version?: string) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      await request('skills.update', {
        id,
        version,
      });

      // Reload skills
      get().loadSkills();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update skill';
      set({ error: errorMessage });
      console.error('[Skills] Failed to update skill:', err);
    }
  },

  configureSkill: async (id: string, config: Record<string, unknown>) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      await request('skills.configure', {
        id,
        config,
      });

      // Update local state
      set((state) => ({
        skills: state.skills.map((skill) => (skill.id === id ? { ...skill, config } : skill)),
      }));

      set({ showConfigModal: false });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to configure skill';
      set({ error: errorMessage });
      console.error('[Skills] Failed to configure skill:', err);
    }
  },

  setSelectedSkill: (skill: Skill | null) => {
    set({ selectedSkill: skill });
  },

  setShowInstallModal: (show: boolean) => {
    set({ showInstallModal: show });
  },

  setShowConfigModal: (show: boolean) => {
    set({ showConfigModal: show });
  },

  subscribeToEvents: () => {
    const { eventUnsubscribe } = get();

    if (eventUnsubscribe) {
      eventUnsubscribe();
    }

    (async () => {
      const { useConnectionStore } = await import('./connection');
      const { subscribe } = useConnectionStore.getState();

      const unsub = subscribe<SkillEventPayload>('skill', (payload) => {
        console.log('[Skills] Skill event:', payload);

        // Reload skills on any skill event
        if (['installed', 'updated', 'uninstalled', 'enabled', 'disabled'].includes(payload.type)) {
          get().loadSkills();
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
      skills: [],
      selectedSkill: null,
      isLoading: false,
      error: null,
      showInstallModal: false,
      showConfigModal: false,
      eventUnsubscribe: null,
    });
  },
}));
