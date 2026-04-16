export interface FetchHtmlOptions {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  headers?: Record<string, string>;
  encoding?: string;
}

export interface FetchHtmlResult {
  html: string;
  finalUrl: string;
  status: number;
  headers: Record<string, string>;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 350;

const DEFAULT_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function headersToRecord(headers: Headers): Record<string, string> {
  return Object.fromEntries(headers.entries());
}

function buildStatusErrorMessage(url: string, status: number, statusText: string) {
  return `Failed to load ${url} (status ${status}${statusText ? ` ${statusText}` : ""})`;
}

function buildNetworkErrorMessage(url: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return `Failed to load ${url} (network error: ${message})`;
}

export async function fetchHtml(
  url: string,
  options: FetchHtmlOptions = {},
): Promise<FetchHtmlResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = options.retries ?? DEFAULT_RETRIES;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const encoding = options.encoding ?? "utf-8";
  const headers = {
    ...DEFAULT_HEADERS,
    ...options.headers,
  };

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers,
      });

      const responseHeaders = headersToRecord(response.headers);

      if (!response.ok) {
        const error = new Error(buildStatusErrorMessage(url, response.status, response.statusText));
        console.warn("[import.fetchHtml] non-ok response", {
          url,
          attempt,
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
        });

        if (attempt < retries && response.status >= 500) {
          lastError = error;
          await sleep(retryDelayMs);
          continue;
        }

        throw Object.assign(error, {
          status: response.status,
          statusText: response.statusText,
          responseHeaders,
        });
      }

      const buffer = await response.arrayBuffer();
      const html = new TextDecoder(encoding).decode(buffer);

      return {
        html,
        finalUrl: response.url || url,
        status: response.status,
        headers: responseHeaders,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error : new Error(buildNetworkErrorMessage(url, error));

      console.warn("[import.fetchHtml] request failed", {
        url,
        attempt,
        message: message.message,
        headers,
      });

      lastError =
        error instanceof Error
          ? error
          : new Error(buildNetworkErrorMessage(url, error));

      if (attempt < retries) {
        await sleep(retryDelayMs);
        continue;
      }
    } finally {
      clearTimeout(timer);
    }
  }

  const fallbackMessage = lastError?.message ?? `Failed to load ${url} (unknown error)`;
  throw new Error(fallbackMessage);
}
