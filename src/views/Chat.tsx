// ---------------------------------------------------------------------------
// Chat View
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';
import { useChatStore } from '@/stores/chat';
import { useConnectionStore } from '@/stores/connection';
import { SessionSelector } from '@/components/molecules/SessionSelector';
import { SessionConfigPanel } from '@/components/molecules/SessionConfigPanel';
import { MessageBubble } from '@/components/molecules/MessageBubble';
import { MessageInput } from '@/components/molecules/MessageInput';
import { InjectNoteModal } from '@/components/molecules/InjectNoteModal';
import { StatusDot } from '@/components/atoms/StatusDot';

function StreamingIndicator() {
  return (
    <div className="animate-fade-in mb-3 flex justify-start">
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <div className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
            <div
              className="h-2 w-2 animate-pulse rounded-full bg-amber-500"
              style={{ animationDelay: '0.2s' }}
            />
            <div
              className="h-2 w-2 animate-pulse rounded-full bg-amber-500"
              style={{ animationDelay: '0.4s' }}
            />
          </div>
          <span className="text-sm text-zinc-400">Streaming...</span>
        </div>
      </div>
    </div>
  );
}

export function Chat() {
  const {
    messages,
    isStreaming,
    streamingMessageId,
    activeSessionKey,
    loadHistory,
    subscribeToEvents,
    unsubscribeFromEvents,
    error,
  } = useChatStore();
  const { status } = useConnectionStore();
  const [showConfig, setShowConfig] = useState(false);
  const [showInjectModal, setShowInjectModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true);

  useEffect(() => {
    if (activeSessionKey && status === 'connected') {
      void loadHistory(activeSessionKey);
    }
  }, [activeSessionKey, status, loadHistory]);

  useEffect(() => {
    if (activeSessionKey && status === 'connected') {
      subscribeToEvents();
    }
    return () => {
      unsubscribeFromEvents();
    };
  }, [activeSessionKey, status, subscribeToEvents, unsubscribeFromEvents]);

  useEffect(() => {
    if (isScrolledToBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isScrolledToBottom]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      setIsScrolledToBottom(scrollHeight - scrollTop - clientHeight < 50);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const dotStatus =
    status === 'connected'
      ? 'online'
      : status === 'error'
        ? 'error'
        : status === 'connecting' || status === 'reconnecting'
          ? 'warning'
          : 'offline';

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-zinc-700 p-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-zinc-100">Chat</h2>
          <SessionSelector />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <StatusDot
              status={dotStatus}
              pulse={status === 'connecting' || status === 'reconnecting'}
            />
            <span className="text-xs text-zinc-400">{status}</span>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
              type="button"
            >
              Config
            </button>
            <SessionConfigPanel isOpen={showConfig} onClose={() => setShowConfig(false)} />
          </div>

          <button
            onClick={() => setShowInjectModal(true)}
            className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
            type="button"
          >
            Inject Note
          </button>
        </div>
      </div>

      {error && (
        <div className="border-b border-red-500/20 bg-red-500/10 p-2 text-sm text-red-400">
          {error}
        </div>
      )}

      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-3">
        {messages.length === 0 && !isStreaming && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-zinc-500">
              {status === 'connected' ? 'Start a conversation...' : 'Connecting to gateway...'}
            </p>
          </div>
        )}

        {messages.length === 0 && isStreaming && (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="flex gap-1">
                <div className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
                <div
                  className="h-2 w-2 animate-pulse rounded-full bg-amber-500"
                  style={{ animationDelay: '0.2s' }}
                />
                <div
                  className="h-2 w-2 animate-pulse rounded-full bg-amber-500"
                  style={{ animationDelay: '0.4s' }}
                />
              </div>
              <p className="text-sm text-zinc-500">Waiting for response...</p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isStreaming={isStreaming && msg.id === streamingMessageId}
          />
        ))}

        {isStreaming && !streamingMessageId && <StreamingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {!isScrolledToBottom && (
        <button
          onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
          className="absolute right-6 bottom-24 rounded-full bg-zinc-800 p-2 text-zinc-400 shadow-lg hover:bg-zinc-700 hover:text-zinc-100"
          type="button"
          aria-label="Scroll to bottom"
        >
          ↓
        </button>
      )}

      <MessageInput />
      <InjectNoteModal open={showInjectModal} onClose={() => setShowInjectModal(false)} />
    </div>
  );
}
