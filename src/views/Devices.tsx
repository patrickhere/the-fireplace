// ---------------------------------------------------------------------------
// Devices View
// ---------------------------------------------------------------------------

import { useEffect, useState, useCallback } from 'react';
import { useDevicesStore } from '@/stores/devices';
import { useConnectionStore } from '@/stores/connection';
import type { DevicePairRequest, PairedDevice } from '@/stores/devices';

// ---- Confirmation Dialog --------------------------------------------------

function ConfirmAction({
  message,
  onConfirm,
  onCancel,
  variant = 'danger',
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning';
}) {
  const colors =
    variant === 'danger'
      ? {
          button: 'bg-red-500 text-zinc-950 hover:bg-red-400',
          bg: 'bg-red-500/5 border-red-500/20',
        }
      : {
          button: 'bg-amber-500 text-zinc-950 hover:bg-amber-400',
          bg: 'bg-amber-500/5 border-amber-500/20',
        };

  return (
    <div className={`mt-2 rounded-md border p-2 ${colors.bg}`}>
      <p className="mb-2 text-xs text-zinc-300">{message}</p>
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          className={`rounded-md px-3 py-1 text-xs font-medium ${colors.button}`}
          type="button"
        >
          Confirm
        </button>
        <button
          onClick={onCancel}
          className="rounded-md bg-zinc-700 px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-600 hover:text-zinc-100"
          type="button"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ---- Time Formatter -------------------------------------------------------

function formatTimestamp(ts: number): string {
  if (!ts) return 'Unknown';
  return new Date(ts).toLocaleString();
}

// ---- Pairing Request Card -------------------------------------------------

function PairingRequestCard({ request }: { request: DevicePairRequest }) {
  const { approveRequest, rejectRequest } = useDevicesStore();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleApprove = async () => {
    setIsProcessing(true);
    await approveRequest(request.requestId);
    setIsProcessing(false);
  };

  const handleReject = async () => {
    setIsProcessing(true);
    await rejectRequest(request.requestId);
    setIsProcessing(false);
  };

  return (
    <div className="rounded-lg border border-amber-500/30 bg-zinc-800 p-3">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-amber-500" />
            <span className="text-sm font-medium text-zinc-100">
              {request.displayName || request.deviceId}
            </span>
            {request.isRepair && (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">
                Repair
              </span>
            )}
          </div>

          <div className="space-y-0.5 text-xs text-zinc-400">
            {request.platform && <div>Platform: {request.platform}</div>}
            {request.remoteIp && <div>IP: {request.remoteIp}</div>}
            {request.clientId && <div>Client: {request.clientId}</div>}
            {request.clientMode && <div>Mode: {request.clientMode}</div>}
            {request.role && <div>Role: {request.role}</div>}
            {request.roles && request.roles.length > 0 && (
              <div>Roles: {request.roles.join(', ')}</div>
            )}
            {request.scopes && request.scopes.length > 0 && (
              <div>Scopes: {request.scopes.join(', ')}</div>
            )}
            <div>Requested: {formatTimestamp(request.ts)}</div>
          </div>

          <div className="mt-1 font-mono text-xs text-zinc-500">
            ID: {request.requestId.slice(0, 12)}...
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={handleApprove}
            disabled={isProcessing}
            className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-medium text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
            type="button"
          >
            Approve
          </button>
          <button
            onClick={handleReject}
            disabled={isProcessing}
            className="rounded-md bg-red-500 px-3 py-1.5 text-xs font-medium text-zinc-950 hover:bg-red-400 disabled:opacity-50"
            type="button"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Paired Device Row ----------------------------------------------------

function PairedDeviceRow({ device }: { device: PairedDevice }) {
  const { rotateToken, revokeToken } = useDevicesStore();
  const [confirmAction, setConfirmAction] = useState<'rotate' | 'revoke' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleRotate = async () => {
    setIsProcessing(true);
    await rotateToken(device.deviceId, device.role, device.scopes);
    setConfirmAction(null);
    setIsProcessing(false);
  };

  const handleRevoke = async () => {
    setIsProcessing(true);
    await revokeToken(device.deviceId, device.role);
    setConfirmAction(null);
    setIsProcessing(false);
  };

  return (
    <tr className="border-b border-zinc-700/50 last:border-0">
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-sm text-zinc-100">
            {device.displayName || device.deviceId.slice(0, 12) + '...'}
          </span>
        </div>
      </td>
      <td className="px-3 py-2 text-xs text-zinc-400">{device.platform ?? '-'}</td>
      <td className="px-3 py-2">
        <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300">
          {device.role}
        </span>
      </td>
      <td className="px-3 py-2 text-xs text-zinc-400">
        {device.scopes && device.scopes.length > 0 ? device.scopes.join(', ') : '-'}
      </td>
      <td className="px-3 py-2 text-xs text-zinc-500">
        {device.lastSeen ? formatTimestamp(device.lastSeen) : '-'}
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-1">
          {confirmAction === null ? (
            <>
              <button
                onClick={() => setConfirmAction('rotate')}
                className="rounded-md bg-amber-500/10 px-2 py-1 text-xs text-amber-400 hover:bg-amber-500/20"
                type="button"
              >
                Rotate
              </button>
              <button
                onClick={() => setConfirmAction('revoke')}
                className="rounded-md bg-red-500/10 px-2 py-1 text-xs text-red-400 hover:bg-red-500/20"
                type="button"
              >
                Revoke
              </button>
            </>
          ) : (
            <div className="text-xs">
              {confirmAction === 'rotate' ? (
                <ConfirmAction
                  message="Rotate token for this device? The old token will be invalidated."
                  onConfirm={handleRotate}
                  onCancel={() => setConfirmAction(null)}
                  variant="warning"
                />
              ) : (
                <ConfirmAction
                  message="Revoke token for this device? It will need to re-pair."
                  onConfirm={handleRevoke}
                  onCancel={() => setConfirmAction(null)}
                  variant="danger"
                />
              )}
              {isProcessing && (
                <span className="ml-2 text-zinc-400">Processing...</span>
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

// ---- Main Devices View ----------------------------------------------------

export function Devices() {
  const {
    pairingRequests,
    pairedDevices,
    isLoading,
    error,
    loadRequests,
    subscribeToEvents,
    unsubscribeFromEvents,
  } = useDevicesStore();

  const { status } = useConnectionStore();

  const load = useCallback(() => {
    loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    if (status === 'connected') {
      load();
      subscribeToEvents();
    }

    return () => {
      unsubscribeFromEvents();
    };
  }, [status, load, subscribeToEvents, unsubscribeFromEvents]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-zinc-700 p-4">
        <h1 className="text-lg font-semibold text-zinc-100">Devices</h1>
        <p className="text-sm text-zinc-400">Paired devices and pairing requests</p>

        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={load}
            disabled={isLoading}
            className="rounded-md bg-amber-500 px-3 py-2 text-sm text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
            type="button"
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
          <span className="text-xs text-zinc-500">
            {pairingRequests.length} pending request{pairingRequests.length !== 1 ? 's' : ''}
          </span>
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
        {isLoading && pairingRequests.length === 0 && pairedDevices.length === 0 ? (
          <div className="text-sm text-zinc-400">Loading devices...</div>
        ) : (
          <div className="space-y-6">
            {/* Pairing Requests Section */}
            <div>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-100">
                <span>Pairing Requests</span>
                {pairingRequests.length > 0 && (
                  <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-medium text-zinc-950">
                    {pairingRequests.length}
                  </span>
                )}
              </h2>

              {pairingRequests.length === 0 ? (
                <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4 text-sm text-zinc-500">
                  No pending pairing requests
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {pairingRequests.map((req) => (
                    <PairingRequestCard key={req.requestId} request={req} />
                  ))}
                </div>
              )}
            </div>

            {/* Paired Devices Section */}
            <div>
              <h2 className="mb-3 text-sm font-medium text-zinc-100">
                Paired Devices ({pairedDevices.length})
              </h2>

              {pairedDevices.length === 0 ? (
                <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4 text-sm text-zinc-500">
                  No paired devices
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-zinc-700 bg-zinc-900">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-zinc-700 bg-zinc-800/50">
                        <th className="px-3 py-2 text-xs font-medium text-zinc-400">Device</th>
                        <th className="px-3 py-2 text-xs font-medium text-zinc-400">Platform</th>
                        <th className="px-3 py-2 text-xs font-medium text-zinc-400">Role</th>
                        <th className="px-3 py-2 text-xs font-medium text-zinc-400">Scopes</th>
                        <th className="px-3 py-2 text-xs font-medium text-zinc-400">Last Seen</th>
                        <th className="px-3 py-2 text-xs font-medium text-zinc-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pairedDevices.map((device) => (
                        <PairedDeviceRow key={device.deviceId} device={device} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
