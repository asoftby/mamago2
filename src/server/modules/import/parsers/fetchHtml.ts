import * as http from "node:http";
import * as https from "node:https";

export interface FetchHtmlOptions {
  timeoutMs?: number;
  /**
   * Legacy name: this value is the total number of attempts, not retries after
   * the first request. Keep the existing semantics to avoid silently changing
   * parser timing/cost characteristics.
   */
  retries?: number;
  retryDelayMs?: number;
  headers?: Record<string, string>;
  encoding?: string;
  /**
   * When native Node fetch/Undici fails before an HTTP response exists, retry
   * the same URL once through Node's built-in http/https transport (IPv4).
   * This keeps TLS verification enabled and is useful for legacy upstreams
   * that intermittently fail at the Undici transport layer.
   */
  nodeHttpFallback?: boolean;
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
const DEFAULT_NODE_HTTP_FALLBACK = true;
const MAX_REDIRECTS = 5;

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

const TRANSPORT_ERROR_CODES = new Set([
  "EAI_AGAIN",
  "ENOTFOUND",
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENETUNREACH",
  "EHOSTUNREACH",
  "EPIPE",
  "CERT_HAS_EXPIRED",
  "CERT_NOT_YET_VALID",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function headersToRecord(headers: Headers): Record<string, string> {
  return Object.fromEntries(headers.entries());
}

function nodeHeadersToRecord(headers: http.IncomingHttpHeaders): Record<string, string> {
  const record: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    record[key] = Array.isArray(value) ? value.join(", ") : String(value);
  }

  return record;
}

function buildStatusErrorMessage(url: string, status: number, statusText: string) {
  return `Failed to load ${url} (status ${status}${statusText ? ` ${statusText}` : ""})`;
}

function readErrorField(error: unknown, key: string): unknown {
  if (!error || typeof error !== "object") return undefined;
  return (error as Record<string, unknown>)[key];
}

/**
 * Node's native fetch normally throws only `TypeError: fetch failed` for
 * transport failures. The actionable diagnostic (DNS, TCP, TLS, timeout) is
 * stored in `error.cause`; preserve it for admin diagnostics and server logs.
 */
export function describeFetchError(error: unknown): string {
  const parts: string[] = [];
  const seenObjects = new Set<object>();
  let current: unknown = error;

  for (let depth = 0; depth < 4 && current; depth++) {
    if (typeof current === "object") {
      if (seenObjects.has(current as object)) break;
      seenObjects.add(current as object);
    }

    if (current instanceof Error && current.message && !parts.includes(current.message)) {
      parts.push(current.message);
    } else if (!(current instanceof Error) && typeof current !== "object") {
      const text = String(current);
      if (text && !parts.includes(text)) parts.push(text);
    }

    for (const key of ["code", "errno", "syscall", "hostname", "address", "port"] as const) {
      const value = readErrorField(current, key);
      if (value === undefined || value === null || value === "") continue;
      const detail = `${key}=${String(value)}`;
      if (!parts.includes(detail)) parts.push(detail);
    }

    const cause = readErrorField(current, "cause");
    if (!cause || cause === current) break;
    current = cause;
  }

  return parts.length > 0 ? parts.join("; ") : String(error);
}

function buildNetworkErrorMessage(url: string, error: unknown) {
  return `Failed to load ${url} (network error: ${describeFetchError(error)})`;
}

function transportErrorCode(error: unknown): string | null {
  let current: unknown = error;
  const seenObjects = new Set<object>();

  for (let depth = 0; depth < 4 && current; depth++) {
    if (typeof current === "object") {
      if (seenObjects.has(current as object)) break;
      seenObjects.add(current as object);
    }

    const code = readErrorField(current, "code");
    if (typeof code === "string" && code) return code;

    const cause = readErrorField(current, "cause");
    if (!cause || cause === current) break;
    current = cause;
  }

  return null;
}

function shouldUseNodeHttpFallback(error: unknown): boolean {
  if (error instanceof Error && error.name === "AbortError") return false;

  const code = transportErrorCode(error);
  if (code && TRANSPORT_ERROR_CODES.has(code)) return true;

  return error instanceof TypeError && /fetch failed/i.test(error.message);
}

function createNodeTransportError(
  nativeError: unknown,
  fallbackError: unknown,
): Error {
  const error = new Error(
    `native fetch failed: ${describeFetchError(nativeError)}; ` +
      `node http fallback failed: ${describeFetchError(fallbackError)}`,
  );

  Object.assign(error, {
    cause: fallbackError,
    nativeError,
    fallbackError,
  });

  return error;
}

async function fetchHtmlViaNodeHttp(
  url: string,
  options: {
    timeoutMs: number;
    headers: Record<string, string>;
    encoding: string;
  },
  redirectCount = 0,
): Promise<FetchHtmlResult> {
  const parsedUrl = new URL(url);

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error(`Unsupported URL protocol for import fetch: ${parsedUrl.protocol}`);
  }

  if (redirectCount > MAX_REDIRECTS) {
    throw new Error(`Too many redirects while loading ${url}`);
  }

  const transport = parsedUrl.protocol === "https:" ? https : http;

  return new Promise<FetchHtmlResult>((resolve, reject) => {
    const request = transport.request(
      parsedUrl,
      {
        method: "GET",
        headers: {
          ...options.headers,
          // Node's low-level transport does not transparently decompress like
          // native fetch. Ask the upstream for the raw HTML body.
          "Accept-Encoding": "identity",
        },
        // The fallback intentionally uses IPv4. It is only reached after
        // native fetch has already failed, and avoids broken IPv6 routes on
        // legacy upstream infrastructure without weakening TLS verification.
        family: 4,
      },
      (response) => {
        const status = response.statusCode ?? 0;
        const statusText = response.statusMessage ?? "";
        const responseHeaders = nodeHeadersToRecord(response.headers);
        const location = response.headers.location;

        if (status >= 300 && status < 400 && location) {
          response.resume();

          let redirectedUrl: string;
          try {
            redirectedUrl = new URL(location, parsedUrl).toString();
          } catch (error) {
            reject(error);
            return;
          }

          void fetchHtmlViaNodeHttp(redirectedUrl, options, redirectCount + 1).then(
            resolve,
            reject,
          );
          return;
        }

        if (status < 200 || status >= 300) {
          response.resume();
          reject(
            Object.assign(new Error(buildStatusErrorMessage(url, status, statusText)), {
              status,
              statusText,
              responseHeaders,
            }),
          );
          return;
        }

        const chunks: Buffer[] = [];

        response.on("data", (chunk: Buffer | string) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });

        response.on("error", reject);

        response.on("end", () => {
          try {
            const buffer = Buffer.concat(chunks);
            const html = new TextDecoder(options.encoding).decode(buffer);
            resolve({
              html,
              finalUrl: parsedUrl.toString(),
              status,
              headers: responseHeaders,
            });
          } catch (error) {
            reject(error);
          }
        });
      },
    );

    request.setTimeout(options.timeoutMs, () => {
      request.destroy(
        Object.assign(new Error(`request timed out after ${options.timeoutMs}ms`), {
          code: "ETIMEDOUT",
        }),
      );
    });

    request.on("error", reject);
    request.end();
  });
}

export async function fetchHtml(
  url: string,
  options: FetchHtmlOptions = {},
): Promise<FetchHtmlResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const attempts = Math.max(1, options.retries ?? DEFAULT_RETRIES);
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const encoding = options.encoding ?? "utf-8";
  const nodeHttpFallback = options.nodeHttpFallback ?? DEFAULT_NODE_HTTP_FALLBACK;
  const headers = {
    ...DEFAULT_HEADERS,
    ...options.headers,
  };

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      let response: Response;

      try {
        response = await fetch(url, {
          signal: controller.signal,
          headers,
        });
      } catch (nativeError) {
        if (!nodeHttpFallback || !shouldUseNodeHttpFallback(nativeError)) {
          throw nativeError;
        }

        console.warn("[import.fetchHtml] native fetch transport failed; trying node http fallback", {
          url,
          attempt,
          error: describeFetchError(nativeError),
        });

        try {
          return await fetchHtmlViaNodeHttp(url, {
            timeoutMs,
            headers,
            encoding,
          });
        } catch (fallbackError) {
          throw createNodeTransportError(nativeError, fallbackError);
        }
      }

      const responseHeaders = headersToRecord(response.headers);

      if (!response.ok) {
        const error = Object.assign(
          new Error(buildStatusErrorMessage(url, response.status, response.statusText)),
          {
            status: response.status,
            statusText: response.statusText,
            responseHeaders,
          },
        );

        console.warn("[import.fetchHtml] non-ok response", {
          url,
          attempt,
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
        });

        throw error;
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
      const status = readErrorField(error, "status");
      const isHttpStatusError = typeof status === "number";
      const normalizedError =
        error instanceof Error
          ? error
          : new Error(buildNetworkErrorMessage(url, error));

      console.warn("[import.fetchHtml] request failed", {
        url,
        attempt,
        error: describeFetchError(error),
        status: isHttpStatusError ? status : undefined,
      });

      lastError = isHttpStatusError
        ? normalizedError
        : Object.assign(new Error(buildNetworkErrorMessage(url, error)), {
            cause: error,
          });

      if (attempt < attempts) {
        await sleep(retryDelayMs);
        continue;
      }
    } finally {
      clearTimeout(timer);
    }
  }

  const fallbackMessage = lastError?.message ?? `Failed to load ${url} (unknown error)`;
  throw Object.assign(new Error(fallbackMessage), {
    cause: lastError ?? undefined,
  });
}
