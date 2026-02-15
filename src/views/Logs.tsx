// ---------------------------------------------------------------------------
// Logs & Debug View
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useLogsStore } from '@/stores/logs';
import { useConnectionStore } from '@/stores/connection';

// ---- Log Line Parsing & Coloring ------------------------------------------

type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'unknown';

function parseLogLevel(line: string): LogLevel {
  // Common log patterns: [ERROR], [WARN], ERROR:, WARN:, level=error, etc.
  const lower = line.toLowerCase();
  if (
    lower.includes('[error]') ||
    lower.includes('error:') ||
    lower.includes('level=error') ||
    lower.includes('"level":"error"')
  ) {
    return 'error';
  }
  if (
    lower.includes('[warn]') ||
    lower.includes('warn:') ||
    lower.includes('warning:') ||
    lower.includes('level=warn') ||
    lower.includes('"level":"warn"')
  ) {
    return 'warn';
  }
  if (
    lower.includes('[debug]') ||
    lower.includes('debug:') ||
    lower.includes('level=debug') ||
    lower.includes('"level":"debug"')
  ) {
    return 'debug';
  }
  if (
    lower.includes('[info]') ||
    lower.includes('info:') ||
    lower.includes('level=info') ||
    lower.includes('"level":"info"')
  ) {
    return 'info';
  }
  return 'unknown';
}

function levelTextClass(level: LogLevel): string {
  switch (level) {
    case 'error':
      return 'text-red-400';
    case 'warn':
      return 'text-amber-400';
    case 'info':
      return 'text-zinc-300';
    case 'debug':
      return 'text-zinc-500';
    default:
      return 'text-zinc-400';
  }
}

// ---- Log Line Component ---------------------------------------------------

function LogLine({ line, index }: { line: string; index: number }) {
  const level = parseLogLevel(line);
  const colorClass = levelTextClass(level);

  return (
    <div className={`leading-5 break-all whitespace-pre-wrap ${colorClass}`}>
      <span className="mr-3 inline-block w-10 text-right text-zinc-600 select-none">
        {index + 1}
      </span>
      {line}
    </div>
  );
}

// ---- Logs Tab Content -----------------------------------------------------

function LogsTab() {
  const {
    lines,
    fileName,
    fileSize,
    isLoading,
    isTailing,
    error,
    startTailing,
    stopTailing,
    clearLogs,
  } = useLogsStore();

  const { status } = useConnectionStore();

  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const prevLineCountRef = useRef(0);

  // Start tailing on mount if connected
  useEffect(() => {
    if (status === 'connected') {
      startTailing();
    }

    return () => {
      stopTailing();
    };
  }, [status, startTailing, stopTailing]);

  // Auto-scroll to bottom when new lines arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current && lines.length > prevLineCountRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    prevLineCountRef.current = lines.length;
  }, [lines.length, autoScroll]);

  // Detect manual scroll (disable auto-scroll when user scrolls up)
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 40;
    setAutoScroll(isAtBottom);
  }, []);

  const handleToggleTailing = useCallback(() => {
    if (isTailing) {
      stopTailing();
    } else {
      startTailing();
    }
  }, [isTailing, startTailing, stopTailing]);

  const handleClear = useCallback(() => {
    clearLogs();
  }, [clearLogs]);

  const handleScrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setAutoScroll(true);
    }
  }, []);

  // Count lines by level
  const levelCounts = useMemo(() => {
    const counts = { error: 0, warn: 0, info: 0, debug: 0, unknown: 0 };
    for (const line of lines) {
      const level = parseLogLevel(line);
      counts[level]++;
    }
    return counts;
  }, [lines]);

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-zinc-700 px-3 py-2">
        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleTailing}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              isTailing
                ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
            }`}
            type="button"
          >
            {isTailing ? 'Stop Tailing' : 'Start Tailing'}
          </button>
          <button
            onClick={handleClear}
            className="rounded-md bg-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-600"
            type="button"
          >
            Clear
          </button>
          {!autoScroll && (
            <button
              onClick={handleScrollToBottom}
              className="rounded-md bg-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-600"
              type="button"
            >
              Scroll to Bottom
            </button>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs text-zinc-500">
          {levelCounts.error > 0 && (
            <span className="text-red-400">{levelCounts.error} errors</span>
          )}
          {levelCounts.warn > 0 && (
            <span className="text-amber-400">{levelCounts.warn} warnings</span>
          )}
          <span>{lines.length} lines</span>
          {fileName && <span className="font-mono">{fileName}</span>}
          {fileSize > 0 && <span>{(fileSize / 1024).toFixed(1)} KB</span>}
          {isTailing && (
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              Live
            </span>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="border-b border-red-500/20 bg-red-500/10 px-3 py-2">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Log Output */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto bg-zinc-950 p-2 font-mono text-xs"
      >
        {isLoading && lines.length === 0 ? (
          <div className="p-4 text-sm text-zinc-500">Loading logs...</div>
        ) : lines.length === 0 ? (
          <div className="p-4 text-sm text-zinc-600">
            No log lines yet.{' '}
            {isTailing ? 'Waiting for output...' : 'Click "Start Tailing" to begin.'}
          </div>
        ) : (
          lines.map((line, index) => <LogLine key={index} line={line} index={index} />)
        )}
      </div>
    </div>
  );
}

// ---- Debug Tab Content ----------------------------------------------------

function DebugTab() {
  const { lastDebugResult, isDebugLoading, callMethod } = useLogsStore();

  const [method, setMethod] = useState('');
  const [paramsJson, setParamsJson] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);

  const handleSend = useCallback(async () => {
    if (!method.trim()) return;

    let parsedParams: unknown = undefined;

    if (paramsJson.trim()) {
      try {
        parsedParams = JSON.parse(paramsJson);
        setParseError(null);
      } catch (err) {
        setParseError(err instanceof Error ? err.message : 'Invalid JSON');
        return;
      }
    }

    await callMethod(method.trim(), parsedParams);
  }, [method, paramsJson, callMethod]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        handleSend();
      }
    },
    [handleSend]
  );

  const formattedResult = useMemo(() => {
    if (!lastDebugResult) return null;

    if (lastDebugResult.ok) {
      try {
        return JSON.stringify(lastDebugResult.payload, null, 2);
      } catch {
        return String(lastDebugResult.payload);
      }
    }

    return lastDebugResult.error ?? 'Unknown error';
  }, [lastDebugResult]);

  return (
    <div className="flex h-full flex-col">
      {/* Input Area */}
      <div className="space-y-3 border-b border-zinc-700 p-3">
        <div>
          <label className="mb-1 block text-xs text-zinc-500">Method</label>
          <input
            type="text"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. system.info, agents.list, sessions.list"
            className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 font-mono text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-amber-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-zinc-500">
            Params (JSON) — Ctrl/Cmd+Enter to send
          </label>
          <textarea
            value={paramsJson}
            onChange={(e) => {
              setParamsJson(e.target.value);
              setParseError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder='{"key": "value"}'
            rows={4}
            spellCheck={false}
            className="w-full resize-y rounded-md border border-zinc-700 bg-zinc-800 p-2 font-mono text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-amber-500"
          />
          {parseError && (
            <p className="mt-1 text-xs text-red-400">JSON parse error: {parseError}</p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={handleSend}
            disabled={isDebugLoading || !method.trim()}
            className="rounded-md bg-amber-500 px-4 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
            type="button"
          >
            {isDebugLoading ? 'Sending...' : 'Send'}
          </button>

          {lastDebugResult && (
            <span className="text-xs text-zinc-500">
              {lastDebugResult.durationMs}ms
              {lastDebugResult.ok ? (
                <span className="ml-2 text-emerald-400">OK</span>
              ) : (
                <span className="ml-2 text-red-400">Error</span>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Response Output */}
      <div className="flex-1 overflow-y-auto bg-zinc-950 p-3">
        {lastDebugResult === null ? (
          <div className="text-sm text-zinc-600">
            Enter a gateway method name and optional params, then click "Send" to execute.
          </div>
        ) : (
          <pre
            className={`font-mono text-xs break-all whitespace-pre-wrap ${
              lastDebugResult.ok ? 'text-zinc-300' : 'text-red-400'
            }`}
          >
            {formattedResult}
          </pre>
        )}
      </div>
    </div>
  );
}

// ---- Main Logs View -------------------------------------------------------

export function Logs() {
  const [activeTab, setActiveTab] = useState<'logs' | 'debug'>('logs');

  return (
    <div className="flex h-full flex-col">
      {/* Header with Tabs */}
      <div className="border-b border-zinc-700 p-3">
        <h1 className="mb-2 text-lg font-semibold text-zinc-100">Logs & Debug</h1>
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('logs')}
            className={`rounded-md px-3 py-1.5 text-sm ${
              activeTab === 'logs'
                ? 'bg-zinc-700 font-medium text-zinc-100'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300'
            }`}
            type="button"
          >
            Logs
          </button>
          <button
            onClick={() => setActiveTab('debug')}
            className={`rounded-md px-3 py-1.5 text-sm ${
              activeTab === 'debug'
                ? 'bg-zinc-700 font-medium text-zinc-100'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300'
            }`}
            type="button"
          >
            Debug
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'logs' ? <LogsTab /> : <DebugTab />}
      </div>
    </div>
  );
}
