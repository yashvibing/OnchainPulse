import {
  getErrorMessage,
  logServerEvent,
  logSlowSource,
  sourceNameFromUrl,
} from "@/lib/serverLog";

interface FetchJsonOptions extends RequestInit {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  sourceName?: string;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchJsonWithRetry<T>(
  url: string,
  options: FetchJsonOptions = {}
): Promise<T> {
  const {
    timeoutMs = 8_000,
    retries = 2,
    retryDelayMs = 300,
    sourceName,
    ...fetchOptions
  } = options;
  let lastError: unknown;
  const source = sourceName || sourceNameFromUrl(url);

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = Date.now();

    try {
      const res = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });
      const durationMs = Date.now() - startedAt;
      logSlowSource(source, durationMs);
      if (!res.ok) {
        logServerEvent("warn", "source.http_error", {
          source,
          status: res.status,
          attempt,
          durationMs,
        });
        throw new Error(`HTTP ${res.status} for ${url}`);
      }
      return (await res.json()) as T;
    } catch (error) {
      lastError = error;
      logServerEvent(attempt === retries ? "error" : "warn", "source.fetch_failed", {
        source,
        attempt,
        retries,
        error: getErrorMessage(error),
      });
      if (attempt === retries) break;
      await sleep(retryDelayMs * (attempt + 1));
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Failed to fetch ${url}`);
}
