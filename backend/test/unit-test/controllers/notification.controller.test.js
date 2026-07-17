import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/services/notification.service.js', () => ({
  createNotificationService: vi.fn()
}));

import { createNotificationService } from '../../../src/services/notification.service.js';
import { createNotificationController } from '../../../src/controllers/notification.controller.js';
import { errorCodes, setError } from '../../../src/utils/errorCodes.js';

describe('notification.controller.js', () => {
  const req = {
    body: {
      canal: 'EMAIL',
      destinatario: 'user@example.com',
      plantillaId: 2,
      variables: { nombre: 'Ana' }
    },
    idempotencyKey: 'request-1'
  };
  const notification = { id: 9, ...req.body, estado: 'ENCOLADA', intentos: 0 };
  let res;

  beforeEach(() => {
    vi.clearAllMocks();
    res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  });

  it('returns 202 for a newly enqueued notification', async () => {
    createNotificationService.mockResolvedValue({ notification, created: true });
    await createNotificationController(req, res);
    expect(createNotificationService).toHaveBeenCalledWith(req.body, 'request-1');
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith(notification);
  });

  it('returns 200 for an idempotent duplicate', async () => {
    createNotificationService.mockResolvedValue({ notification, created: false });
    await createNotificationController(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it.each([
    [errorCodes.MISSING_REQUIRED_PARAMETER, 400],
    [errorCodes.NOT_FOUND, 404],
    [errorCodes.RESOURCE_CONFLICT, 409],
    [errorCodes.SERVICE_TEMPORARILY_UNAVAILABLE, 503]
  ])('maps %s to HTTP %i', async (errorCode, status) => {
    createNotificationService.mockRejectedValue(setError('expected', errorCode));
    await createNotificationController(req, res);
    expect(res.status).toHaveBeenCalledWith(status);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({ code: errorCode })
    }));
  });

  it('returns 500 for an unexpected failure', async () => {
    createNotificationService.mockRejectedValue(new Error('unexpected'));
    await createNotificationController(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
