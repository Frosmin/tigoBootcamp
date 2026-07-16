import { z } from 'zod';

const variableSchema = z.string()
  .trim()
  .min(1)
  .max(100);

export const createTemplateSchema = z.object({
  nombre: z.string().trim().min(1).max(100),
  canal: z.enum(['EMAIL', 'SMS']),
  contenido: z.string().refine((value) => value.trim().length > 0),
  variables: z.array(variableSchema).superRefine((variables, context) => {
    const uniqueVariables = new Set(variables);
    if (uniqueVariables.size !== variables.length) {
      context.addIssue({
        code: 'custom',
        message: 'Las variables no pueden repetirse'
      });
    }
  })
}).strict();
