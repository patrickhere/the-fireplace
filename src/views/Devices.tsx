// ---------------------------------------------------------------------------
// Devices View
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { useDevicesStore } from '@/stores/devices';
import { useConnectionStore } from '@/stores/connection';
import { useIsMobile } from '@/hooks/usePlatform';
import type { Device, PairingRequest } from '@/stores/devices';

// ---- Pairing Request Card -------------------------------------------------

function PairingRequestCard({ request }: { request: PairingRequest }) {
  const { approvePairing, rejectPairing } = useDevicesStore();
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const handleApprove = async () => {
    await approvePairing(request.id);
  };

  const handleReject = async () => {
    await rejectPairing(request.id, rejectReason || undefined);
    setShowRejectConfirm(false);
    setRejectReason('');
  };

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="rounded bg-amber-500/20 px-2 py-1 text-xs font-semibold text-amber-400">
          PAIRING REQUEST
        </span>
        <span className="text-xs text-zinc-400">
          {new Date(request.requestedAt).toLocaleString()}
        </span>
      </div>

      <div className="mb-2 space-y-1 text-sm">
        <div className="text-zinc-100">Device: {request.deviceName || request.deviceId}</div>
        {request.platform && (
          <div className="text-xs text-zinc-400">Platform: {request.platform}</div>
        )}
        {request.deviceFamily && (
          <div className="text-xs text-zinc-400">Family: {request.deviceFamily}</div>
        )}
      </div>

      {!showRejectConfirm ? (
        <div className="flex gap-2">
          <button
            onClick={handleApprove}
            className="flex-1 rounded-md bg-emerald-500 px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
            type="button"
          >
            Approve
          </button>
          <button
            onClick={() => setShowRejectConfirm(true)}
            className="flex-1 rounded-md bg-red-500/20 px-3 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/30"
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

// ---- Device Card ----------------------------------------------------------

function DeviceCard({ device }: { device: Device }) {
  const { unpairDevice, rotateToken } = useDevicesStore();
  const [showActions, setShowActions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          <h3 className="text-sm font-semibold text-zinc-100">{device.name}</h3>
        </div>
        <button
          onClick={() => setShowActions(!showActions)}
          className="text-zinc-400 hover:text-zinc-100"
          type="button"
        >
          •••
        </button>
      </div>

      <div className="space-y-1 text-xs">
        <div className="text-zinc-400">ID: {device.id}</div>
        {device.platform && <div className="text-zinc-400">Platform: {device.platform}</div>}
        {device.role && <div className="text-zinc-400">Role: {device.role}</div>}
        {device.pairedAt && (
          <div className="text-zinc-500">Paired: {new Date(device.pairedAt).toLocaleString()}</div>
        )}
        {device.lastSeen && (
          <div className="text-zinc-500">
            Last seen: {new Date(device.lastSeen).toLocaleString()}
          </div>
        )}
      </div>

      {showActions && !showDeleteConfirm && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => rotateToken(device.id)}
            className="rounded bg-amber-500/20 px-3 py-1 text-xs text-amber-400"
            type="button"
          >
            Rotate Token
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="rounded bg-red-500/10 px-3 py-1 text-xs text-red-400"
            type="button"
          >
            Unpair
          </button>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="mt-3 rounded bg-red-500/5 p-2">
          <p className="mb-2 text-xs text-red-400">Unpair {device.name}?</p>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                await unpairDevice(device.id);
                setShowDeleteConfirm(false);
              }}
              className="flex-1 rounded bg-red-500 px-3 py-1 text-xs text-zinc-950"
              type="button"
            >
              Unpair
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 rounded bg-zinc-800 px-3 py-1 text-xs text-zinc-400"
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

// ---- Device Row (Desktop) -------------------------------------------------

function DeviceRow({ device }: { device: Device }) {
  const { unpairDevice, rotateToken } = useDevicesStore();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <>
      <tr className="border-b border-zinc-700 hover:bg-zinc-800/50">
        <td className="p-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-sm font-medium text-zinc-100">{device.name}</span>
          </div>
        </td>
        <td className="p-3 text-sm text-zinc-400">{device.platform || '—'}</td>
        <td className="p-3 text-sm text-zinc-400">{device.role || '—'}</td>
        <td className="p-3 text-sm text-zinc-400">
          {device.pairedAt ? new Date(device.pairedAt).toLocaleString() : '—'}
        </td>
        <td className="p-3 text-sm text-zinc-400">
          {device.lastSeen ? new Date(device.lastSeen).toLocaleString() : '—'}
        </td>
        <td className="p-3">
          <div className="flex gap-1">
            <button
              onClick={() => rotateToken(device.id)}
              className="rounded bg-amber-500/20 px-2 py-1 text-xs text-amber-400"
              type="button"
            >
              Rotate Token
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded bg-red-500/10 px-2 py-1 text-xs text-red-400"
              type="button"
            >
              Unpair
            </button>
          </div>
        </td>
      </tr>

      {showDeleteConfirm && (
        <tr>
          <td colSpan={6} className="bg-red-500/5 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-red-400">Unpair {device.name}?</span>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    await unpairDevice(device.id);
                    setShowDeleteConfirm(false);
                  }}
                  className="rounded-md bg-red-500 px-3 py-1 text-xs text-zinc-950"
                  type="button"
                >
                  Unpair
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="rounded-md bg-zinc-800 px-3 py-1 text-xs text-zinc-400"
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ---- Main Devices View ----------------------------------------------------

export function Devices() {
  const {
    devices,
    pairingRequests,
    isLoading,
    error,
    loadDevices,
    loadPairingRequests,
    subscribeToEvents,
    unsubscribeFromEvents,
  } = useDevicesStore();

  const { status } = useConnectionStore();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (status === 'connected') {
      loadDevices();
      loadPairingRequests();
      subscribeToEvents();
    }

    return () => {
      unsubscribeFromEvents();
    };
  }, [status, loadDevices, loadPairingRequests, subscribeToEvents, unsubscribeFromEvents]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-zinc-700 p-4">
        <h1 className="text-lg font-semibold text-zinc-100">Devices</h1>
        <p className="text-sm text-zinc-400">Paired devices and pairing requests</p>

        {pairingRequests.length > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-md bg-amber-500/10 px-3 py-2">
            <span className="text-sm font-semibold text-amber-400">
              {pairingRequests.length} pending pairing request
              {pairingRequests.length > 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="border-b border-red-500/20 bg-red-500/10 p-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Pairing Requests */}
        {pairingRequests.length > 0 && (
          <div className="mb-6">
            <h2 className="mb-3 text-sm font-semibold text-zinc-100">Pairing Requests</h2>
            <div className="space-y-3">
              {pairingRequests.map((request) => (
                <PairingRequestCard key={request.id} request={request} />
              ))}
            </div>
          </div>
        )}

        {/* Paired Devices */}
        <h2 className="mb-3 text-sm font-semibold text-zinc-100">Paired Devices</h2>
        {isLoading ? (
          <div className="text-sm text-zinc-400">Loading devices...</div>
        ) : devices.length === 0 ? (
          <div className="text-sm text-zinc-400">No devices paired yet.</div>
        ) : isMobile ? (
          <div className="space-y-3">
            {devices.map((device) => (
              <DeviceCard key={device.id} device={device} />
            ))}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-700">
                <th className="p-3 text-left text-xs font-semibold text-zinc-400">Name</th>
                <th className="p-3 text-left text-xs font-semibold text-zinc-400">Platform</th>
                <th className="p-3 text-left text-xs font-semibold text-zinc-400">Role</th>
                <th className="p-3 text-left text-xs font-semibold text-zinc-400">Paired At</th>
                <th className="p-3 text-left text-xs font-semibold text-zinc-400">Last Seen</th>
                <th className="p-3 text-left text-xs font-semibold text-zinc-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => (
                <DeviceRow key={device.id} device={device} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
