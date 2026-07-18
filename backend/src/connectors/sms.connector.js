import { DeliveryError } from './delivery.error.js';

export const smsConnector = {
  async verify() { throw new DeliveryError('SMS provider is not configured', { code: 'SMS_NOT_CONFIGURED' }); },
  async send() { throw new DeliveryError('SMS provider is not configured', { code: 'SMS_NOT_CONFIGURED' }); },
  async close() {}
};
