// ---------------------------------------------------------------------------
// Demon Observability Store (Zustand)
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import type { Unsubscribe } from '@/gateway/types';
import type { ChatEventPayload } from '@/stores/chat';

// ---- Types ----------------------------------------------------------------

export interface LatencySample {
  timestamp: number;
  latencyMs: number;
  model: string;
}

export interface ActivityBucket {
  startMs: number;
  requests: number;
  errors: number;
  tokens: number;
}

export interface DemonObservabilityData {
  demonId: string;
  demonName: string;
  demonEmoji: string;
  totalRequests: number;
  totalErrors: number;
  totalSuccesses: number;
  totalTokens: number;
  latencySamples: LatencySample[];
  activityBuckets: ActivityBucket[];
}

// ---- Constants ------------------------------------------------------------

const MAX_LATENCY_SAMPLES = 100;
const BUCKET_DURATION_MS = 5 * 60 * 1000;
const MAX_BUCKETS = 288; // 24h worth of 5-min buckets

// ---- Helpers --------------------------------------------------------------

function getBucketStart(ms: number): number {
  return Math.floor(ms / BUCKET_DURATION_MS) * BUCKET_DURATION_MS;
}

function findOrCreateBucket(buckets: ActivityBucket[], now: number): ActivityBucket[] {
  const start = getBucketStart(now);
  const existing = buckets.find((b) => b.startMs === start);
  if (existing) return buckets;
  const next = [...buckets, { startMs: start, requests: 0, errors: 0, tokens: 0 }];
  if (next.length > MAX_BUCKETS) {
    next.sort((a, b) => a.startMs - b.startMs);
    return next.slice(next.length - MAX_BUCKETS);
  }
  return next;
}

function updateBucket(
  buckets: ActivityBucket[],
  now: number,
  delta: Partial<Omit<ActivityBucket, 'startMs'>>
): ActivityBucket[] {
  const start = getBucketStart(now);
  return buckets.map((b) => {
    if (b.startMs !== start) return b;
    return {
      ...b,
      requests: b.requests + (delta.requests ?? 0),
      errors: b.errors + (delta.errors ?? 0),
      tokens: b.tokens + (delta.tokens ?? 0),
    };
  });
}

// ---- State Interface ------------------------------------------------------

interface DemonObservabilityState {
  demons: DemonObservabilityData[];
  isTracking: boolean;
  _unsub: Unsubscribe | null;
  startTracking: () => void;
  stopTracking: () => void;
}

// ---- Store ----------------------------------------------------------------

export const useDemonObservabilityStore = create<DemonObservabilityState>((set, get) => ({
  demons: [],
  isTracking: false,
  _unsub: null,

  startTracking: () => {
    const { isTracking } = get();
    if (isTracking) return;

    set({ isTracking: true });

    (async () => {
      try {
        const { useConnectionStore } = await import('./connection');
        const { useAgentsStore } = await import('./agents');
        const { subscribe } = useConnectionStore.getState();

        // Initialize demons from agents store
        const { agents } = useAgentsStore.getState();
        const source =
          agents.length > 0
            ? agents
            : await useAgentsStore
                .getState()
                .loadAgents()
                .then(() => useAgentsStore.getState().agents);

        set({
          demons: source.map((agent) => ({
            demonId: agent.id,
            demonName: agent.identity?.name ?? agent.name ?? agent.id,
            demonEmoji: agent.identity?.emoji ?? '',
            totalRequests: 0,
            totalErrors: 0,
            totalSuccesses: 0,
            totalTokens: 0,
            latencySamples: [],
            activityBuckets: [],
          })),
        });

        // Track per-session request start times for latency calculation
        const sessionStartTimes = new Map<string, number>();

        const unsub = subscribe<ChatEventPayload>('chat', (payload) => {
          const { demons } = get();
          const { agents: currentAgents } = useAgentsStore.getState();

          const matchedAgent =
            currentAgents.find(
              (a) =>
                payload.sessionKey === a.id ||
                payload.sessionKey.startsWith(a.id + ':') ||
                payload.sessionKey.startsWith(a.id + '/')
            ) ??
            currentAgents.find(
              (a) =>
                a.identity?.name &&
                payload.sessionKey.toLowerCase().includes(a.identity.name.toLowerCase())
            );

          if (!matchedAgent) return;
          const agentId = matchedAgent.id;

          const demon = demons.find((d) => d.demonId === agentId);
          if (!demon) return;

          const now = Date.now();
          const sessionKey = payload.sessionKey;
          const rawPayload = payload as unknown as Record<string, unknown>;
          const tokenInc = rawPayload.tokens ? Number(rawPayload.tokens) : 0;
          const isError = !!(payload.error ?? payload.state === 'error');
          const isDone = !!(
            payload.done ??
            (payload.state === 'final' || payload.state === 'aborted')
          );
          const isDelta = !!(payload.delta ?? payload.state === 'delta');

          // First delta for this session: record request start time
          if (isDelta && !sessionStartTimes.has(sessionKey)) {
            sessionStartTimes.set(sessionKey, now);
          }

          let latencyInc: LatencySample | null = null;
          let successInc = 0;
          let errorInc = 0;
          let requestInc = 0;

          if (isDone) {
            const startTime = sessionStartTimes.get(sessionKey);
            if (startTime !== undefined) {
              const latencyMs = now - startTime;
              latencyInc = { timestamp: now, latencyMs, model: '' };
              sessionStartTimes.delete(sessionKey);
            }
            successInc = 1;
            requestInc = 1;
          } else if (isError) {
            sessionStartTimes.delete(sessionKey);
            errorInc = 1;
            requestInc = 1;
          }

          set((state) => {
            const updated = state.demons.map((d) => {
              if (d.demonId !== agentId) return d;

              let { latencySamples, activityBuckets } = d;

              if (latencyInc) {
                const next = [...latencySamples, latencyInc];
                latencySamples =
                  next.length > MAX_LATENCY_SAMPLES
                    ? next.slice(next.length - MAX_LATENCY_SAMPLES)
                    : next;
              }

              if (requestInc > 0 || tokenInc > 0) {
                activityBuckets = findOrCreateBucket(activityBuckets, now);
                activityBuckets = updateBucket(activityBuckets, now, {
                  requests: requestInc,
                  errors: errorInc,
                  tokens: tokenInc,
                });
              } else if (tokenInc > 0) {
                activityBuckets = findOrCreateBucket(activityBuckets, now);
                activityBuckets = updateBucket(activityBuckets, now, { tokens: tokenInc });
              }

              return {
                ...d,
                totalRequests: d.totalRequests + requestInc,
                totalErrors: d.totalErrors + errorInc,
                totalSuccesses: d.totalSuccesses + successInc,
                totalTokens: d.totalTokens + tokenInc,
                latencySamples,
                activityBuckets,
              };
            });

            return { demons: updated };
          });
        });

        set({ _unsub: unsub });
      } catch (err) {
        console.error('[DemonObservability] Failed to start tracking:', err);
        set({ isTracking: false, _unsub: null });
      }
    })();
  },

  stopTracking: () => {
    const { _unsub } = get();
    _unsub?.();
    set({ isTracking: false, _unsub: null });
  },
}));
