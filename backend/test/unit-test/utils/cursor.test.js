import { describe, expect, it } from 'vitest';

import { decodeCursor, encodeCursor } from '../../../src/utils/cursor.js';

describe('cursor.js', () => {
  it('round trips a stable keyset cursor', () => {
    const cursor = encodeCursor({ createdAt: '2026-07-18T12:00:00Z', id: 42 });
    expect(decodeCursor(cursor)).toEqual({
      createdAt: '2026-07-18T12:00:00.000Z', id: '42'
    });
  });

  it('returns undefined when no cursor is supplied', () => {
    expect(decodeCursor()).toBeUndefined();
  });

  it.each([
    'not-json',
    Buffer.from(JSON.stringify({ createdAt: 'bad', id: '1' })).toString('base64url'),
    Buffer.from(JSON.stringify({ createdAt: '2026-01-01', id: 'abc' })).toString('base64url'),
    Buffer.from(JSON.stringify({ id: '1' })).toString('base64url')
  ])('rejects malformed cursor %s', (cursor) => {
    expect(() => decodeCursor(cursor)).toThrow(/Invalid pagination cursor/);
  });
});
