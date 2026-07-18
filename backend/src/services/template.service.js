import {
  findTemplateById, insertTemplate, softDeleteTemplate, updateTemplate
} from '../repositories/template.repository.js';
import { errorCodes, setError } from '../utils/errorCodes.js';
import { validateTemplatePlaceholders } from './template.renderer.js';

export const createTemplateService = async (template) => {
  validateTemplatePlaceholders(template);
  const created = await insertTemplate(template);
  if (!created) throw setError('Template already exists for channel', errorCodes.RESOURCE_CONFLICT);
  return created;
};

export const updateTemplateService = async (id, template) => {
  validateTemplatePlaceholders(template);
  if (!await findTemplateById(id)) throw setError('Template not found', errorCodes.NOT_FOUND);
  const updated = await updateTemplate(id, template);
  if (!updated) throw setError('Template already exists for channel', errorCodes.RESOURCE_CONFLICT);
  return updated;
};

export const deleteTemplateService = async (id) => {
  const deleted = await softDeleteTemplate(id);
  if (!deleted) throw setError('Template not found', errorCodes.NOT_FOUND);
};
