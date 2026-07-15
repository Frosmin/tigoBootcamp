import { logger } from '@tigo/logger';
import { errorCodes, setError } from '../utils/errorCodes.js';
import { insertExample, selectExampleById } from '../repositories/example.repository.js';
import { publish } from '@tigo/kafka-connector';
/**
 * Logica de negocio del recurso `example`.
 */

const topic = process.env.KAFKA_TOPIC || 'example-topic';

export const createExampleService = async (body) => {
  logger.info({ 'createExampleService': { '[NAME]': body?.name } });
  await publish(topic, JSON.stringify(body));
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
