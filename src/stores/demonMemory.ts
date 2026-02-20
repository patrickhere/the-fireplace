import { create } from 'zustand';
import { toast } from 'sonner';

export interface MemoryEntry {
  date: string;
  content: string;
  lastModified?: number;
}

export interface SharedKnowledgeEntry {
  topic: string;
  content: string;
  lastModified?: number;
}

interface DemonMemoryState {
  selectedDemon: string | null;
  entries: MemoryEntry[];
  currentEntry: MemoryEntry | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // Shared knowledge (D2)
  sharedEntries: SharedKnowledgeEntry[];
  currentShared: SharedKnowledgeEntry | null;
  activeTab: 'daily' | 'shared';

  selectDemon: (demonId: string) => void;
  loadEntries: (demonId: string) => Promise<void>;
  loadEntry: (demonId: string, date: string) => Promise<void>;
  saveEntry: (demonId: string, date: string, content: string) => Promise<void>;
  createTodayEntry: (demonId: string) => Promise<void>;
  setActiveTab: (tab: 'daily' | 'shared') => void;
  loadSharedEntries: () => Promise<void>;
  loadSharedEntry: (topic: string) => Promise<void>;
  saveSharedEntry: (topic: string, content: string) => Promise<void>;
  shareToKnowledge: (topic: string, content: string) => Promise<void>;
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildTodayTemplate(date: string): string {
  return `# Daily Memory — ${date}\n\n## Summary\n\n## Key Events\n\n## Decisions Made\n\n## Open Questions\n`;
}

export const useDemonMemoryStore = create<DemonMemoryState>((set, get) => ({
  selectedDemon: null,
  entries: [],
  currentEntry: null,
  isLoading: false,
  isSaving: false,
  error: null,
  sharedEntries: [],
  currentShared: null,
  activeTab: 'daily',

  selectDemon: (demonId: string) => {
    set({ selectedDemon: demonId, entries: [], currentEntry: null });
  },

  loadEntries: async (demonId: string) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ isLoading: true, error: null });

      const response = await request<{
        files: Array<{ name: string; path: string; updatedAtMs?: number }>;
      }>('agents.files.list', { agentId: demonId });

      const files = response.files ?? [];
      const dailyFiles = files.filter(
        (f) => f.path.startsWith('memory/daily/') && f.name.endsWith('.md')
      );

      const entries: MemoryEntry[] = dailyFiles
        .map((f) => {
          const date = f.name.replace(/\.md$/, '');
          return { date, content: '', lastModified: f.updatedAtMs };
        })
        .filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date))
        .sort((a, b) => b.date.localeCompare(a.date));

      set({ entries, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load memory entries';
      set({ error: message, isLoading: false });
      toast.error(message);
      console.error('[DemonMemory] Failed to load entries:', err);
    }
  },

  loadEntry: async (demonId: string, date: string) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ isLoading: true, error: null });

      const response = await request<{ file: { content?: string; updatedAtMs?: number } }>(
        'agents.files.get',
        { agentId: demonId, name: `memory/daily/${date}.md` }
      );

      const content = response.file?.content ?? '';
      const lastModified = response.file?.updatedAtMs;

      set({
        currentEntry: { date, content, lastModified },
        isLoading: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load memory entry';
      set({ error: message, isLoading: false });
      toast.error(message);
      console.error('[DemonMemory] Failed to load entry:', err);
    }
  },

  saveEntry: async (demonId: string, date: string, content: string) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ isSaving: true, error: null });

      await request('agents.files.set', {
        agentId: demonId,
        name: `memory/daily/${date}.md`,
        content,
      });

      set((state) => ({
        isSaving: false,
        currentEntry: state.currentEntry ? { ...state.currentEntry, content } : null,
        entries: state.entries.some((e) => e.date === date)
          ? state.entries.map((e) => (e.date === date ? { ...e, content } : e))
          : [{ date, content }, ...state.entries].sort((a, b) => b.date.localeCompare(a.date)),
      }));

      toast.success('Memory saved');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save memory entry';
      set({ error: message, isSaving: false });
      toast.error(message);
      console.error('[DemonMemory] Failed to save entry:', err);
    }
  },

  createTodayEntry: async (demonId: string) => {
    const date = todayDateString();
    const content = buildTodayTemplate(date);

    set((state) => {
      const alreadyExists = state.entries.some((e) => e.date === date);
      const entries = alreadyExists ? state.entries : [{ date, content }, ...state.entries];
      return { currentEntry: { date, content }, entries };
    });

    await get().saveEntry(demonId, date, content);
  },

  setActiveTab: (tab: 'daily' | 'shared') => {
    set({ activeTab: tab, currentEntry: null, currentShared: null });
  },

  loadSharedEntries: async () => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    // Shared knowledge lives in the orchestrator workspace (calcifer)
    try {
      set({ isLoading: true, error: null });

      const response = await request<{
        files: Array<{ name: string; path: string; updatedAtMs?: number }>;
      }>('agents.files.list', { agentId: 'calcifer' });

      const files = response.files ?? [];
      const sharedFiles = files.filter(
        (f) => f.path.startsWith('memory/shared/') && f.name.endsWith('.md')
      );

      const sharedEntries: SharedKnowledgeEntry[] = sharedFiles.map((f) => ({
        topic: f.name.replace(/\.md$/, ''),
        content: '',
        lastModified: f.updatedAtMs,
      }));

      set({ sharedEntries, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load shared knowledge';
      set({ error: message, isLoading: false });
      toast.error(message);
    }
  },

  loadSharedEntry: async (topic: string) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ isLoading: true, error: null });

      const response = await request<{ file: { content?: string; updatedAtMs?: number } }>(
        'agents.files.get',
        { agentId: 'calcifer', name: `memory/shared/${topic}.md` }
      );

      const content = response.file?.content ?? '';
      set({
        currentShared: { topic, content, lastModified: response.file?.updatedAtMs },
        isLoading: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load shared entry';
      set({ error: message, isLoading: false });
      toast.error(message);
    }
  },

  saveSharedEntry: async (topic: string, content: string) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ isSaving: true, error: null });

      await request('agents.files.set', {
        agentId: 'calcifer',
        name: `memory/shared/${topic}.md`,
        content,
      });

      set((state) => ({
        isSaving: false,
        currentShared: state.currentShared ? { ...state.currentShared, content } : null,
        sharedEntries: state.sharedEntries.some((e) => e.topic === topic)
          ? state.sharedEntries.map((e) => (e.topic === topic ? { ...e, content } : e))
          : [...state.sharedEntries, { topic, content }],
      }));

      toast.success('Shared knowledge saved');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save shared entry';
      set({ error: message, isSaving: false });
      toast.error(message);
    }
  },

  shareToKnowledge: async (topic: string, content: string) => {
    const existing = get().currentShared;
    const existingContent = existing?.topic === topic ? existing.content : '';
    const merged = existingContent ? `${existingContent}\n\n---\n\n${content}` : content;
    await get().saveSharedEntry(topic, merged);
  },
}));
