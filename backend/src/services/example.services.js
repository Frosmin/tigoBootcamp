import { logger } from '@tigo/logger';
import { errorCodes, setError } from '../utils/errorCodes.js';
import { insertExample, selectExampleById } from '../repositories/example.repository.js';
/**
 * Logica de negocio del recurso `example`.
 */

export const createExampleService = async (body) => {
  logger.info({ 'createExampleService': { '[NAME]': body?.name } });
  return insertExample(body);
};

export const getExampleService = async ({ id }) => {
  logger.info({ 'getExampleService': { '[ID]': id } });
  const example = await selectExampleById(id);
  if (!example) {
    throw setError(`example ${id} not found`, errorCodes.NOT_FOUND);
  }
  return example;
};
