import { z } from 'zod';

const primitiveVariable = z.union([z.string(), z.number().finite(), z.boolean()]);

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
    context.addIssue({
      code: 'custom',
      path: ['destinatario'],
      message: `Destinatario invalido para el canal ${canal}`
    });
  }
});

export const createNotificationSchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(128),
  body: notificationBodySchema
}).strict();
