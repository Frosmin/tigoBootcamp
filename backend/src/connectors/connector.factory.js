import config from '../utils/config.js';
import { emailConnector } from './email.connector.js';
import { fakeConnector } from './fake.connector.js';
import { smsConnector } from './sms.connector.js';

export const createDeliveryConnector = (channel) => {
  if (config.DELIVERY_PROVIDER === 'fake') return fakeConnector;
  return channel === 'EMAIL' ? emailConnector : smsConnector;
};
