import { describe, expect, it } from 'vitest';

import {
  DeliveryError, normalizeDeliveryError
} from '../../../src/connectors/delivery.error.js';

describe('delivery.error.js', () => {
  it('keeps an already classified delivery error', () => {
    const error = new DeliveryError('retry later', { retryable: true, code: 'TEMP' });
    expect(normalizeDeliveryError(error)).toBe(error);
    expect(error).toMatchObject({ name: 'DeliveryError', retryable: true, code: 'TEMP' });
  });

  it.each([
    [{ code: 'ETIMEDOUT', message: 'timeout' }, 'ETIMEDOUT'],
    [{ responseCode: 421, message: 'busy' }, 'SMTP_421'],
    [{ responseCode: 450 }, 'SMTP_450'],
    [{ responseCode: 451 }, 'SMTP_451'],
    [{ responseCode: 452 }, 'SMTP_452']
  ])('classifies temporary provider failure %# as retryable', (raw, code) => {
    expect(normalizeDeliveryError(raw)).toMatchObject({ retryable: true, code });
  });

  it('classifies permanent SMTP and unknown failures as non-retryable', () => {
    expect(normalizeDeliveryError({ responseCode: 550, message: 'rejected' }))
      .toMatchObject({ retryable: false, code: 'SMTP_550' });
    expect(normalizeDeliveryError({})).toMatchObject({
      retryable: false, code: 'DELIVERY_ERROR', message: 'Delivery failed'
    });
  });
});
