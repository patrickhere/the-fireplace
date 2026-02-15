// ---------------------------------------------------------------------------
// Approvals Store (Zustand)
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import type { Unsubscribe } from '@/gateway/types';

// ---- Approval Types -------------------------------------------------------

export interface ApprovalRequest {
  id: string;
  type: 'exec' | 'dangerous' | 'device' | 'config';
  command?: string;
  reason?: string;
  requestedBy?: string;
  requestedAt: number;
  context?: Record<string, unknown>;
  expiresAt?: number;
}

export interface ApprovalHistoryItem {
  id: string;
  type: 'exec' | 'dangerous' | 'device' | 'config';
  command?: string;
  reason?: string;
  requestedAt: number;
  resolvedAt: number;
  resolution: 'approved' | 'rejected' | 'expired';
  resolvedBy?: string;
}

export interface DenyListItem {
  pattern: string;
  type: 'command' | 'path' | 'host';
  addedAt: number;
  reason?: string;
}

// ---- Event Payload Types --------------------------------------------------

export interface ApprovalRequestedPayload {
  id: string;
  type: 'exec' | 'dangerous' | 'device' | 'config';
  command?: string;
  reason?: string;
  requestedBy?: string;
  timestamp: number;
  context?: Record<string, unknown>;
}

export interface ApprovalResolvedPayload {
  id: string;
  resolution: 'approved' | 'rejected' | 'expired';
  timestamp: number;
}

// ---- Store Types ----------------------------------------------------------

interface ApprovalsState {
  // Data
  pendingApprovals: ApprovalRequest[];
  history: ApprovalHistoryItem[];
  denyList: DenyListItem[];

  // UI State
  isLoading: boolean;
  error: string | null;
  showHistoryModal: boolean;
  showDenyListModal: boolean;

  // Event subscription
  eventUnsubscribe: Unsubscribe | null;

  // Actions
  loadPendingApprovals: () => Promise<void>;
  loadHistory: (limit?: number) => Promise<void>;
  loadDenyList: () => Promise<void>;
  approve: (id: string, reason?: string) => Promise<void>;
  reject: (id: string, reason?: string) => Promise<void>;
  addToDenyList: (
    pattern: string,
    type: 'command' | 'path' | 'host',
    reason?: string
  ) => Promise<void>;
  removeFromDenyList: (pattern: string) => Promise<void>;
  setShowHistoryModal: (show: boolean) => void;
  setShowDenyListModal: (show: boolean) => void;
  subscribeToEvents: () => void;
  unsubscribeFromEvents: () => void;
  reset: () => void;
}

// ---- Store ----------------------------------------------------------------

export const useApprovalsStore = create<ApprovalsState>((set, get) => ({
  // Initial state
  pendingApprovals: [],
  history: [],
  denyList: [],
  isLoading: false,
  error: null,
  showHistoryModal: false,
  showDenyListModal: false,
  eventUnsubscribe: null,

  loadPendingApprovals: async () => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ isLoading: true, error: null });

      const response = await request<{ approvals: ApprovalRequest[] }>('exec.approvals.list', {
        status: 'pending',
        limit: 100,
      });

      set({
        pendingApprovals: response.approvals || [],
        isLoading: false,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load pending approvals';
      set({ error: errorMessage, isLoading: false });
      console.error('[Approvals] Failed to load pending approvals:', err);
    }
  },

  loadHistory: async (limit = 50) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      const response = await request<{ history: ApprovalHistoryItem[] }>('exec.approvals.history', {
        limit,
      });

      set({
        history: response.history || [],
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load approval history';
      set({ error: errorMessage });
      console.error('[Approvals] Failed to load history:', err);
    }
  },

  loadDenyList: async () => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      const response = await request<{ denyList: DenyListItem[] }>('exec.approvals.denylist', {});

      set({
        denyList: response.denyList || [],
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load deny list';
      set({ error: errorMessage });
      console.error('[Approvals] Failed to load deny list:', err);
    }
  },

  approve: async (id: string, reason?: string) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      await request('exec.approval.resolve', {
        id,
        action: 'approve',
        reason,
      });

      // Remove from pending approvals
      set((state) => ({
        pendingApprovals: state.pendingApprovals.filter((a) => a.id !== id),
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to approve request';
      set({ error: errorMessage });
      console.error('[Approvals] Failed to approve:', err);
    }
  },

  reject: async (id: string, reason?: string) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      await request('exec.approval.resolve', {
        id,
        action: 'reject',
        reason,
      });

      // Remove from pending approvals
      set((state) => ({
        pendingApprovals: state.pendingApprovals.filter((a) => a.id !== id),
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reject request';
      set({ error: errorMessage });
      console.error('[Approvals] Failed to reject:', err);
    }
  },

  addToDenyList: async (pattern: string, type: 'command' | 'path' | 'host', reason?: string) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      await request('exec.approvals.denylist.add', {
        pattern,
        type,
        reason,
      });

      // Reload deny list
      get().loadDenyList();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add to deny list';
      set({ error: errorMessage });
      console.error('[Approvals] Failed to add to deny list:', err);
    }
  },

  removeFromDenyList: async (pattern: string) => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      await request('exec.approvals.denylist.remove', {
        pattern,
      });

      // Remove from local state
      set((state) => ({
        denyList: state.denyList.filter((item) => item.pattern !== pattern),
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove from deny list';
      set({ error: errorMessage });
      console.error('[Approvals] Failed to remove from deny list:', err);
    }
  },

  setShowHistoryModal: (show: boolean) => {
    set({ showHistoryModal: show });
    if (show && get().history.length === 0) {
      get().loadHistory();
    }
  },

  setShowDenyListModal: (show: boolean) => {
    set({ showDenyListModal: show });
    if (show && get().denyList.length === 0) {
      get().loadDenyList();
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

      // Subscribe to approval request events
      const unsub1 = subscribe<ApprovalRequestedPayload>('exec.approval.requested', (payload) => {
        console.log('[Approvals] New approval request:', payload);

        const newApproval: ApprovalRequest = {
          id: payload.id,
          type: payload.type,
          command: payload.command,
          reason: payload.reason,
          requestedBy: payload.requestedBy,
          requestedAt: payload.timestamp,
          context: payload.context,
        };

        set((state) => ({
          pendingApprovals: [newApproval, ...state.pendingApprovals],
        }));
      });

      // Subscribe to approval resolved events
      const unsub2 = subscribe<ApprovalResolvedPayload>('exec.approval.resolved', (payload) => {
        console.log('[Approvals] Approval resolved:', payload);

        // Remove from pending
        set((state) => ({
          pendingApprovals: state.pendingApprovals.filter((a) => a.id !== payload.id),
        }));
      });

      set({
        eventUnsubscribe: () => {
          unsub1();
          unsub2();
        },
      });
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
      pendingApprovals: [],
      history: [],
      denyList: [],
      isLoading: false,
      error: null,
      showHistoryModal: false,
      showDenyListModal: false,
      eventUnsubscribe: null,
    });
  },
}));
