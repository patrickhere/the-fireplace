// ---------------------------------------------------------------------------
// Logs View
// ---------------------------------------------------------------------------

import { useEffect, useRef } from 'react';
import { useLogsStore } from '@/stores/logs';
import { useConnectionStore } from '@/stores/connection';
import type { LogEntry, LogLevel } from '@/stores/logs';

// ---- Log Entry Component --------------------------------------------------

function LogEntryRow({ log }: { log: LogEntry }) {
  const levelColors: Record<LogLevel, string> = {
    debug: 'text-zinc-500',
    info: 'text-emerald-400',
    warn: 'text-amber-400',
    error: 'text-red-400',
  };

  const levelBgs: Record<LogLevel, string> = {
    debug: 'bg-zinc-800',
    info: 'bg-emerald-500/10',
    warn: 'bg-amber-500/10',
    error: 'bg-red-500/10',
  };

  const timestamp = new Date(log.timestamp).toLocaleTimeString();
  const levelColor = levelColors[log.level];
  const levelBg = levelBgs[log.level];

  return (
    <div className={`flex gap-2 border-b border-zinc-800 p-2 font-mono text-xs ${levelBg}`}>
      <span className="text-zinc-500">{timestamp}</span>
      <span className={`w-14 font-semibold uppercase ${levelColor}`}>{log.level}</span>
      <span className="text-zinc-400">[{log.source}]</span>
      <span className="flex-1 text-zinc-100">{log.message}</span>
    </div>
  );
}

// ---- Main Logs View -------------------------------------------------------

export function Logs() {
  const {
    logs,
    isLoading,
    error,
    isTailing,
    autoScroll,
    levelFilter,
    sourceFilter,
    searchQuery,
    loadHistory,
    startTailing,
    stopTailing,
    clearLogs,
    setLevelFilter,
    setSourceFilter,
    setSearchQuery,
    setAutoScroll,
  } = useLogsStore();

  const { status } = useConnectionStore();
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status === 'connected') {
      loadHistory(200);
    }
  }, [status, loadHistory]);

  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleToggleTailing = () => {
    if (isTailing) {
      stopTailing();
    } else {
      startTailing();
    }
  };

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    if (levelFilter !== 'all' && log.level !== levelFilter) return false;
    if (sourceFilter && !log.source.toLowerCase().includes(sourceFilter.toLowerCase()))
      return false;
    if (searchQuery && !log.message.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // Extract unique sources for filter dropdown
  const sources = Array.from(new Set(logs.map((log) => log.source))).sort();

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-zinc-700 p-4">
        <h1 className="text-lg font-semibold text-zinc-100">Logs</h1>
        <p className="text-sm text-zinc-400">Live log tailing and filters</p>

        {/* Controls */}
        <div className="mt-3 flex flex-wrap gap-2">
          {/* Tailing Toggle */}
          <button
            onClick={handleToggleTailing}
            className={`rounded-md px-3 py-2 text-sm font-semibold ${
              isTailing
                ? 'bg-emerald-500 text-zinc-950'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100'
            }`}
            type="button"
          >
            {isTailing ? 'Stop Tailing' : 'Start Tailing'}
          </button>

          {/* Auto Scroll Toggle */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`rounded-md px-3 py-2 text-sm ${
              autoScroll
                ? 'bg-amber-500 text-zinc-950'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100'
            }`}
            type="button"
          >
            Auto-scroll: {autoScroll ? 'ON' : 'OFF'}
          </button>

          {/* Clear */}
          <button
            onClick={clearLogs}
            className="rounded-md bg-zinc-800 px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
            type="button"
          >
            Clear
          </button>

          {/* Level Filter */}
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value as LogLevel | 'all')}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 focus:outline-none"
          >
            <option value="all">All Levels</option>
            <option value="debug">Debug</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
          </select>

          {/* Source Filter */}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 focus:outline-none"
          >
            <option value="">All Sources</option>
            {sources.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>

          {/* Search */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search logs..."
            className="min-w-[200px] flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 focus:outline-none"
          />
        </div>

        {/* Stats */}
        <div className="mt-2 flex gap-4 text-xs text-zinc-500">
          <span>Total: {logs.length}</span>
          <span>Filtered: {filteredLogs.length}</span>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="border-b border-red-500/20 bg-red-500/10 p-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Logs Content */}
      <div className="flex-1 overflow-y-auto bg-zinc-950">
        {isLoading ? (
          <div className="p-4 text-sm text-zinc-400">Loading logs...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-4 text-sm text-zinc-400">
            {logs.length === 0
              ? 'No logs yet. Start tailing to see live logs.'
              : 'No logs match your filters.'}
          </div>
        ) : (
          <div>
            {filteredLogs.map((log) => (
              <LogEntryRow key={log.id} log={log} />
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}
