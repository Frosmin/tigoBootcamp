import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/services/notification.service.js', () => ({
  createNotificationService: vi.fn(),
  getNotificationService: vi.fn()
}));

import {
  createNotificationService,
  getNotificationService
} from '../../../src/services/notification.service.js';
import {
  createNotificationController,
  getNotificationController
} from '../../../src/controllers/notification.controller.js';
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

  it('returns 200 with the notification state and attempt history', async () => {
    const response = { ...notification, historialIntentos: [] };
    getNotificationService.mockResolvedValue(response);

    await getNotificationController({ params: { id: '9' } }, res);

    expect(getNotificationService).toHaveBeenCalledWith('9');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(response);
  });

  it('returns 404 when the notification does not exist', async () => {
    getNotificationService.mockRejectedValue(
      setError('Notification not found', errorCodes.NOT_FOUND)
    );

    await getNotificationController({ params: { id: '999' } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'NF001', message: 'Not found' }
    });
  });

  it('returns 500 when getting a notification fails unexpectedly', async () => {
    getNotificationService.mockRejectedValue(new Error('database unavailable'));

    await getNotificationController({ params: { id: '9' } }, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
