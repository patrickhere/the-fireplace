// ---------------------------------------------------------------------------
// Channels View
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { useChannelsStore, type ChannelAccount } from '@/stores/channels';
import { useConnectionStore } from '@/stores/connection';
import { useIsMobile } from '@/hooks/usePlatform';
import { LoadingSpinner, EmptyState, ErrorState } from '@/components/StateIndicators';

// ---- Status Dot Component -------------------------------------------------

function StatusDot({
  connected,
  running,
  reconnectAttempts,
  lastError,
}: {
  connected?: boolean;
  running?: boolean;
  reconnectAttempts?: number;
  lastError?: string;
}) {
  let color = 'bg-zinc-500'; // offline
  let label = 'Offline';

  if (running && connected) {
    color = 'bg-emerald-500'; // connected
    label = 'Connected';
  } else if (running && reconnectAttempts && reconnectAttempts > 0) {
    color = 'bg-amber-500'; // warning (reconnecting)
    label = 'Reconnecting';
  } else if (lastError) {
    color = 'bg-red-500'; // error
    label = 'Error';
  }

  return (
    <div className="flex items-center gap-2">
      <div className={`h-2 w-2 rounded-full ${color}`} />
      <span className="text-xs text-zinc-400">{label}</span>
    </div>
  );
}

// ---- Account Row Component ------------------------------------------------

function AccountRow({ account, channel }: { account: ChannelAccount; channel: string }) {
  const { logout } = useChannelsStore();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = async () => {
    await logout(channel, account.accountId);
    setShowLogoutConfirm(false);
  };

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-3">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-100">
              {account.name || account.accountId}
            </span>
            {!account.enabled && (
              <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-xs text-zinc-400">
                Disabled
              </span>
            )}
          </div>
          <StatusDot
            connected={account.connected}
            running={account.running}
            reconnectAttempts={account.reconnectAttempts}
            lastError={account.lastError}
          />
          {account.lastError && (
            <div className="mt-1 text-xs text-red-400">{account.lastError}</div>
          )}
        </div>

        {!showLogoutConfirm ? (
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="rounded-md bg-red-500/10 px-3 py-1 text-xs text-red-400 hover:bg-red-500/20"
            type="button"
          >
            Logout
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleLogout}
              className="rounded-md bg-red-500 px-3 py-1 text-xs text-zinc-950 hover:bg-red-400"
              type="button"
            >
              Confirm
            </button>
            <button
              onClick={() => setShowLogoutConfirm(false)}
              className="rounded-md bg-zinc-700 px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-600 hover:text-zinc-100"
              type="button"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Channel Card Component -----------------------------------------------

function ChannelCard({
  channelId,
  label,
  accounts,
}: {
  channelId: string;
  label: string;
  accounts: ChannelAccount[];
}) {
  const isFeatured = channelId === 'whatsapp' || channelId === 'discord';

  return (
    <div
      className={`rounded-lg border border-zinc-700 bg-zinc-900 p-4 ${isFeatured ? 'col-span-2' : ''}`}
    >
      <h3 className="mb-3 text-lg font-semibold text-zinc-100">{label}</h3>

      {accounts.length === 0 ? (
        <p className="text-sm text-zinc-500">No accounts configured</p>
      ) : (
        <div className="space-y-2">
          {accounts.map((account) => (
            <AccountRow key={account.accountId} account={account} channel={channelId} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Main Channels View ---------------------------------------------------

export function Channels() {
  const {
    channelStatus,
    lastUpdate,
    isLoading,
    error,
    loadStatus,
    subscribeToEvents,
    unsubscribeFromEvents,
    startPolling,
    stopPolling,
  } = useChannelsStore();

  const { status } = useConnectionStore();
  const isMobile = useIsMobile();

  // Load channel status on mount and subscribe to events
  useEffect(() => {
    if (status === 'connected') {
      loadStatus();
      subscribeToEvents();
      startPolling();
    }

    return () => {
      unsubscribeFromEvents();
      stopPolling();
    };
  }, [status, loadStatus, subscribeToEvents, unsubscribeFromEvents, startPolling, stopPolling]);

  // Format last update time
  const lastUpdateText = lastUpdate > 0 ? new Date(lastUpdate).toLocaleTimeString() : 'Never';

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-zinc-700 p-4">
        <h1 className="text-lg font-semibold text-zinc-100">Channels</h1>
        <p className="text-sm text-zinc-400">WhatsApp, Discord, Slack, Telegram status</p>

        {/* Refresh and Last Update */}
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={() => loadStatus()}
            disabled={isLoading}
            className="rounded-md bg-amber-500 px-3 py-2 text-sm text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
            type="button"
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
          <span className="text-xs text-zinc-500">Last updated: {lastUpdateText}</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {error && !isLoading ? (
          <ErrorState message={error} onRetry={loadStatus} />
        ) : isLoading && !channelStatus ? (
          <LoadingSpinner message="Loading channel status..." />
        ) : !channelStatus ? (
          <EmptyState
            message="No channel status available"
            detail='Click "Refresh" to load.'
            action="Refresh"
            onAction={loadStatus}
          />
        ) : (
          <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {channelStatus.channelOrder.map((channelId) => {
              const label = channelStatus.channelLabels[channelId] || channelId;
              const accounts = channelStatus.channelAccounts[channelId] || [];

              return (
                <ChannelCard
                  key={channelId}
                  channelId={channelId}
                  label={label}
                  accounts={accounts}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
