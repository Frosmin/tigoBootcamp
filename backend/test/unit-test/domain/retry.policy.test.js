import { describe, expect, it } from 'vitest';
import { calculateRetryDelay } from '../../../src/domain/retry.policy.js';

describe('retry.policy.js', () => {
  it('uses exponential backoff capped at the configured maximum', () => {
    expect(calculateRetryDelay(1, 30000, 300000)).toBe(30000);
    expect(calculateRetryDelay(2, 30000, 300000)).toBe(60000);
    expect(calculateRetryDelay(8, 30000, 300000)).toBe(300000);
  });
});
