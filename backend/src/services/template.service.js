import { logger } from '@tigo/logger';
import { insertTemplate } from '../repositories/template.repository.js';
import { errorCodes, setError } from '../utils/errorCodes.js';

export const createTemplateService = async (template) => {
  logger.info({
    createTemplateService: {
      '[NOMBRE]': template.nombre,
      '[CANAL]': template.canal
    }
  });

  const createdTemplate = await insertTemplate(template);
  if (!createdTemplate) {
    throw setError(
      `Template ${template.nombre} already exists for channel ${template.canal}`,
      errorCodes.RESOURCE_CONFLICT
    );
  }

  return createdTemplate;
};
