export class DeliveryError extends Error {
  constructor(code, message, retryable, cause) {
    super(message, { cause });
    this.name = 'DeliveryError';
    this.code = code;
    this.retryable = retryable;
  }
}

export const toDeliveryError = (error) => {
  if (error instanceof DeliveryError) return error;

  const responseCode = Number(error?.responseCode);
  const code = error?.code || 'SMTP_ERROR';
  const retryableCodes = new Set([
    'ECONNECTION',
    'ECONNRESET',
    'ECONNREFUSED',
    'ESOCKET',
    'ETIMEDOUT',
    'EDNS'
  ]);
  const retryable = (responseCode >= 400 && responseCode < 500)
    || retryableCodes.has(code);

  return new DeliveryError(code, error?.message || 'Delivery failed', retryable, error);
};

export const deliveryErrorDetail = (error) => {
  const normalized = toDeliveryError(error);
  return `${normalized.code}: ${normalized.message}`.slice(0, 2000);
};
