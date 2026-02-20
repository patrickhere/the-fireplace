// ---------------------------------------------------------------------------
// Plan Cache Store (Zustand) — Reuse execution plans for repetitive tasks
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import { toast } from 'sonner';
import {
  normalizeDescription,
  hashDescription,
  extractPlanSkeleton,
  descriptionSimilarity,
} from '@/lib/planExtraction';

// ---- Types ----------------------------------------------------------------

export interface CachedPlan {
  hash: string;
  normalizedDescription: string;
  skeleton: string;
  usageCount: number;
  lastUsedAt: number;
  createdAt: number;
  assignedTo: string;
}

interface PlanCacheState {
  plans: CachedPlan[];
  isLoaded: boolean;

  // Actions
  loadFromDisk: () => Promise<void>;
  saveToDisk: () => Promise<void>;
  cachePlan: (description: string, chatText: string, assignedTo: string) => void;
  findPlan: (description: string) => CachedPlan | null;
  markUsed: (hash: string) => void;
  removePlan: (hash: string) => void;
  clearAll: () => void;
  getStats: () => { totalPlans: number; totalReuses: number };
}

// ---- Constants ------------------------------------------------------------

const MAX_CACHED_PLANS = 50;
const SIMILARITY_THRESHOLD = 0.6;
const STORE_KEY = 'plan-cache';

// ---- Store ----------------------------------------------------------------

export const usePlanCacheStore = create<PlanCacheState>((set, get) => ({
  plans: [],
  isLoaded: false,

  loadFromDisk: async () => {
    try {
      const { load } = await import('@tauri-apps/plugin-store');
      const store = await load('plan-cache.json');
      const cached = await store.get<CachedPlan[]>(STORE_KEY);
      if (cached && Array.isArray(cached)) {
        set({ plans: cached, isLoaded: true });
      } else {
        set({ isLoaded: true });
      }
    } catch {
      // plugin-store unavailable (e.g. web dev), just mark loaded
      set({ isLoaded: true });
    }
  },

  saveToDisk: async () => {
    try {
      const { load } = await import('@tauri-apps/plugin-store');
      const store = await load('plan-cache.json');
      await store.set(STORE_KEY, get().plans);
      await store.save();
    } catch {
      // Silent failure — persistence is best-effort
    }
  },

  cachePlan: (description: string, chatText: string, assignedTo: string) => {
    const skeleton = extractPlanSkeleton(chatText);
    if (!skeleton) return; // No plan structure found

    const normalized = normalizeDescription(description);
    if (normalized.length < 5) return; // Too vague to cache

    const hash = hashDescription(normalized);

    const { plans } = get();
    const existing = plans.find((p) => p.hash === hash);

    if (existing) {
      // Update existing plan with newer skeleton
      set({
        plans: plans.map((p) =>
          p.hash === hash
            ? { ...p, skeleton, lastUsedAt: Date.now(), usageCount: p.usageCount + 1 }
            : p
        ),
      });
    } else {
      const newPlan: CachedPlan = {
        hash,
        normalizedDescription: normalized,
        skeleton,
        usageCount: 0,
        lastUsedAt: Date.now(),
        createdAt: Date.now(),
        assignedTo,
      };

      let updated = [...plans, newPlan];

      // Evict oldest/least-used if over limit
      if (updated.length > MAX_CACHED_PLANS) {
        updated.sort((a, b) => {
          // Score: usage count * recency factor
          const scoreA = a.usageCount * (a.lastUsedAt / Date.now());
          const scoreB = b.usageCount * (b.lastUsedAt / Date.now());
          return scoreB - scoreA;
        });
        updated = updated.slice(0, MAX_CACHED_PLANS);
      }

      set({ plans: updated });
    }

    // Persist asynchronously
    void get().saveToDisk();
  },

  findPlan: (description: string): CachedPlan | null => {
    const { plans } = get();
    if (plans.length === 0) return null;

    const normalized = normalizeDescription(description);
    const hash = hashDescription(normalized);

    // Exact match first
    const exact = plans.find((p) => p.hash === hash);
    if (exact) return exact;

    // Fuzzy match — find the most similar plan above threshold
    let bestMatch: CachedPlan | null = null;
    let bestScore = 0;

    for (const plan of plans) {
      const score = descriptionSimilarity(normalized, plan.normalizedDescription);
      if (score > SIMILARITY_THRESHOLD && score > bestScore) {
        bestScore = score;
        bestMatch = plan;
      }
    }

    return bestMatch;
  },

  markUsed: (hash: string) => {
    set((state) => ({
      plans: state.plans.map((p) =>
        p.hash === hash ? { ...p, usageCount: p.usageCount + 1, lastUsedAt: Date.now() } : p
      ),
    }));
    void get().saveToDisk();
  },

  removePlan: (hash: string) => {
    set((state) => ({
      plans: state.plans.filter((p) => p.hash !== hash),
    }));
    void get().saveToDisk();
    toast.success('Plan removed from cache');
  },

  clearAll: () => {
    set({ plans: [] });
    void get().saveToDisk();
    toast.success('Plan cache cleared');
  },

  getStats: () => {
    const { plans } = get();
    return {
      totalPlans: plans.length,
      totalReuses: plans.reduce((sum, p) => sum + p.usageCount, 0),
    };
  },
}));
