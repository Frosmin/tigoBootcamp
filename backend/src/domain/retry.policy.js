export const calculateRetryDelay = (attemptNumber, baseDelayMs, maxDelayMs) => {
  return Math.min(baseDelayMs * (2 ** Math.max(0, attemptNumber - 1)), maxDelayMs);
};
