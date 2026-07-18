import { DeliveryError } from './delivery.error.js';

export const fakeConnector = {
  async verify() { return true; },
  async send(notification) {
    if (notification.destinatario.includes('temporary-failure')) {
      throw new DeliveryError('Simulated temporary failure', { retryable: true, code: 'FAKE_TEMPORARY' });
    }
    if (notification.destinatario.includes('permanent-failure')) {
      throw new DeliveryError('Simulated permanent failure', { retryable: false, code: 'FAKE_PERMANENT' });
    }
    return { messageId: `fake-${notification.id}-g${notification.generacion}`, response: 'accepted' };
  },
  async close() {}
};
