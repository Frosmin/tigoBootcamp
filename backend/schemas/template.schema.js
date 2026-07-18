import { z } from 'zod';

const variableSchema = z.string().trim().min(1).max(100)
  .regex(/^[A-Za-z_][A-Za-z0-9_]*$/);

export const templateBodySchema = z.object({
  nombre: z.string().trim().min(1).max(100),
  canal: z.enum(['EMAIL', 'SMS']),
  contenido: z.string().min(1).max(20000).refine((value) => value.trim().length > 0),
  variables: z.array(variableSchema).max(100).superRefine((variables, context) => {
    if (new Set(variables).size !== variables.length) {
      context.addIssue({ code: 'custom', message: 'Las variables no pueden repetirse' });
    }
  })
}).strict();

export const createTemplateSchema = templateBodySchema;
export const updateTemplateSchema = templateBodySchema;
