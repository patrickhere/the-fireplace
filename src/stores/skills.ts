// ---------------------------------------------------------------------------
// Skills Store (Zustand)
// ---------------------------------------------------------------------------

import { create } from 'zustand';

// ---- Skill Types ----------------------------------------------------------

export interface SkillStatus {
  key: string;
  name: string;
  enabled: boolean;
  installed: boolean;
  version?: string;
  description?: string;
  apiKey?: string;
  env?: Record<string, string>;
  error?: string;
}

interface SkillsState {
  // Data
  skills: SkillStatus[];
  bins: string[];

  // UI State
  isLoading: boolean;
  error: string | null;

  // Actions
  loadSkills: (agentId?: string) => Promise<void>;
  loadBins: () => Promise<void>;
  installSkill: (name: string, installId: string) => Promise<void>;
  updateSkill: (
    skillKey: string,
    update: { enabled?: boolean; apiKey?: string; env?: Record<string, string> }
  ) => Promise<void>;
  reset: () => void;
}

// ---- Store ----------------------------------------------------------------

export const useSkillsStore = create<SkillsState>((set, get) => ({
  skills: [],
  bins: [],
  isLoading: false,
  error: null,

  loadSkills: async (agentId?: string) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ isLoading: true, error: null });

      const response = await request<{ skills: SkillStatus[] }>('skills.status', {
        agentId,
      });

      set({
        skills: response.skills ?? [],
        isLoading: false,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load skills';
      set({ error: errorMessage, isLoading: false });
      console.error('[Skills] Failed to load:', err);
    }
  },

  loadBins: async () => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      const response = await request<{ bins: string[] }>('skills.bins', {});

      set({ bins: response.bins ?? [] });
    } catch (err) {
      console.error('[Skills] Failed to load bins:', err);
    }
  },

  installSkill: async (name: string, installId: string) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      await request('skills.install', {
        name,
        installId,
        timeoutMs: 60000,
      });

      // Reload skills after install
      get().loadSkills();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to install skill';
      set({ error: errorMessage });
      console.error('[Skills] Failed to install:', err);
    }
  },

  updateSkill: async (
    skillKey: string,
    update: { enabled?: boolean; apiKey?: string; env?: Record<string, string> }
  ) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      await request('skills.update', {
        skillKey,
        ...update,
      });

      // Reload skills after update
      get().loadSkills();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update skill';
      set({ error: errorMessage });
      console.error('[Skills] Failed to update:', err);
    }
  },

  reset: () => {
    set({
      skills: [],
      bins: [],
      isLoading: false,
      error: null,
    });
  },
}));
