// ---------------------------------------------------------------------------
// Exec Approvals Store (Zustand)
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import { toast } from 'sonner';
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

export interface ExecApprovalsAllowlistEntry {
  id?: string;
  pattern: string;
  lastUsedAt?: number;
  lastUsedCommand?: string;
  lastResolvedPath?: string;
}

export interface ExecApprovalsDefaults {
  security?: string;
  ask?: string;
  askFallback?: string;
  autoAllowSkills?: boolean;
}

export interface ExecApprovalsAgent {
  security?: string;
  ask?: string;
  askFallback?: string;
  autoAllowSkills?: boolean;
  allowlist?: ExecApprovalsAllowlistEntry[];
}

export interface ExecApprovalsFile {
  version: 1;
  socket?: {
    path?: string;
    token?: string;
  };
  defaults?: ExecApprovalsDefaults;
  agents?: Record<string, ExecApprovalsAgent>;
}

export interface ExecApprovalsSnapshot {
  path: string;
  exists: boolean;
  hash: string;
  file: ExecApprovalsFile;
}

// ---- Incoming Approval Payload --------------------------------------------

/**
 * The payload shape received from the gateway for `exec.approval.requested`.
 * Does not include `receivedAt` — that is a client-side field added after receipt.
 */
type IncomingExecApprovalPayload = Omit<ExecApprovalRequest, 'receivedAt'>;

// ---- Approval Resolved Payload --------------------------------------------

/**
 * Payload shape for the `exec.approval.resolved` gateway event.
 * Fired when any client resolves a pending approval.
 */
interface ExecApprovalResolvedPayload {
  id?: string;
  decision?: 'approve' | 'deny';
  resolvedBy?: string;
  resolvedAt?: number;
}

// ---- Resolved History Entry -----------------------------------------------

export interface ResolvedApprovalEntry {
  id: string;
  command: string;
  agentId?: string;
  decision: 'approve' | 'deny';
  resolvedBy?: string;
  resolvedAt: number;
  receivedAt: number;
}

const MAX_RESOLVED_HISTORY = 200;

// ---- Store Types ----------------------------------------------------------

interface ApprovalsState {
  // Data
  snapshot: ExecApprovalsSnapshot | null;
  pendingRequests: ExecApprovalRequest[];
  resolvedHistory: ResolvedApprovalEntry[];

  // UI State
  isLoading: boolean;
  error: string | null;

  // Event subscriptions (requested + resolved)
  eventUnsubscribe: Unsubscribe | null;
  resolvedUnsubscribe: Unsubscribe | null;

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
  resolvedHistory: [],
  isLoading: false,
  error: null,
  eventUnsubscribe: null,
  resolvedUnsubscribe: null,

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
      toast.error(errorMessage);
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

      toast.success('Approvals config saved');
      // Reload after save
      get().loadApprovals();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save approvals';
      set({ error: errorMessage });
      toast.error(errorMessage);
      console.error('[Approvals] Failed to save approvals:', err);
    }
  },

  resolveApproval: async (id: string, decision: 'approve' | 'deny') => {
    const { useConnectionStore } = await import('./connection');
    const { request } = useConnectionStore.getState();

    try {
      set({ error: null });

      await request('exec.approval.resolve', { id, decision });

      toast.success(decision === 'approve' ? 'Approved' : 'Rejected');

      // Move to resolved history before removing from pending
      const pending = get().pendingRequests.find((r) => r.id === id);
      if (pending) {
        const entry: ResolvedApprovalEntry = {
          id,
          command: pending.command,
          agentId: pending.agentId,
          decision,
          resolvedBy: 'local',
          resolvedAt: Date.now(),
          receivedAt: pending.receivedAt,
        };
        set((state) => ({
          resolvedHistory: [entry, ...state.resolvedHistory].slice(0, MAX_RESOLVED_HISTORY),
        }));
      }

      // Remove from pending
      get().removePendingRequest(id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to resolve approval';
      set({ error: errorMessage });
      toast.error(errorMessage);
      console.error('[Approvals] Failed to resolve approval:', err);
    }
  },

  subscribeToEvents: () => {
    const { eventUnsubscribe, resolvedUnsubscribe } = get();

    if (eventUnsubscribe) eventUnsubscribe();
    if (resolvedUnsubscribe) resolvedUnsubscribe();

    // Mark as subscribing to prevent duplicate async subscriptions
    const sentinel: Unsubscribe = () => {};
    set({ eventUnsubscribe: sentinel, resolvedUnsubscribe: sentinel });

    (async () => {
      const { useConnectionStore } = await import('./connection');
      const { subscribe } = useConnectionStore.getState();

      // If another call replaced our sentinel, abort
      if (get().eventUnsubscribe !== sentinel) return;

      const unsub = subscribe<IncomingExecApprovalPayload>('exec.approval.requested', (payload) => {
        console.log('[Approvals] Approval requested:', payload);

        const request: ExecApprovalRequest = {
          ...payload,
          receivedAt: Date.now(),
        };

        set((state) => ({
          pendingRequests: [...state.pendingRequests, request],
        }));
      });

      const resolvedUnsub = subscribe<ExecApprovalResolvedPayload>(
        'exec.approval.resolved',
        (payload) => {
          if (typeof payload !== 'object' || payload === null || typeof payload.id !== 'string') {
            console.warn('[Approvals] Received malformed resolved event, ignoring:', payload);
            return;
          }
          console.log('[Approvals] Approval resolved by remote:', payload);

          // Move to resolved history
          const pending = get().pendingRequests.find((r) => r.id === payload.id);
          if (pending && payload.decision) {
            const entry: ResolvedApprovalEntry = {
              id: payload.id,
              command: pending.command,
              agentId: pending.agentId,
              decision: payload.decision,
              resolvedBy: payload.resolvedBy ?? 'remote',
              resolvedAt: payload.resolvedAt ?? Date.now(),
              receivedAt: pending.receivedAt,
            };
            set((state) => ({
              resolvedHistory: [entry, ...state.resolvedHistory].slice(0, MAX_RESOLVED_HISTORY),
            }));
          }

          get().removePendingRequest(payload.id);
        }
      );

      set({ eventUnsubscribe: unsub, resolvedUnsubscribe: resolvedUnsub });
    })();
  },

  unsubscribeFromEvents: () => {
    const { eventUnsubscribe, resolvedUnsubscribe } = get();
    if (eventUnsubscribe) eventUnsubscribe();
    if (resolvedUnsubscribe) resolvedUnsubscribe();
    set({ eventUnsubscribe: null, resolvedUnsubscribe: null });
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
      resolvedHistory: [],
      isLoading: false,
      error: null,
      eventUnsubscribe: null,
      resolvedUnsubscribe: null,
    });
  },
}));
