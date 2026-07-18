import { logger } from '../infrastructure/logger.js';
import {
  createTemplateService, deleteTemplateService, updateTemplateService
} from '../services/template.service.js';
import { sendError } from '../utils/response.js';

const execute = async (res, operation, successStatus) => {
  try {
    const body = await operation();
    if (successStatus === 204) return res.status(204).send();
    return res.status(successStatus).json(body);
  } catch (error) {
    logger.error({ '[TEMPLATE ERROR]': error.message });
    const { statusHttp, response } = sendError(error?.errorCode);
    return res.status(statusHttp).json(response);
  }
};

export const createTemplateController = (req, res) => execute(
  res, () => createTemplateService(req.body), 201
);
export const updateTemplateController = (req, res) => execute(
  res, () => updateTemplateService(req.params.id, req.body), 200
);
export const deleteTemplateController = (req, res) => execute(
  res, () => deleteTemplateService(req.params.id), 204
);
