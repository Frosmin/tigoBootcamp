import { z } from 'zod';

/**
 * Esquemas de validacion del recurso `example`.
 * Reflejan la tabla:
 *   name              VARCHAR(100) NOT NULL
 *   description       VARCHAR(500)          (opcional)
 *   quantity          INTEGER NOT NULL DEFAULT 0  CHECK (quantity >= 0)
 *   price             NUMERIC(12,2) NOT NULL DEFAULT 0  CHECK (price >= 0)
 *   active            BOOLEAN NOT NULL DEFAULT TRUE
 *   registration_date DATE NOT NULL DEFAULT CURRENT_DATE
 * (id, created_at, updated_at los gestiona la base de datos)
 */

const headers = {
  xtraceid: z.string().min(1).max(350).optional(),
  xclientid: z.string().min(1).max(350)
};

// POST /examples
export const createExampleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  quantity: z.number().int().min(0).optional(),
  price: z.number().min(0).optional(),
  active: z.boolean().optional(),
  registration_date: z.string().date().optional(),
  ...headers
}).strict();

// GET /examples/:id  (id llega como string -> entero positivo)
export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  ...headers
}).strict();
