// ---------------------------------------------------------------------------
// Demon Chat Room — Inter-Demon Communication View
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState, useMemo, useCallback, forwardRef } from 'react';
import { useDemonChatStore, type DemonChatMessage } from '@/stores/demonChat';
import { useAgentsStore, type Agent } from '@/stores/agents';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { EmptyState } from '@/components/StateIndicators';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ---- Caret-position helper -------------------------------------------------

/**
 * CSS properties that affect text layout and must be mirrored from the
 * textarea to the hidden measurement div.
 */
const MIRROR_PROPERTIES: (keyof CSSStyleDeclaration)[] = [
  'boxSizing',
  'width',
  'height',
  'overflowX',
  'overflowY',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontSize',
  'fontSizeAdjust',
  'lineHeight',
  'fontFamily',
  'textAlign',
  'textTransform',
  'textIndent',
  'textDecoration',
  'letterSpacing',
  'wordSpacing',
  'tabSize',
  'whiteSpace',
  'wordBreak',
  'overflowWrap',
];

/**
 * Compute the pixel coordinates of the character at `caretIndex` inside
 * `textarea`, relative to the viewport (suitable for `position: fixed`).
 *
 * Returns coordinates of the *bottom* of the caret so the popover can be
 * placed just below the current line.
 */
function getCaretCoordinates(
  textarea: HTMLTextAreaElement,
  caretIndex: number
): { top: number; left: number } {
  const computed = window.getComputedStyle(textarea);

  // Create an off-screen mirror div
  const mirror = document.createElement('div');
  mirror.style.position = 'absolute';
  mirror.style.top = '-9999px';
  mirror.style.left = '-9999px';
  mirror.style.visibility = 'hidden';
  mirror.style.pointerEvents = 'none';

  // Copy layout-relevant styles.
  // `CSSStyleDeclaration` is typed as an iterable object whose string-keyed
  // entries map to string values, so we widen through `unknown` to apply
  // the same interface to the mirror's writable style object — no `any` needed.
  const mirrorStyle = mirror.style as unknown as Record<string, string>;
  for (const prop of MIRROR_PROPERTIES) {
    const value = computed[prop as keyof CSSStyleDeclaration];
    if (typeof value === 'string') {
      mirrorStyle[prop as string] = value;
    }
  }

  // Insert text before the caret, then a zero-width marker span
  const textBefore = textarea.value.slice(0, caretIndex);
  const textAfter = textarea.value.slice(caretIndex);

  mirror.textContent = '';
  const beforeNode = document.createTextNode(textBefore);
  const marker = document.createElement('span');
  marker.textContent = '\u200b'; // zero-width space — gives the span measurable size
  const afterNode = document.createTextNode(textAfter || '\u200b');

  mirror.appendChild(beforeNode);
  mirror.appendChild(marker);
  mirror.appendChild(afterNode);

  document.body.appendChild(mirror);

  const markerRect = marker.getBoundingClientRect();
  const textareaRect = textarea.getBoundingClientRect();

  document.body.removeChild(mirror);

  // Mirror is positioned at (-9999, -9999); the marker rect offset from the
  // mirror origin equals the offset inside the textarea (after accounting for
  // scroll).  We reconstruct the viewport-relative position:
  const mirrorLeft =
    -9999 + parseInt(computed.borderLeftWidth, 10) + parseInt(computed.paddingLeft, 10);
  const mirrorTop =
    -9999 + parseInt(computed.borderTopWidth, 10) + parseInt(computed.paddingTop, 10);

  const relLeft = markerRect.left - mirrorLeft - textarea.scrollLeft;
  const relTop = markerRect.top - mirrorTop - textarea.scrollTop;

  // Clamp to within the visible textarea area
  const clampedLeft = Math.max(0, Math.min(relLeft, textarea.clientWidth));
  const clampedTop = Math.max(0, Math.min(relTop, textarea.clientHeight));

  return {
    left: textareaRect.left + clampedLeft,
    top: textareaRect.top + clampedTop + markerRect.height, // place below the line
  };
}

/**
 * Clamp a popover so it stays within the viewport.
 */
function clampPopover(
  pos: { top: number; left: number },
  popoverWidth: number,
  popoverHeight: number
): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = 8;

  let { top, left } = pos;

  // Flip above if it would run off the bottom
  if (top + popoverHeight + margin > vh) {
    top = pos.top - popoverHeight - (popoverHeight > 0 ? 4 : 0);
  }

  // Keep within horizontal bounds
  left = Math.max(margin, Math.min(left, vw - popoverWidth - margin));

  // Keep within vertical bounds (floor)
  top = Math.max(margin, top);

  return { top, left };
}

// ---- Color Palette --------------------------------------------------------

const DEMON_COLORS = [
  'border-amber-500',
  'border-amber-400',
  'border-zinc-400',
  'border-amber-600',
  'border-zinc-300',
  'border-amber-300',
  'border-zinc-500',
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

// ---- Mention Popover -------------------------------------------------------

const POPOVER_WIDTH = 240; // px — used for pre-mount clamping estimate

interface MentionPopoverProps {
  suggestions: Agent[];
  selectedIndex: number;
  pos: { top: number; left: number };
  onSelect: (index: number) => void;
}

/**
 * A `position:fixed` popover that appears anchored to the caret position in
 * the textarea.  Uses `forwardRef` so the parent can detect outside clicks.
 *
 * On first paint the popover measures its own bounding rect and adjusts its
 * position to stay within the viewport.
 */
const MentionPopover = forwardRef<HTMLDivElement, MentionPopoverProps>(
  ({ suggestions, selectedIndex, pos, onSelect }, ref) => {
    const [adjustedPos, setAdjustedPos] = useState(pos);
    const innerRef = useRef<HTMLDivElement | null>(null);

    // After mount (or when pos changes), re-measure and clamp
    useEffect(() => {
      const el = innerRef.current;
      if (!el) {
        setAdjustedPos(clampPopover(pos, POPOVER_WIDTH, 200));
        return;
      }
      const { width, height } = el.getBoundingClientRect();
      setAdjustedPos(clampPopover(pos, width, height));
    }, [pos]);

    return (
      <div
        ref={(node) => {
          innerRef.current = node;
          if (typeof ref === 'function') {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        style={{
          position: 'fixed',
          top: adjustedPos.top,
          left: adjustedPos.left,
          width: POPOVER_WIDTH,
          zIndex: 50,
        }}
        className="overflow-hidden rounded border border-zinc-700 bg-zinc-800 shadow-xl"
      >
        {suggestions.map((agent, idx) => (
          <button
            key={agent.id}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault(); // prevent textarea blur
              onSelect(idx);
            }}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
              idx === selectedIndex
                ? 'bg-amber-500/20 text-amber-400'
                : 'text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            <span>{agent.identity?.emoji ?? '👤'}</span>
            <span>{agent.identity?.name ?? agent.id}</span>
          </button>
        ))}
      </div>
    );
  }
);
MentionPopover.displayName = 'MentionPopover';

// ---- Main View ------------------------------------------------------------

export function DemonChatRoom() {
  const {
    messages,
    activeDemonFilters,
    isListening,
    startListening,
    teardown,
    toggleDemonFilter,
    getFilteredMessages,
    injectMessage,
  } = useDemonChatStore();

  const { agents, loadAgents } = useAgentsStore();

  const [injectDemonId, setInjectDemonId] = useState('');
  const [injectText, setInjectText] = useState('');
  const [isSending, setIsSending] = useState(false);

  // @mention autocomplete state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionAtIndex, setMentionAtIndex] = useState<number>(-1);
  const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0);
  // Caret-anchored popover position (viewport-relative, for position:fixed)
  const [mentionPos, setMentionPos] = useState<{ top: number; left: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionDropdownRef = useRef<HTMLDivElement>(null);

  const feedRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  // Load agents on mount
  useEffect(() => {
    if (agents.length === 0) {
      loadAgents();
    }
  }, [agents.length, loadAgents]);

  // Start listening on mount, full teardown on unmount
  useEffect(() => {
    startListening();
    return () => teardown();
  }, [startListening, teardown]);

  // Dismiss @mention dropdown on outside click
  useEffect(() => {
    if (mentionQuery === null) return;
    const handler = (e: MouseEvent) => {
      if (
        mentionDropdownRef.current &&
        !mentionDropdownRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        setMentionQuery(null);
        setMentionAtIndex(-1);
        setMentionPos(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [mentionQuery]);

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

  // @mention — filtered agent suggestions
  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return agents.filter((a) => {
      const name = (a.identity?.name ?? a.id).toLowerCase();
      return name.startsWith(q) || a.id.toLowerCase().startsWith(q);
    });
  }, [mentionQuery, agents]);

  // Insert selected mention into textarea text
  const commitMention = useCallback(
    (agentIndex: number) => {
      const agent = mentionSuggestions[agentIndex];
      if (!agent || mentionAtIndex === -1) return;

      const name = agent.identity?.name ?? agent.id;
      const before = injectText.slice(0, mentionAtIndex);
      const after = injectText.slice(mentionAtIndex + 1 + (mentionQuery?.length ?? 0));
      const newText = `${before}@${name} ${after}`;

      setInjectText(newText);
      setMentionQuery(null);
      setMentionAtIndex(-1);
      setMentionPos(null);

      // Move cursor to after the inserted mention
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          const pos = before.length + name.length + 2; // @name + space
          textareaRef.current.setSelectionRange(pos, pos);
          textareaRef.current.focus();
        }
      });
    },
    [mentionSuggestions, mentionAtIndex, mentionQuery, injectText]
  );

  // Detect @mention trigger on text change
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInjectText(value);

    const cursor = e.target.selectionStart ?? value.length;

    // Find the last @ before the cursor that isn't preceded by a word char
    const textBeforeCursor = value.slice(0, cursor);
    const atMatch = /(?:^|[\s])(@(\w*))$/.exec(textBeforeCursor);

    if (atMatch && textareaRef.current) {
      const atPos = textBeforeCursor.lastIndexOf('@');
      setMentionAtIndex(atPos);
      setMentionQuery(atMatch[2] ?? '');
      setMentionSelectedIndex(0);
      // Compute caret coordinates for the @ symbol position
      const pos = getCaretCoordinates(textareaRef.current, atPos);
      setMentionPos(pos);
    } else {
      setMentionQuery(null);
      setMentionAtIndex(-1);
      setMentionPos(null);
    }
  };

  /**
   * Fired when the selection changes inside the textarea (including plain
   * cursor moves via arrow keys or mouse clicks).  If the cursor is no longer
   * inside the active @mention span we dismiss the popover.
   */
  const handleSelect = useCallback(() => {
    if (mentionQuery === null || mentionAtIndex === -1) return;
    const ta = textareaRef.current;
    if (!ta) return;

    const cursor = ta.selectionStart ?? 0;
    const mentionEnd = mentionAtIndex + 1 + (mentionQuery?.length ?? 0);

    // Cursor must stay within [mentionAtIndex, mentionEnd] (inclusive)
    if (cursor < mentionAtIndex || cursor > mentionEnd) {
      setMentionQuery(null);
      setMentionAtIndex(-1);
      setMentionPos(null);
    }
  }, [mentionQuery, mentionAtIndex]);

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
    // Handle @mention dropdown navigation first
    if (mentionQuery !== null && mentionSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionSelectedIndex((i) => (i + 1) % mentionSuggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionSelectedIndex(
          (i) => (i - 1 + mentionSuggestions.length) % mentionSuggestions.length
        );
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        commitMention(mentionSelectedIndex);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionQuery(null);
        setMentionAtIndex(-1);
        setMentionPos(null);
        return;
      }
    }

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
          <EmptyState
            message={isListening ? 'Listening for demon activity...' : 'Not connected'}
            detail={isListening ? 'Messages will appear as demons communicate.' : undefined}
          />
        ) : (
          filteredMessages.map((msg) => <ChatMessage key={msg.id} msg={msg} />)
        )}
      </div>

      {/* Inject bar */}
      <div className="border-t border-zinc-800 px-3 py-2">
        {/*
          @mention popover — anchored to the caret position using position:fixed.
          Rendered here in the DOM but visually floated to the caret coordinates.
          z-50 keeps it above all other chrome.
        */}
        {mentionQuery !== null && mentionSuggestions.length > 0 && mentionPos !== null && (
          <MentionPopover
            ref={mentionDropdownRef}
            suggestions={mentionSuggestions}
            selectedIndex={mentionSelectedIndex}
            pos={mentionPos}
            onSelect={commitMention}
          />
        )}

        <div className="flex items-end gap-2">
          <Select value={injectDemonId} onValueChange={setInjectDemonId}>
            <SelectTrigger className="w-52 rounded border-zinc-700 bg-zinc-800">
              <SelectValue placeholder="Select demon..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">🔥 All Demons</SelectItem>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.identity?.emoji ?? ''} {agent.identity?.name ?? agent.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <textarea
            ref={textareaRef}
            value={injectText}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            onSelect={handleSelect}
            placeholder="Inject message... (Cmd+Enter to send, @ to mention)"
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
    </div>
  );
}
