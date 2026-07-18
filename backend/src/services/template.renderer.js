import { errorCodes, setError } from '../utils/errorCodes.js';

const PLACEHOLDER = /{{\s*([A-Za-z_][A-Za-z0-9_]*)\s*}}/g;

export const extractPlaceholders = (content) => {
  const placeholders = [];
  for (const match of content.matchAll(PLACEHOLDER)) placeholders.push(match[1]);
  return [...new Set(placeholders)].sort((a, b) => a.localeCompare(b));
};

export const validateTemplatePlaceholders = ({ contenido, variables }) => {
  const declared = [...variables].sort((a, b) => a.localeCompare(b));
  const found = extractPlaceholders(contenido);
  if (declared.length !== found.length || declared.some((value, index) => value !== found[index])) {
    throw setError('Template variables must match its placeholders', errorCodes.MISSING_REQUIRED_PARAMETER);
  }
};

export const renderTemplate = (content, variables) => content.replace(
  PLACEHOLDER,
  (_, variable) => String(variables[variable])
);
