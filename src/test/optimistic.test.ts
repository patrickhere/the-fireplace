import { describe, expect, it, vi } from 'vitest';

import { optimisticMutation } from '@/lib/optimistic';

const errorMock = vi.fn();

vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => errorMock(...args),
  },
}));

describe('optimisticMutation', () => {
  it('applies optimistic state and resolves on success', async () => {
    let state = { count: 1, label: 'a' };

    const result = await optimisticMutation(
      () => state,
      (partial) => {
        state = { ...state, ...partial };
      },
      {
        snapshot: (s) => ({ count: s.count, label: s.label }),
        apply: (s) => ({ count: s.count + 1 }),
        execute: async () => 'ok',
      }
    );

    expect(result).toBe('ok');
    expect(state.count).toBe(2);
    expect(errorMock).not.toHaveBeenCalled();
  });

  it('rolls back and toasts on failure', async () => {
    let state = { count: 5, label: 'x' };

    await expect(
      optimisticMutation(
        () => state,
        (partial) => {
          state = { ...state, ...partial };
        },
        {
          snapshot: (s) => ({ count: s.count, label: s.label }),
          apply: (s) => ({ count: s.count + 10, label: 'optimistic' }),
          execute: async () => {
            throw new Error('boom');
          },
          errorMessage: 'failed',
        }
      )
    ).rejects.toThrow('boom');

    expect(state).toEqual({ count: 5, label: 'x' });
    expect(errorMock).toHaveBeenCalledWith('failed');
  });
});
