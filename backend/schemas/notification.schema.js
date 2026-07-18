import { z } from 'zod';

const primitiveVariable = z.union([z.string().max(10000), z.number().finite(), z.boolean()]);
const POSTGRES_BIGINT_MAX = 9223372036854775807n;

const bigintId = z.string().regex(/^[1-9]\d*$/).refine((value) => (
  !/^[1-9]\d*$/.test(value) || BigInt(value) <= POSTGRES_BIGINT_MAX
));

const notificationBodySchema = z.object({
  canal: z.enum(['EMAIL', 'SMS']),
  destinatario: z.string().trim().min(1).max(255),
  plantillaId: z.number().int().positive().safe(),
  variables: z.record(z.string().trim().min(1).max(100), primitiveVariable)
}).strict().superRefine(({ canal, destinatario }, context) => {
  const isValid = canal === 'EMAIL'
    ? z.string().email().safeParse(destinatario).success
    : /^\+[1-9]\d{7,14}$/.test(destinatario);
  if (!isValid) {
    context.addIssue({ code: 'custom', path: ['destinatario'], message: `Destinatario invalido para ${canal}` });
  }
});

export const createNotificationSchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(128),
  body: notificationBodySchema
}).strict();

export const getNotificationParamsSchema = z.object({ id: bigintId }).strict();
export const retryNotificationParamsSchema = getNotificationParamsSchema;

export const listNotificationsQuerySchema = z.object({
  canal: z.enum(['EMAIL', 'SMS']).optional(),
  estado: z.enum(['ENCOLADA', 'ENVIADA', 'FALLIDA']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().trim().min(1).max(512).optional()
}).strict();
