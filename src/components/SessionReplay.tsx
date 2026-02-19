// ---------------------------------------------------------------------------
// Session Replay — Modal Overlay Component
// ---------------------------------------------------------------------------

import { useEffect, useState, useRef, useCallback } from 'react';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import type { Message } from '@/stores/chat';
import { Dialog, DialogContent } from '@/components/ui/dialog';

// ---- Props ----------------------------------------------------------------

interface SessionReplayProps {
  sessionKey: string;
  startFromMessageId?: string;
  onClose: () => void;
  onFollowAgent?: (agentId: string) => void;
}

// ---- Helpers --------------------------------------------------------------

type PlaybackSpeed = 1 | 2 | 5 | 10;

function extractTextContent(msg: Message): string {
  return msg.content
    .filter((c) => c.type === 'text' && c.text)
    .map((c) => c.text!)
    .join('\n');
}

function roleLabel(msg: Message): string {
  if (msg.role === 'user') return 'operator';
  if (msg.role === 'system') return 'system';
  return msg.model ? `${msg.role} \u00b7 ${msg.model}` : msg.role;
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Detect delegation mentions in message text and return the target agent ID token. */
function detectDelegationTarget(text: string): string | null {
  const patterns = [
    /delegat(?:e|ing|ed)\s+(?:to|this\s+to)\s+(\w+)/i,
    /\u2192\s+(\w+)/,
    /hand(?:ing)?\s+off\s+to\s+(\w+)/i,
  ];
  for (const p of patterns) {
    const match = text.match(p);
    if (match?.[1]) return match[1].toLowerCase();
  }
  return null;
}

// ---- Component ------------------------------------------------------------

export function SessionReplay({
  sessionKey,
  startFromMessageId,
  onClose,
  onFollowAgent,
}: SessionReplayProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const feedRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load session history on mount
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { useConnectionStore } = await import('@/stores/connection');
        const { request } = useConnectionStore.getState();

        const result = await request<{ messages: Message[] }>('chat.history', {
          sessionKey,
          limit: 1000,
        });

        if (cancelled) return;

        const msgs = result.messages ?? [];
        setMessages(msgs);
        setIsLoading(false);

        // Jump to startFromMessageId if provided
        if (startFromMessageId) {
          const idx = msgs.findIndex((m) => m.id === startFromMessageId);
          if (idx >= 0) {
            setCurrentIndex(idx);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load session');
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionKey, startFromMessageId]);

  // Playback timer
  useEffect(() => {
    if (isPlaying && currentIndex < messages.length - 1) {
      timerRef.current = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= messages.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1000 / playbackSpeed);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isPlaying, playbackSpeed, messages.length, currentIndex]);

  // Stop playing when we reach the end
  useEffect(() => {
    if (currentIndex >= messages.length - 1) {
      setIsPlaying(false);
    }
  }, [currentIndex, messages.length]);

  // Auto-scroll
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [currentIndex]);

  const stepBack = useCallback(() => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
    setIsPlaying(false);
  }, []);

  const stepForward = useCallback(() => {
    setCurrentIndex((prev) => Math.min(messages.length - 1, prev + 1));
    setIsPlaying(false);
  }, [messages.length]);

  const togglePlay = useCallback(() => {
    if (currentIndex >= messages.length - 1) {
      // Restart from beginning
      setCurrentIndex(0);
      setIsPlaying(true);
    } else {
      setIsPlaying((prev) => !prev);
    }
  }, [currentIndex, messages.length]);

  // Compute running token counter
  const visibleMessages = messages.slice(0, currentIndex + 1);
  const tokenCount = visibleMessages.reduce(
    (acc, m) => ({
      input: acc.input + (m.tokenCount?.input ?? 0),
      output: acc.output + (m.tokenCount?.output ?? 0),
    }),
    { input: 0, output: 0 }
  );

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden border-zinc-800 bg-zinc-950 p-0">
        <div className="flex h-full max-h-[90vh] w-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-zinc-100">
                Session Replay: {sessionKey}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="ml-2 rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-100"
            >
              &times;
            </button>
          </div>

          {/* Playback controls */}
          <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-1.5">
            <button
              type="button"
              onClick={stepBack}
              disabled={currentIndex <= 0}
              className="rounded px-1.5 py-0.5 text-xs text-zinc-400 hover:bg-zinc-800 disabled:opacity-30"
            >
              &#9664;&#9664;
            </button>
            <button
              type="button"
              onClick={togglePlay}
              className="rounded px-2 py-0.5 text-xs font-medium text-amber-400 hover:bg-zinc-800"
            >
              {isPlaying ? '&#10074;&#10074;' : '&#9654;'}
            </button>
            <button
              type="button"
              onClick={stepForward}
              disabled={currentIndex >= messages.length - 1}
              className="rounded px-1.5 py-0.5 text-xs text-zinc-400 hover:bg-zinc-800 disabled:opacity-30"
            >
              &#9654;&#9654;
            </button>

            <span className="text-xs text-zinc-500">
              Step {currentIndex + 1} of {messages.length}
            </span>

            {/* Speed selector */}
            <div className="ml-auto flex items-center gap-1">
              <span className="text-xs text-zinc-600">Speed:</span>
              {([1, 2, 5, 10] as PlaybackSpeed[]).map((speed) => (
                <button
                  key={speed}
                  type="button"
                  onClick={() => setPlaybackSpeed(speed)}
                  className={`rounded px-1.5 py-0.5 text-xs transition-colors ${
                    playbackSpeed === speed
                      ? 'bg-amber-600 text-zinc-100'
                      : 'text-zinc-500 hover:bg-zinc-800'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>

          {/* Timeline scrubber */}
          <div className="border-b border-zinc-800 px-3 py-1">
            <input
              type="range"
              min={0}
              max={Math.max(0, messages.length - 1)}
              value={currentIndex}
              onChange={(e) => {
                setCurrentIndex(Number(e.target.value));
                setIsPlaying(false);
              }}
              className="w-full accent-amber-500"
            />
          </div>

          {/* Message display area */}
          <div ref={feedRef} className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
            {isLoading ? (
              <div className="flex h-32 items-center justify-center text-sm text-zinc-600">
                Loading session...
              </div>
            ) : error ? (
              <div className="flex h-32 items-center justify-center text-sm text-red-400">
                {error}
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-sm text-zinc-600">
                No messages in this session
              </div>
            ) : (
              visibleMessages.map((msg, i) => {
                const text = extractTextContent(msg);
                const delegationTarget = detectDelegationTarget(text);
                const isLatest = i === currentIndex;

                return (
                  <div
                    key={msg.id}
                    className={`rounded p-2 ${isLatest ? 'bg-zinc-800/50' : ''} ${
                      msg.role === 'user'
                        ? 'border-l-2 border-zinc-600'
                        : msg.role === 'system'
                          ? 'border-l-2 border-zinc-700'
                          : 'border-l-2 border-amber-500'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="font-medium text-zinc-400">[{roleLabel(msg)}]</span>
                      <span className="text-zinc-600">{formatTimestamp(msg.timestamp)}</span>
                    </div>
                    <div className="mt-0.5 text-sm text-zinc-200">
                      <MarkdownRenderer content={text} />
                    </div>

                    {/* Follow delegation button */}
                    {delegationTarget && onFollowAgent && (
                      <button
                        type="button"
                        onClick={() => onFollowAgent(delegationTarget)}
                        className="mt-1 rounded border border-amber-600/30 bg-amber-600/10 px-2 py-0.5 text-xs text-amber-400 hover:bg-amber-600/20"
                      >
                        Follow delegation &rarr; {delegationTarget}
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Token counter */}
          <div className="flex items-center justify-between border-t border-zinc-800 px-3 py-1.5 text-xs text-zinc-500">
            <span>
              Tokens: {tokenCount.input.toLocaleString()} in &middot;{' '}
              {tokenCount.output.toLocaleString()} out
            </span>
            {messages.length > 0 && messages[currentIndex]?.model && (
              <span>Model: {messages[currentIndex].model}</span>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
