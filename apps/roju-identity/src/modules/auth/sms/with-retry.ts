import { Logger } from '@nestjs/common';

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 500;
export const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Shared attempt/backoff loop for outbound SMS provider calls (MSG91, Twilio, ...) — each
// provider only supplies the actual network call; this owns the retry/timeout/logging
// mechanics so they don't drift between providers. Throws the last error once every attempt
// is exhausted — the caller (SmsModule's provider chain) decides what happens next, this
// utility doesn't know about fallback providers or console logging.
export async function withRetry(
  logger: Logger,
  providerName: string,
  target: string,
  attempt: (signal: AbortSignal) => Promise<void>,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS,
): Promise<void> {
  let lastError = 'unknown error';

  for (let i = 1; i <= maxAttempts; i++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_REQUEST_TIMEOUT_MS);

    try {
      await attempt(controller.signal);
      logger.log(`${providerName} accepted OTP for ${target} (attempt ${i}/${maxAttempts})`);
      return;
    } catch (err) {
      lastError =
        (err as Error).name === 'AbortError'
          ? `timed out after ${DEFAULT_REQUEST_TIMEOUT_MS}ms`
          : (err as Error).message;
      logger.warn(`${providerName} attempt ${i}/${maxAttempts} failed for ${target}: ${lastError}`);
      if (i < maxAttempts) {
        await sleep(retryDelayMs * i);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(`${providerName} unreachable after ${maxAttempts} attempts (${lastError})`);
}
