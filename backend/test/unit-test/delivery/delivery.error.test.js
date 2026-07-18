import { describe, expect, it } from 'vitest';
import {
  DeliveryError,
  deliveryErrorDetail,
  toDeliveryError
} from '../../../src/delivery/delivery.error.js';

describe('delivery.error.js', () => {
  it.each([
    [{ code: 'ETIMEDOUT', message: 'timeout' }, true],
    [{ responseCode: 421, message: 'temporary' }, true],
    [{ responseCode: 550, message: 'rejected' }, false],
    [{ code: 'EAUTH', message: 'auth failed' }, false]
  ])('classifies provider errors', (error, retryable) => {
    expect(toDeliveryError(error)).toMatchObject({ retryable });
  });

  it('keeps an existing DeliveryError and formats a bounded detail', () => {
    const error = new DeliveryError('SMS_DISABLED', 'x'.repeat(3000), false);
    expect(toDeliveryError(error)).toBe(error);
    expect(deliveryErrorDetail(error)).toHaveLength(2000);
  });
});
