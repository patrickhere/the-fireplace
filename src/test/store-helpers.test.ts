import { describe, expect, it } from 'vitest';

import { cn, formatSessionKey } from '@/lib/utils';
import { extractTextFromEventMessage, normalizeHistoryEntry } from '@/stores/chat';

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

describe('cn', () => {
  it('merges and deduplicates tailwind classes', () => {
    expect(cn('p-2 text-zinc-100', 'p-4')).toBe('text-zinc-100 p-4');
  });
});
