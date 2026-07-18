export class DeliveryError extends Error {
  constructor(message, { retryable = false, code = 'DELIVERY_ERROR' } = {}) {
    super(message);
    this.name = 'DeliveryError';
    this.retryable = retryable;
    this.code = code;
  }
}

export const normalizeDeliveryError = (error) => {
  if (error instanceof DeliveryError) return error;
  const smtpCode = Number(error?.responseCode);
  const networkCodes = new Set(['ECONNECTION', 'ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN', 'ESOCKET']);
  const retryable = networkCodes.has(error?.code) || [421, 450, 451, 452].includes(smtpCode);
  return new DeliveryError(error?.message || 'Delivery failed', {
    retryable,
    code: error?.code || (smtpCode ? `SMTP_${smtpCode}` : 'DELIVERY_ERROR')
  });
};
