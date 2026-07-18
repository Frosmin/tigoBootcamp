import { errorCodes, setError } from './errorCodes.js';

export const encodeCursor = ({ createdAt, id }) => Buffer.from(JSON.stringify({
  createdAt: new Date(createdAt).toISOString(),
  id: String(id)
})).toString('base64url');

export const decodeCursor = (cursor) => {
  if (!cursor) return undefined;
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (!value.createdAt || !/^\d+$/.test(String(value.id)) || Number.isNaN(Date.parse(value.createdAt))) {
      throw new Error('Invalid cursor');
    }
    return { createdAt: new Date(value.createdAt).toISOString(), id: String(value.id) };
  } catch {
    throw setError('Invalid pagination cursor', errorCodes.MISSING_REQUIRED_PARAMETER);
  }
};
