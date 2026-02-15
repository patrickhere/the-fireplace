// ---------------------------------------------------------------------------
// Approvals View
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { useApprovalsStore } from '@/stores/approvals';
import { useConnectionStore } from '@/stores/connection';
import { useIsMobile } from '@/hooks/usePlatform';
import type { ApprovalRequest, ApprovalHistoryItem, DenyListItem } from '@/stores/approvals';

// ---- History Modal --------------------------------------------------------

function HistoryModal() {
  const { history, showHistoryModal, setShowHistoryModal } = useApprovalsStore();

  if (!showHistoryModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-700 p-4">
          <h2 className="text-lg font-semibold text-zinc-100">Approval History</h2>
          <button
            onClick={() => setShowHistoryModal(false)}
            className="text-zinc-400 hover:text-zinc-100"
            type="button"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* History */}
        <div className="space-y-2 overflow-y-auto p-4" style={{ maxHeight: 'calc(90vh - 100px)' }}>
          {history.length === 0 ? (
            <p className="text-sm text-zinc-400">No approval history yet.</p>
          ) : (
            history.map((item) => <HistoryItem key={item.id} item={item} />)
          )}
        </div>
      </div>
    </div>
  );
}

function HistoryItem({ item }: { item: ApprovalHistoryItem }) {
  const resolutionColor =
    item.resolution === 'approved'
      ? 'text-emerald-400'
      : item.resolution === 'rejected'
        ? 'text-red-400'
        : 'text-zinc-400';

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-zinc-400 uppercase">{item.type}</span>
        <span className={`text-xs font-semibold ${resolutionColor}`}>{item.resolution}</span>
      </div>
      {item.command && <div className="mb-2 font-mono text-sm text-zinc-100">{item.command}</div>}
      {item.reason && <div className="mb-2 text-xs text-zinc-400">{item.reason}</div>}
      <div className="flex justify-between text-xs text-zinc-500">
        <span>Requested: {new Date(item.requestedAt).toLocaleString()}</span>
        <span>Resolved: {new Date(item.resolvedAt).toLocaleString()}</span>
      </div>
    </div>
  );
}

// ---- Deny List Modal ------------------------------------------------------

function DenyListModal() {
  const { denyList, showDenyListModal, setShowDenyListModal, addToDenyList } = useApprovalsStore();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPattern, setNewPattern] = useState('');
  const [newType, setNewType] = useState<'command' | 'path' | 'host'>('command');
  const [newReason, setNewReason] = useState('');

  if (!showDenyListModal) return null;

  const handleAdd = async () => {
    if (!newPattern.trim()) return;
    await addToDenyList(newPattern, newType, newReason || undefined);
    setNewPattern('');
    setNewReason('');
    setShowAddForm(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-700 p-4">
          <h2 className="text-lg font-semibold text-zinc-100">Deny List</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="rounded-md bg-amber-500 px-3 py-1 text-sm text-zinc-950 hover:bg-amber-400"
              type="button"
            >
              Add Pattern
            </button>
            <button
              onClick={() => setShowDenyListModal(false)}
              className="text-zinc-400 hover:text-zinc-100"
              type="button"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-3 overflow-y-auto p-4" style={{ maxHeight: 'calc(90vh - 100px)' }}>
          {/* Add Form */}
          {showAddForm && (
            <div className="space-y-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
              <div>
                <label htmlFor="pattern" className="mb-1 block text-xs text-zinc-400">
                  Pattern
                </label>
                <input
                  id="pattern"
                  type="text"
                  value={newPattern}
                  onChange={(e) => setNewPattern(e.target.value)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 focus:outline-none"
                  placeholder="e.g., rm -rf, /etc/*, example.com"
                />
              </div>
              <div>
                <label htmlFor="type" className="mb-1 block text-xs text-zinc-400">
                  Type
                </label>
                <select
                  id="type"
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as 'command' | 'path' | 'host')}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 focus:outline-none"
                >
                  <option value="command">Command</option>
                  <option value="path">Path</option>
                  <option value="host">Host</option>
                </select>
              </div>
              <div>
                <label htmlFor="reason" className="mb-1 block text-xs text-zinc-400">
                  Reason (optional)
                </label>
                <input
                  id="reason"
                  type="text"
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 focus:outline-none"
                  placeholder="Why is this pattern denied?"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  className="rounded-md bg-amber-500 px-3 py-2 text-sm text-zinc-950 hover:bg-amber-400"
                  type="button"
                >
                  Add
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="rounded-md bg-zinc-800 px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Deny List Items */}
          {denyList.length === 0 ? (
            <p className="text-sm text-zinc-400">No patterns in deny list.</p>
          ) : (
            denyList.map((item) => <DenyListItem key={item.pattern} item={item} />)
          )}
        </div>
      </div>
    </div>
  );
}

function DenyListItem({ item }: { item: DenyListItem }) {
  const { removeFromDenyList } = useApprovalsStore();

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-300">{item.type}</span>
          <span className="font-mono text-sm text-zinc-100">{item.pattern}</span>
        </div>
        <button
          onClick={() => removeFromDenyList(item.pattern)}
          className="rounded-md bg-red-500/10 px-2 py-1 text-xs text-red-400 hover:bg-red-500/20"
          type="button"
        >
          Remove
        </button>
      </div>
      {item.reason && <div className="text-xs text-zinc-400">{item.reason}</div>}
      <div className="mt-1 text-xs text-zinc-500">
        Added: {new Date(item.addedAt).toLocaleString()}
      </div>
    </div>
  );
}

// ---- Approval Card --------------------------------------------------------

function ApprovalCard({ approval }: { approval: ApprovalRequest }) {
  const { approve, reject } = useApprovalsStore();
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const handleApprove = async () => {
    await approve(approval.id);
  };

  const handleReject = async () => {
    await reject(approval.id, rejectReason || undefined);
    setShowRejectConfirm(false);
    setRejectReason('');
  };

  const isExpired = approval.expiresAt && approval.expiresAt < Date.now();
  const urgencyBorder = isExpired ? 'border-zinc-700' : 'border-amber-500/40';
  const urgencyBg = isExpired ? 'bg-zinc-900' : 'bg-amber-500/5';

  return (
    <div className={`rounded-lg border p-3 ${urgencyBorder} ${urgencyBg}`}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded bg-amber-500/20 px-2 py-1 text-xs font-semibold text-amber-400 uppercase">
            {approval.type}
          </span>
          {isExpired && (
            <span className="rounded bg-red-500/20 px-2 py-1 text-xs text-red-400">Expired</span>
          )}
        </div>
        <span className="text-xs text-zinc-400">
          {new Date(approval.requestedAt).toLocaleString()}
        </span>
      </div>

      {approval.command && (
        <div className="mb-2 rounded bg-zinc-800 p-2 font-mono text-sm text-zinc-100">
          {approval.command}
        </div>
      )}

      {approval.reason && <div className="mb-2 text-sm text-zinc-300">{approval.reason}</div>}

      {approval.requestedBy && (
        <div className="mb-2 text-xs text-zinc-400">Requested by: {approval.requestedBy}</div>
      )}

      {!showRejectConfirm ? (
        <div className="flex gap-2">
          <button
            onClick={handleApprove}
            disabled={!!isExpired}
            className="flex-1 rounded-md bg-emerald-500 px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
          >
            Approve
          </button>
          <button
            onClick={() => setShowRejectConfirm(true)}
            disabled={!!isExpired}
            className="flex-1 rounded-md bg-red-500/20 px-3 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
          >
            Reject
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            type="text"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Rejection reason (optional)"
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-red-500 focus:ring-1 focus:ring-red-500/30 focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={handleReject}
              className="flex-1 rounded-md bg-red-500 px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-red-400"
              type="button"
            >
              Confirm Reject
            </button>
            <button
              onClick={() => setShowRejectConfirm(false)}
              className="flex-1 rounded-md bg-zinc-800 px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Main Approvals View --------------------------------------------------

export function Approvals() {
  const {
    pendingApprovals,
    isLoading,
    error,
    loadPendingApprovals,
    setShowHistoryModal,
    setShowDenyListModal,
    subscribeToEvents,
    unsubscribeFromEvents,
  } = useApprovalsStore();

  const { status } = useConnectionStore();
  const isMobile = useIsMobile();

  // Load approvals on mount and subscribe to events
  useEffect(() => {
    if (status === 'connected') {
      loadPendingApprovals();
      subscribeToEvents();
    }

    return () => {
      unsubscribeFromEvents();
    };
  }, [status, loadPendingApprovals, subscribeToEvents, unsubscribeFromEvents]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-zinc-700 p-4">
        <h1 className="text-lg font-semibold text-zinc-100">Approvals</h1>
        <p className="text-sm text-zinc-400">
          Exec approval requests and dangerous operation confirmations
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => setShowHistoryModal(true)}
            className="rounded-md bg-zinc-800 px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
            type="button"
          >
            View History
          </button>
          <button
            onClick={() => setShowDenyListModal(true)}
            className="rounded-md bg-zinc-800 px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
            type="button"
          >
            Deny List
          </button>
          {pendingApprovals.length > 0 && (
            <div className="ml-auto flex items-center gap-2 rounded-md bg-amber-500/10 px-3 py-2">
              <span className="text-sm font-semibold text-amber-400">
                {pendingApprovals.length} pending
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="border-b border-red-500/20 bg-red-500/10 p-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="text-sm text-zinc-400">Loading approvals...</div>
        ) : pendingApprovals.length === 0 ? (
          <div className="text-sm text-zinc-400">No pending approvals. All clear!</div>
        ) : (
          <div className={isMobile ? 'space-y-3' : 'grid grid-cols-1 gap-3 lg:grid-cols-2'}>
            {pendingApprovals.map((approval) => (
              <ApprovalCard key={approval.id} approval={approval} />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <HistoryModal />
      <DenyListModal />
    </div>
  );
}
