import { describe, expect, it, vi } from 'vitest';

describe('connector.factory.js', () => {
  it('selects SMTP email and disabled SMS connectors by channel', async () => {
    vi.resetModules();
    vi.doMock('../../../src/utils/config.js', () => ({ default: { DELIVERY_PROVIDER: 'smtp' } }));
    const { createDeliveryConnector } = await import('../../../src/connectors/connector.factory.js');
    const { emailConnector } = await import('../../../src/connectors/email.connector.js');
    const { smsConnector } = await import('../../../src/connectors/sms.connector.js');
    expect(createDeliveryConnector('EMAIL')).toBe(emailConnector);
    expect(createDeliveryConnector('SMS')).toBe(smsConnector);
  });

  it('selects the fake connector for load and integration tests', async () => {
    vi.resetModules();
    vi.doMock('../../../src/utils/config.js', () => ({ default: { DELIVERY_PROVIDER: 'fake' } }));
    const { createDeliveryConnector } = await import('../../../src/connectors/connector.factory.js');
    const { fakeConnector } = await import('../../../src/connectors/fake.connector.js');
    expect(createDeliveryConnector('EMAIL')).toBe(fakeConnector);
    expect(createDeliveryConnector('SMS')).toBe(fakeConnector);
  });
});
