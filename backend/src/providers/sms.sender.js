import config from '../utils/config.js';
import { PermanentDeliveryError } from './delivery.errors.js';

const isRetryableStatus = (status) => status === 408 || status === 429 || status >= 500;

export const createSmsSender = ({
  providerUrl = config.SMS_PROVIDER_URL,
  providerToken = config.SMS_PROVIDER_TOKEN,
  timeoutMs = config.PROVIDER_TIMEOUT_MS,
  fetchImplementation = globalThis.fetch
} = {}) => async ({ notificationId, to, message }) => {
  if (!providerUrl || !providerToken) {
    throw new PermanentDeliveryError('SMS provider configuration is incomplete');
  }

  const response = await fetchImplementation(providerUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${providerToken}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `notification-${notificationId}`
    },
    body: JSON.stringify({
      messageId: `notification-${notificationId}`,
      to,
      message
    }),
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!response.ok) {
    const detail = await response.text();
    const errorMessage = `SMS provider returned ${response.status}: ${detail}`;
    if (isRetryableStatus(response.status)) throw new Error(errorMessage);
    throw new PermanentDeliveryError(errorMessage);
  }

  if (response.status === 204) return { messageId: `notification-${notificationId}` };
  return response.json();
};
