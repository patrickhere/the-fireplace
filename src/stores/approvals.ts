// ---------------------------------------------------------------------------
// Exec Approvals Store (Zustand)
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import type { Unsubscribe } from '@/gateway/types';

// ---- Types ----------------------------------------------------------------

export interface ExecApprovalRequest {
  id?: string;
  command: string;
  cwd?: string;
  host?: string;
  security?: string;
  ask?: string;
  agentId?: string;
  resolvedPath?: string;
  sessionKey?: string;
  timeoutMs?: number;
  twoPhase?: boolean;
  receivedAt: number;
}

export interface ExecApprovalPattern {
  pattern: string;
  allow: boolean;
  note?: string;
}

export interface ExecApprovalsAgentOverride {
  agentId: string;
  patterns: ExecApprovalPattern[];
}

export interface ExecApprovalsFile {
  version: number;
  defaults: ExecApprovalPattern[];
  agents: Record<string, ExecApprovalPattern[]>;
}

export interface ExecApprovalsSnapshot {
  path: string;
  exists: boolean;
  hash: string;
  file: ExecApprovalsFile;
}

// ---- Store Types ----------------------------------------------------------

interface ApprovalsState {
  // Data
  snapshot: ExecApprovalsSnapshot | null;
  pendingRequests: ExecApprovalRequest[];

  // UI State
  isLoading: boolean;
  error: string | null;

  // Event subscription
  eventUnsubscribe: Unsubscribe | null;

  // Actions
  loadApprovals: () => Promise<void>;
  saveApprovals: (file: ExecApprovalsFile, baseHash?: string) => Promise<void>;
  resolveApproval: (id: string, decision: 'approve' | 'deny') => Promise<void>;
  subscribeToEvents: () => void;
  unsubscribeFromEvents: () => void;
  removePendingRequest: (id: string) => void;
  reset: () => void;
}

// ---- Store ----------------------------------------------------------------

export const useApprovalsStore = create<ApprovalsState>((set, get) => ({
  // Initial state
  snapshot: null,
  pendingRequests: [],
  isLoading: false,
  error: null,
  eventUnsubscribe: null,

  loadApprovals: async () => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ isLoading: true, error: null });

      const response = await request<ExecApprovalsSnapshot>('exec.approvals.get');

      set({
        snapshot: response,
        isLoading: false,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load approvals';
      set({ error: errorMessage, isLoading: false });
      console.error('[Approvals] Failed to load approvals:', err);
    }
  },

  saveApprovals: async (file: ExecApprovalsFile, baseHash?: string) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();
    const { snapshot } = get();

    try {
      set({ error: null });

      await request('exec.approvals.set', {
        file,
        baseHash: baseHash ?? snapshot?.hash,
      });

      // Reload after save
      get().loadApprovals();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save approvals';
      set({ error: errorMessage });
      console.error('[Approvals] Failed to save approvals:', err);
    }
  },

  resolveApproval: async (id: string, decision: 'approve' | 'deny') => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      await request('exec.approval.resolve', { id, decision });

      // Remove from pending
      get().removePendingRequest(id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to resolve approval';
      set({ error: errorMessage });
      console.error('[Approvals] Failed to resolve approval:', err);
    }
  },

  subscribeToEvents: () => {
    const { eventUnsubscribe } = get();

    if (eventUnsubscribe) {
      eventUnsubscribe();
    }

    (async () => {
      const { useConnectionStore } = await import('./connection');
      const { subscribe } = useConnectionStore.getState();

      const unsub = subscribe<ExecApprovalRequest>('exec.approval.requested', (payload) => {
        console.log('[Approvals] Approval requested:', payload);

        const request: ExecApprovalRequest = {
          ...payload,
          receivedAt: Date.now(),
        };

        set((state) => ({
          pendingRequests: [...state.pendingRequests, request],
        }));
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

  removePendingRequest: (id: string) => {
    set((state) => ({
      pendingRequests: state.pendingRequests.filter((r) => r.id !== id),
    }));
  },

  reset: () => {
    const { unsubscribeFromEvents } = get();
    unsubscribeFromEvents();
    set({
      snapshot: null,
      pendingRequests: [],
      isLoading: false,
      error: null,
      eventUnsubscribe: null,
    });
  },
}));
