import { useEffect, useMemo, useState } from 'react';
import { useSessionsStore } from '@/stores/sessions';
import { useConnectionStore } from '@/stores/connection';
import { useIsMobile } from '@/hooks/usePlatform';
import { SessionReplay } from '@/components/SessionReplay';
import { LoadingSpinner, EmptyState, ErrorState } from '@/components/StateIndicators';
import { SessionPreviewModal } from '@/components/organisms/SessionPreviewModal';
import { SessionConfigModal } from '@/components/organisms/SessionConfigModal';
import { SessionUsageModal } from '@/components/organisms/SessionUsageModal';
import { SessionCard } from '@/components/molecules/SessionCard';
import { SessionActionsCell } from '@/components/molecules/SessionActionsCell';
import { DataTable } from '@/components/organisms/DataTable';
import { formatSessionKey } from '@/lib/utils';
import type { ColumnDef } from '@tanstack/react-table';

export function Sessions() {
  const {
    sessions,
    searchQuery,
    activeFilter,
    isLoading,
    error,
    setSearchQuery,
    setFilter,
    setShowConfigModal,
    loadSessions,
    loadUsage,
    subscribeToEvents,
    unsubscribeFromEvents,
  } = useSessionsStore();

  const { status } = useConnectionStore();
  const isMobile = useIsMobile();
  const [replaySessionKey, setReplaySessionKey] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'connected') {
      loadSessions();
      subscribeToEvents();
    }

    return () => {
      unsubscribeFromEvents();
    };
  }, [status, loadSessions, subscribeToEvents, unsubscribeFromEvents]);

  const filteredSessions = sessions.filter((session) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesKey = session.key.toLowerCase().includes(query);
      const matchesLabel = session.label?.toLowerCase().includes(query);
      const matchesTitle = session.derivedTitle?.toLowerCase().includes(query);
      if (!matchesKey && !matchesLabel && !matchesTitle) return false;
    }

    if (activeFilter === 'recent') {
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      if (!session.lastActive || session.lastActive < oneDayAgo) return false;
    } else if (activeFilter === 'labeled' && !session.label) {
      return false;
    }

    return true;
  });

  const columns = useMemo<ColumnDef<(typeof filteredSessions)[number]>[]>(
    () => [
      {
        header: 'Name',
        accessorFn: (row) => row.derivedTitle || formatSessionKey(row.key, row.label),
        id: 'name',
        cell: ({ row }) => (
          <span className="text-sm text-zinc-100">
            {row.original.derivedTitle || formatSessionKey(row.original.key, row.original.label)}
          </span>
        ),
      },
      {
        header: 'Model',
        accessorFn: (row) => row.model || 'default',
        id: 'model',
        cell: ({ row }) => (
          <span className="text-sm text-zinc-400">{row.original.model || 'default'}</span>
        ),
      },
      {
        header: 'Messages',
        accessorFn: (row) => row.messageCount || 0,
        id: 'messageCount',
        cell: ({ row }) => (
          <span className="text-sm text-zinc-400">{row.original.messageCount || 0}</span>
        ),
      },
      {
        header: 'Last Active',
        accessorFn: (row) => row.lastActive || 0,
        id: 'lastActive',
        cell: ({ row }) => (
          <span className="text-sm text-zinc-400">
            {row.original.lastActive
              ? new Date(row.original.lastActive).toLocaleDateString()
              : 'Never'}
          </span>
        ),
      },
      {
        header: 'Actions',
        id: 'actions',
        cell: ({ row }) => (
          <SessionActionsCell session={row.original} onReplay={setReplaySessionKey} />
        ),
      },
    ],
    []
  );

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-700 p-4">
        <h1 className="text-lg font-semibold text-zinc-100">Sessions</h1>
        <p className="text-sm text-zinc-400">Manage chat sessions</p>

        <div className="mt-3 flex flex-wrap gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sessions..."
            className="min-w-[200px] flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 focus:outline-none"
          />

          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`rounded-md px-3 py-2 text-sm ${
                activeFilter === 'all'
                  ? 'bg-amber-500 text-zinc-950'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100'
              }`}
              type="button"
            >
              All
            </button>
            <button
              onClick={() => setFilter('recent')}
              className={`rounded-md px-3 py-2 text-sm ${
                activeFilter === 'recent'
                  ? 'bg-amber-500 text-zinc-950'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100'
              }`}
              type="button"
            >
              Recent
            </button>
            <button
              onClick={() => setFilter('labeled')}
              className={`rounded-md px-3 py-2 text-sm ${
                activeFilter === 'labeled'
                  ? 'bg-amber-500 text-zinc-950'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100'
              }`}
              type="button"
            >
              Labeled
            </button>
          </div>

          <button
            onClick={() => setShowConfigModal(true)}
            className="rounded-md bg-amber-500 px-3 py-2 text-sm text-zinc-950 hover:bg-amber-400"
            type="button"
          >
            Edit Config
          </button>

          <button
            onClick={() => loadUsage()}
            className="rounded-md bg-zinc-800 px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
            type="button"
          >
            Usage Stats
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {error && !isLoading ? (
          <ErrorState message={error} onRetry={loadSessions} />
        ) : isLoading && sessions.length === 0 ? (
          <LoadingSpinner message="Loading sessions..." />
        ) : filteredSessions.length === 0 ? (
          <EmptyState
            message={
              searchQuery || activeFilter !== 'all'
                ? 'No sessions match your filters.'
                : 'No sessions yet'
            }
            detail={
              searchQuery || activeFilter !== 'all'
                ? undefined
                : 'Start chatting to create your first session.'
            }
          />
        ) : isMobile ? (
          <div className="space-y-3 p-4">
            {filteredSessions.map((session) => (
              <SessionCard key={session.key} session={session} onReplay={setReplaySessionKey} />
            ))}
          </div>
        ) : (
          <div className="p-4">
            <DataTable columns={columns} data={filteredSessions} />
          </div>
        )}
      </div>

      <SessionPreviewModal />
      <SessionConfigModal />
      <SessionUsageModal />
      {replaySessionKey && (
        <SessionReplay sessionKey={replaySessionKey} onClose={() => setReplaySessionKey(null)} />
      )}
    </div>
  );
}
