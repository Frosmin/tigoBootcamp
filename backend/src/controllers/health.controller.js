import { checkPostgres } from '../infrastructure/postgres.transaction.js';

export const healthController = (_req, res) => res.status(200).json({ status: 'UP' });

export async function readinessController(_req, res) {
  try {
    await checkPostgres();
    return res.status(200).json({ status: 'READY', postgres: 'UP' });
  } catch {
    return res.status(503).json({ status: 'NOT_READY', postgres: 'DOWN' });
  }
}
