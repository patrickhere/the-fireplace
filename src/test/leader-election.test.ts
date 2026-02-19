import { describe, expect, it } from 'vitest';

import { pickLeaderWinnerId, shouldPromoteFollower } from '@/gateway/client';

describe('leader election helpers', () => {
  it('picks deterministic winner (lowest lexical id)', () => {
    const winner = pickLeaderWinnerId([
      'f0000000-0000-0000-0000-000000000000',
      '10000000-0000-0000-0000-000000000000',
      'a0000000-0000-0000-0000-000000000000',
    ]);
    expect(winner).toBe('10000000-0000-0000-0000-000000000000');
  });

  it('returns null when no contenders exist', () => {
    expect(pickLeaderWinnerId([])).toBeNull();
  });

  it('promotes follower at threshold and above', () => {
    expect(shouldPromoteFollower(2)).toBe(false);
    expect(shouldPromoteFollower(3)).toBe(true);
    expect(shouldPromoteFollower(5)).toBe(true);
  });
});
