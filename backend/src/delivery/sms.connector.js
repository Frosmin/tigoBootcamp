import { DeliveryConnector } from './delivery.connector.js';
import { DeliveryError } from './delivery.error.js';

export class SmsConnector extends DeliveryConnector {
  async send() {
    throw new DeliveryError(
      'SMS_PROVIDER_NOT_CONFIGURED',
      'SMS provider is not configured',
      false
    );
  }
}
