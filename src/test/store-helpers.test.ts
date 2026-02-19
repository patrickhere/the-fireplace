import { describe, expect, it } from 'vitest';

import { cn, formatSessionKey } from '@/lib/utils';
import {
  extractTextFromEventMessage,
  isSilentReplyMessage,
  isInternalSystemMessage,
  normalizeHistoryEntry,
} from '@/stores/chat';
import type { Message } from '@/stores/chat';

describe('formatSessionKey', () => {
  it('formats agent main session', () => {
    expect(formatSessionKey('agent:calcifer:main')).toBe('Calcifer');
  });

  it('formats agent task session suffix', () => {
    expect(formatSessionKey('agent:buer:task-123')).toBe('Buer (task-123)');
  });
});

describe('extractTextFromEventMessage', () => {
  it('extracts text from mixed blocks', () => {
    const text = extractTextFromEventMessage([
      { type: 'text', text: 'hello' },
      { type: 'thinking', thinking: 'plan' },
      { type: 'tool_result', content: 'done' },
    ]);
    expect(text).toContain('hello');
    expect(text).toContain('plan');
    expect(text).toContain('done');
  });
});

describe('normalizeHistoryEntry', () => {
  it('uses 0 timestamp sentinel when missing', () => {
    const normalized = normalizeHistoryEntry({
      id: 'm1',
      role: 'assistant',
      content: 'hi',
    });
    expect(normalized).not.toBeNull();
    expect(normalized?.timestamp).toBe(0);
  });
});

// ---- Sentinel Token Filtering Tests ----------------------------------------

function makeMsg(role: 'user' | 'assistant' | 'system', text: string): Message {
  return {
    id: 'test',
    role,
    content: [{ type: 'text', text }],
    timestamp: Date.now(),
  };
}

describe('isSilentReplyMessage', () => {
  it('returns true for NO_REPLY', () => {
    expect(isSilentReplyMessage(makeMsg('assistant', 'NO_REPLY'))).toBe(true);
  });

  it('returns true for HEARTBEAT_OK', () => {
    expect(isSilentReplyMessage(makeMsg('assistant', 'HEARTBEAT_OK'))).toBe(true);
  });

  it('returns true for NO_REPLY with trailing punctuation', () => {
    expect(isSilentReplyMessage(makeMsg('assistant', 'NO_REPLY.'))).toBe(true);
  });

  it('returns true for NO_REPLY with whitespace', () => {
    expect(isSilentReplyMessage(makeMsg('assistant', '  NO_REPLY  '))).toBe(true);
  });

  it('returns false for normal assistant text', () => {
    expect(isSilentReplyMessage(makeMsg('assistant', 'Here is your reply'))).toBe(false);
  });

  it('returns false for user messages even with sentinel text', () => {
    expect(isSilentReplyMessage(makeMsg('user', 'NO_REPLY'))).toBe(false);
  });
});

describe('isInternalSystemMessage', () => {
  it('returns true for compaction prompt', () => {
    expect(isInternalSystemMessage(makeMsg('system', 'Session nearing compaction threshold'))).toBe(
      true
    );
  });

  it('returns true for NO_REPLY instruction', () => {
    expect(
      isInternalSystemMessage(makeMsg('system', 'If nothing to say, reply with NO_REPLY'))
    ).toBe(true);
  });

  it('returns false for normal system messages', () => {
    expect(isInternalSystemMessage(makeMsg('system', 'Welcome to the session'))).toBe(false);
  });
});

// ---- Metadata Stripping Tests ----------------------------------------------

describe('stripGatewayMetadata (via normalizeHistoryEntry)', () => {
  function stripVia(text: string): string {
    const entry = normalizeHistoryEntry({ id: 't', role: 'user', content: text });
    if (!entry) return '';
    const textBlock = entry.content.find((c) => c.type === 'text');
    return textBlock?.text ?? '';
  }

  it('strips fenced JSON metadata blocks', () => {
    const input = 'Conversation info (untrusted metadata):\n```json\n{"key":"val"}\n```\nHello';
    expect(stripVia(input)).toBe('Hello');
  });

  it('strips unfenced metadata blocks', () => {
    const input = 'Conversation info (untrusted metadata):\n{"key":"val"}\nHello';
    expect(stripVia(input)).toBe('Hello');
  });

  it('strips metadata with Copy artifact', () => {
    const input =
      'Conversation info (untrusted metadata):\n```json\nCopy\n{"key":"val"}\n```\nHello';
    expect(stripVia(input)).toBe('Hello');
  });

  it('strips chat context wrappers', () => {
    const input = '[Chat messages since your last reply - for context]\nHello';
    expect(stripVia(input)).toBe('Hello');
  });

  it('preserves normal message text', () => {
    const input = 'Hello, how are you?';
    expect(stripVia(input)).toBe('Hello, how are you?');
  });
});

describe('cn', () => {
  it('merges and deduplicates tailwind classes', () => {
    expect(cn('p-2 text-zinc-100', 'p-4')).toBe('text-zinc-100 p-4');
  });
});
