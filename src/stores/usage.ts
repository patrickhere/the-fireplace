// ---------------------------------------------------------------------------
// Usage Store (Zustand)
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import { classifyModel } from '@/lib/modelTiers';

// ---- Usage Types ----------------------------------------------------------

export interface UsageData {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  activeSessions: number;
}

export interface SessionUsageEntry {
  sessionKey: string;
  name: string;
  model: string;
  agentId: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  lastActivity: number;
}

export interface DemonUsageEntry {
  demonId: string;
  demonName: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  model: string;
  sessionCount: number;
}

export interface ModelDistributionEntry {
  tier: string;
  tokenCount: number;
  percentage: number;
}

// ---- Helpers --------------------------------------------------------------

function buildDemonUsage(
  sessions: SessionUsageEntry[],
  agents: Array<{ id: string; identity?: { name?: string; emoji?: string } }>
): DemonUsageEntry[] {
  const agentMap = new Map(agents.map((a) => [a.id, a]));
  const grouped = new Map<string, DemonUsageEntry>();

  for (const s of sessions) {
    if (!s.agentId) continue;
    const existing = grouped.get(s.agentId);
    if (existing) {
      existing.totalTokens += s.totalTokens;
      existing.inputTokens += s.inputTokens;
      existing.outputTokens += s.outputTokens;
      existing.sessionCount += 1;
      // Use the model from the session with highest tokens
      if (s.totalTokens > 0 && !existing.model) {
        existing.model = s.model;
      }
    } else {
      const agent = agentMap.get(s.agentId);
      const emoji = agent?.identity?.emoji ?? '';
      const name = agent?.identity?.name ?? s.agentId;
      grouped.set(s.agentId, {
        demonId: s.agentId,
        demonName: emoji ? `${emoji} ${name}` : name,
        totalTokens: s.totalTokens,
        inputTokens: s.inputTokens,
        outputTokens: s.outputTokens,
        model: s.model,
        sessionCount: 1,
      });
    }
  }

  return Array.from(grouped.values()).sort((a, b) => b.totalTokens - a.totalTokens);
}

function buildModelDistribution(sessions: SessionUsageEntry[]): ModelDistributionEntry[] {
  const tierMap = new Map<string, number>();
  let total = 0;

  for (const s of sessions) {
    const info = classifyModel(s.model);
    const label = info.label;
    tierMap.set(label, (tierMap.get(label) ?? 0) + s.totalTokens);
    total += s.totalTokens;
  }

  if (total === 0) return [];

  return Array.from(tierMap.entries())
    .map(([tier, tokenCount]) => ({
      tier,
      tokenCount,
      percentage: Math.round((tokenCount / total) * 100),
    }))
    .sort((a, b) => b.tokenCount - a.tokenCount);
}

// ---- Store Types ----------------------------------------------------------

interface UsageState {
  // Data
  usage: UsageData | null;
  sessionUsage: SessionUsageEntry[];
  demonUsage: DemonUsageEntry[];
  modelDistribution: ModelDistributionEntry[];

  // UI State
  isLoading: boolean;
  error: string | null;

  // Actions
  loadUsage: () => Promise<void>;
  loadSessionUsage: () => Promise<void>;
  loadAll: () => Promise<void>;
  reset: () => void;
}

// ---- Store ----------------------------------------------------------------

export const useUsageStore = create<UsageState>((set) => ({
  usage: null,
  sessionUsage: [],
  demonUsage: [],
  modelDistribution: [],
  isLoading: false,
  error: null,

  loadUsage: async () => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ isLoading: true, error: null });

      const response = await request<{
        totalInputTokens?: number;
        totalOutputTokens?: number;
        totalTokens?: number;
        estimatedCostUsd?: number;
        activeSessions?: number;
      }>('sessions.usage', {});

      set({
        usage: {
          totalInputTokens: response.totalInputTokens ?? 0,
          totalOutputTokens: response.totalOutputTokens ?? 0,
          totalTokens: response.totalTokens ?? 0,
          estimatedCostUsd: response.estimatedCostUsd ?? 0,
          activeSessions: response.activeSessions ?? 0,
        },
        isLoading: false,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load usage';
      set({ error: errorMessage, isLoading: false });
      console.error('[Usage] Failed to load:', err);
    }
  },

  loadSessionUsage: async () => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ isLoading: true, error: null });

      // Use sessions.list for metadata and sessions.usage for token counts.
      // sessions.list does NOT return token data; sessions.usage does.
      const [listRes, usageRes] = await Promise.all([
        request<{
          sessions: Array<{
            key: string;
            name?: string;
            label?: string;
            derivedTitle?: string;
            model?: string;
            agentId?: string;
            lastActive?: number;
            ts?: number;
          }>;
        }>('sessions.list', { includeDerivedTitles: true }),
        request<{
          sessions?: Array<{
            key?: string;
            sessionKey?: string;
            inputTokens?: number;
            outputTokens?: number;
            totalTokens?: number;
          }>;
        }>('sessions.usage', {}),
      ]);

      const sessions = listRes.sessions ?? [];
      const usageSessions = usageRes.sessions ?? [];

      // Build a map of session key -> token data from sessions.usage
      const usageMap = new Map<
        string,
        { inputTokens: number; outputTokens: number; totalTokens: number }
      >();
      for (const u of usageSessions) {
        const key = u.key ?? u.sessionKey;
        if (key) {
          usageMap.set(key, {
            inputTokens: u.inputTokens ?? 0,
            outputTokens: u.outputTokens ?? 0,
            totalTokens: u.totalTokens ?? (u.inputTokens ?? 0) + (u.outputTokens ?? 0),
          });
        }
      }

      const sessionUsage: SessionUsageEntry[] = sessions
        .map((s) => {
          const usage = usageMap.get(s.key);
          return {
            sessionKey: s.key,
            name: s.derivedTitle ?? s.name ?? s.label ?? s.key,
            model: s.model ?? 'unknown',
            agentId: s.agentId ?? '',
            inputTokens: usage?.inputTokens ?? 0,
            outputTokens: usage?.outputTokens ?? 0,
            totalTokens: usage?.totalTokens ?? 0,
            lastActivity: s.lastActive ?? s.ts ?? 0,
          };
        })
        .sort((a, b) => b.totalTokens - a.totalTokens);

      set({ sessionUsage, isLoading: false });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load session usage';
      set({ error: errorMessage, isLoading: false });
      console.error('[Usage] Failed to load session usage:', err);
    }
  },

  loadAll: async () => {
    const { useConnectionStore } = await import('./connection');
    const { useAgentsStore } = await import('./agents');
    const { request } = useConnectionStore.getState();

    try {
      set({ isLoading: true, error: null });

      // Load aggregate usage, session list (metadata), and per-session usage in parallel.
      // sessions.list does NOT return token counts — sessions.usage does.
      const [usageRes, sessionsRes, perSessionRes] = await Promise.all([
        request<{
          totalInputTokens?: number;
          totalOutputTokens?: number;
          totalTokens?: number;
          estimatedCostUsd?: number;
          activeSessions?: number;
        }>('sessions.usage', {}),
        request<{
          sessions: Array<{
            key: string;
            name?: string;
            label?: string;
            derivedTitle?: string;
            model?: string;
            agentId?: string;
            lastActive?: number;
            ts?: number;
          }>;
        }>('sessions.list', { includeDerivedTitles: true }),
        request<{
          sessions?: Array<{
            key?: string;
            sessionKey?: string;
            inputTokens?: number;
            outputTokens?: number;
            totalTokens?: number;
          }>;
        }>('sessions.usage', {}),
      ]);

      const sessions = sessionsRes.sessions ?? [];
      const perSessionUsage = perSessionRes.sessions ?? [];

      // Build a map of session key -> token data
      const usageMap = new Map<
        string,
        { inputTokens: number; outputTokens: number; totalTokens: number }
      >();
      for (const u of perSessionUsage) {
        const key = u.key ?? u.sessionKey;
        if (key) {
          usageMap.set(key, {
            inputTokens: u.inputTokens ?? 0,
            outputTokens: u.outputTokens ?? 0,
            totalTokens: u.totalTokens ?? (u.inputTokens ?? 0) + (u.outputTokens ?? 0),
          });
        }
      }

      const sessionUsage: SessionUsageEntry[] = sessions
        .map((s) => {
          const usage = usageMap.get(s.key);
          return {
            sessionKey: s.key,
            name: s.derivedTitle ?? s.name ?? s.label ?? s.key,
            model: s.model ?? 'unknown',
            agentId: s.agentId ?? '',
            inputTokens: usage?.inputTokens ?? 0,
            outputTokens: usage?.outputTokens ?? 0,
            totalTokens: usage?.totalTokens ?? 0,
            lastActivity: s.lastActive ?? s.ts ?? 0,
          };
        })
        .sort((a, b) => b.totalTokens - a.totalTokens);

      // Build demon usage and model distribution from session data
      const { agents } = useAgentsStore.getState();
      const demonUsage = buildDemonUsage(sessionUsage, agents);
      const modelDistribution = buildModelDistribution(sessionUsage);

      set({
        usage: {
          totalInputTokens: usageRes.totalInputTokens ?? 0,
          totalOutputTokens: usageRes.totalOutputTokens ?? 0,
          totalTokens: usageRes.totalTokens ?? 0,
          estimatedCostUsd: usageRes.estimatedCostUsd ?? 0,
          activeSessions: usageRes.activeSessions ?? 0,
        },
        sessionUsage,
        demonUsage,
        modelDistribution,
        isLoading: false,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load usage data';
      set({ error: errorMessage, isLoading: false });
      console.error('[Usage] Failed to load all:', err);
    }
  },

  reset: () => {
    set({
      usage: null,
      sessionUsage: [],
      demonUsage: [],
      modelDistribution: [],
      isLoading: false,
      error: null,
    });
  },
}));
