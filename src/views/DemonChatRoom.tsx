// ---------------------------------------------------------------------------
// Demon Chat Room — Inter-Demon Communication View
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState, useMemo } from 'react';
import { useDemonChatStore } from '@/stores/demonChat';
import { useAgentsStore } from '@/stores/agents';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import type { DemonChatMessage } from '@/stores/demonChat';

// ---- Color Palette --------------------------------------------------------

const DEMON_COLORS = [
  'border-amber-500',
  'border-emerald-500',
  'border-sky-500',
  'border-violet-500',
  'border-rose-500',
  'border-orange-500',
  'border-teal-500',
];

function stableColorIndex(demonId: string): number {
  let hash = 0;
  for (let i = 0; i < demonId.length; i++) {
    hash = (hash * 31 + demonId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % DEMON_COLORS.length;
}

function getDemonBorderClass(demonId: string): string {
  return DEMON_COLORS[stableColorIndex(demonId)] ?? 'border-amber-500';
}

// ---- Relative Time --------------------------------------------------------

function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 5000) return 'just now';
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

// ---- Message Component ----------------------------------------------------

function ChatMessage({ msg }: { msg: DemonChatMessage }) {
  const borderClass = getDemonBorderClass(msg.demonId);

  return (
    <div className={`border-l-2 ${borderClass} p-2`}>
      {/* Header: emoji + name + delegation arrow */}
      <div className="flex items-center gap-1.5 text-xs">
        <span>{msg.demonEmoji}</span>
        <span className="font-medium text-zinc-100">{msg.demonName}</span>
        {msg.isDelegation && msg.targetDemonId && (
          <span className="text-amber-400"> &rarr; {msg.targetDemonId}</span>
        )}
        {msg.model && (
          <span className="rounded bg-zinc-800 px-1 py-0.5 text-zinc-500">{msg.model}</span>
        )}
        <span className="ml-auto text-zinc-600">{relativeTime(msg.timestamp)}</span>
      </div>

      {/* Content */}
      <div className="mt-0.5 text-sm text-zinc-300">
        <MarkdownRenderer content={msg.content} />
      </div>
    </div>
  );
}

// ---- Main View ------------------------------------------------------------

export function DemonChatRoom() {
  const {
    messages,
    activeDemonFilters,
    isListening,
    startListening,
    stopListening,
    toggleDemonFilter,
    getFilteredMessages,
    injectMessage,
  } = useDemonChatStore();

  const { agents, loadAgents } = useAgentsStore();

  const [injectDemonId, setInjectDemonId] = useState('');
  const [injectText, setInjectText] = useState('');
  const [isSending, setIsSending] = useState(false);

  const feedRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  // Load agents on mount
  useEffect(() => {
    if (agents.length === 0) {
      loadAgents();
    }
  }, [agents.length, loadAgents]);

  // Start listening on mount, stop on unmount
  useEffect(() => {
    startListening();
    return () => stopListening();
  }, [startListening, stopListening]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (isAtBottomRef.current && feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [messages]);

  const handleScroll = () => {
    if (!feedRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = feedRef.current;
    isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 40;
  };

  const filteredMessages = useMemo(
    () => getFilteredMessages(),
    [messages, activeDemonFilters, getFilteredMessages]
  );

  const handleInject = async () => {
    if (!injectDemonId || !injectText.trim()) return;
    setIsSending(true);
    try {
      await injectMessage(injectDemonId, injectText.trim());
      setInjectText('');
    } catch (err) {
      console.error('[DemonChatRoom] Inject failed:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.metaKey) {
      e.preventDefault();
      handleInject();
    }
  };

  return (
    <div className="flex h-full flex-col bg-zinc-900">
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b border-zinc-800 px-3 py-2">
        <h1 className="text-sm font-semibold text-zinc-100">Demon Chat Room</h1>

        {/* Demon filter toggles */}
        <div className="flex items-center gap-1">
          {agents.map((agent) => (
            <button
              key={agent.id}
              type="button"
              onClick={() => toggleDemonFilter(agent.id)}
              className={`rounded px-1.5 py-0.5 text-sm transition-colors ${
                activeDemonFilters.has(agent.id)
                  ? 'border border-amber-500 bg-amber-500/10'
                  : 'border border-zinc-700 bg-zinc-800 hover:border-zinc-600'
              }`}
              title={agent.identity?.name ?? agent.id}
            >
              {agent.identity?.emoji ?? agent.id.charAt(0)}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2 text-xs text-zinc-500">
          <span>{filteredMessages.length} messages</span>
          <span
            className={`h-1.5 w-1.5 rounded-full ${isListening ? 'bg-emerald-500' : 'bg-zinc-600'}`}
          />
        </div>
      </div>

      {/* Message feed */}
      <div
        ref={feedRef}
        onScroll={handleScroll}
        className="flex-1 space-y-1 overflow-y-auto px-3 py-2"
      >
        {filteredMessages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-600">
            {isListening ? 'Listening for demon activity...' : 'Not connected'}
          </div>
        ) : (
          filteredMessages.map((msg) => <ChatMessage key={msg.id} msg={msg} />)
        )}
      </div>

      {/* Inject bar */}
      <div className="flex items-end gap-2 border-t border-zinc-800 px-3 py-2">
        <select
          value={injectDemonId}
          onChange={(e) => setInjectDemonId(e.target.value)}
          className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-amber-500"
        >
          <option value="">Select demon...</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.identity?.emoji ?? ''} {agent.identity?.name ?? agent.id}
            </option>
          ))}
        </select>

        <textarea
          value={injectText}
          onChange={(e) => setInjectText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Inject message... (Cmd+Enter to send)"
          rows={1}
          className="flex-1 resize-none rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-amber-500"
        />

        <button
          type="button"
          onClick={handleInject}
          disabled={!injectDemonId || !injectText.trim() || isSending}
          className="rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-zinc-100 transition-colors hover:bg-amber-500 disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  );
}
