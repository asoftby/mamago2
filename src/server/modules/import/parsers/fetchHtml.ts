import * as http from "node:http";
import * as https from "node:https";

import { resolveSourceSpecificTlsCa } from "./familyByTls";

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

export function shouldUseNodeHttpFallback(error: unknown): boolean {
  if (error instanceof Error && error.name === "AbortError") return false;

  const code = transportErrorCode(error);
  if (code && TRANSPORT_ERROR_CODES.has(code)) return true;

  return error instanceof TypeError && /fetch failed/i.test(error.message);
}

function createNodeTransportError(
  nativeError: unknown,
  fallbackError: unknown,
  httpStatus?: number,
): Error {
  const error = new Error(
    `native fetch failed: ${describeFetchError(nativeError)}; ` +
      `node http fallback failed: ${describeFetchError(fallbackError)}`,
  );

  Object.assign(error, {
    cause: fallbackError,
    nativeError,
    fallbackError,
    ...(httpStatus !== undefined ? { httpStatus } : {}),
  });

  return error;
}

function hasHttpStatus(error: unknown): error is Error & { httpStatus: number } {
  return (
    error instanceof Error &&
    typeof (error as { httpStatus?: unknown }).httpStatus === "number"
  );
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
  const sourceSpecificTlsCa = resolveSourceSpecificTlsCa(parsedUrl);

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
        // Source-specific CA bundles only extend the normal trusted roots for
        // known upstreams with incomplete chains. Verification is never
        // disabled, and unrelated hosts keep Node's default TLS behavior.
        ca: sourceSpecificTlsCa,
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

// ---------------------------------------------------------------------------
// Binary transport (image/asset downloads)
//
// Shares the same source-specific TLS CA resolution (`resolveSourceSpecificTlsCa`)
// and native-fetch → Node http/https fallback heuristic as `fetchHtml` above,
// so upstreams with an incomplete chain (currently family.by) only need to be
// fixed in one place. Unlike `fetchHtml`, redirects are followed manually so
// every hop can be validated by the caller (SSRF protection for
// user-supplied URLs) and the response body is capped in-flight instead of
// being buffered fully before a size check.
// ---------------------------------------------------------------------------

export interface FetchBinaryOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
  maxBytes?: number;
  maxRedirects?: number;
  /**
   * Called with every URL that will actually be requested — the initial URL
   * and each redirect hop — before the request is made. Throw to reject an
   * unsafe target. Required for any endpoint that accepts a user-supplied URL.
   */
  validateUrl?: (url: URL) => void;
  nodeHttpFallback?: boolean;
}

export interface FetchBinaryResult {
  buffer: Buffer;
  finalUrl: string;
  status: number;
  headers: Record<string, string>;
}

const DEFAULT_BINARY_TIMEOUT_MS = 25_000;
// User-facing (route handlers surface these directly): keep them in Russian,
// matching the rest of the /api/media/from-url error copy, and free of any
// upstream/internal detail.
const SIZE_LIMIT_MESSAGE = "Файл слишком большой";
const TOO_MANY_REDIRECTS_MESSAGE = "Слишком много перенаправлений";

function sizeLimitError(): Error {
  return Object.assign(new Error(SIZE_LIMIT_MESSAGE), { httpStatus: 400 });
}

function tooManyRedirectsError(): Error {
  return Object.assign(new Error(TOO_MANY_REDIRECTS_MESSAGE), { httpStatus: 400 });
}

function exceedsDeclaredLength(headerValue: string | undefined | null, maxBytes: number): boolean {
  if (!headerValue) return false;
  const declared = Number.parseInt(headerValue, 10);
  return Number.isFinite(declared) && declared > maxBytes;
}

async function readBodyWithLimit(response: Response, maxBytes: number): Promise<Buffer> {
  const reader = response.body?.getReader();

  if (!reader) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > maxBytes) throw sizeLimitError();
    return buffer;
  }

  const chunks: Buffer[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw sizeLimitError();
    }

    chunks.push(Buffer.from(value));
  }

  return Buffer.concat(chunks);
}

async function fetchBinaryViaNativeFetch(
  initialUrl: string,
  options: {
    signal: AbortSignal;
    headers: Record<string, string>;
    maxRedirects: number;
    maxBytes: number;
    validateUrl: (url: URL) => void;
  },
): Promise<FetchBinaryResult> {
  let currentUrl = new URL(initialUrl);
  options.validateUrl(currentUrl);

  for (let redirectCount = 0; ; redirectCount++) {
    const response = await fetch(currentUrl, {
      signal: options.signal,
      redirect: "manual",
      headers: options.headers,
    });

    const location = response.headers.get("location");
    const isRedirect = response.status >= 300 && response.status < 400 && !!location;

    if (isRedirect) {
      await response.body?.cancel().catch(() => {});

      if (redirectCount >= options.maxRedirects) {
        throw tooManyRedirectsError();
      }

      currentUrl = new URL(location!, currentUrl);
      options.validateUrl(currentUrl);
      continue;
    }

    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      throw Object.assign(
        new Error(buildStatusErrorMessage(currentUrl.toString(), response.status, response.statusText)),
        { status: response.status, statusText: response.statusText, httpStatus: 502 },
      );
    }

    if (exceedsDeclaredLength(response.headers.get("content-length"), options.maxBytes)) {
      await response.body?.cancel().catch(() => {});
      throw sizeLimitError();
    }

    const buffer = await readBodyWithLimit(response, options.maxBytes);

    return {
      buffer,
      finalUrl: currentUrl.toString(),
      status: response.status,
      headers: headersToRecord(response.headers),
    };
  }
}

async function fetchBinaryViaNodeHttp(
  url: string,
  options: {
    timeoutMs: number;
    headers: Record<string, string>;
    maxRedirects: number;
    maxBytes: number;
    validateUrl: (url: URL) => void;
  },
  redirectCount = 0,
): Promise<FetchBinaryResult> {
  const parsedUrl = new URL(url);
  options.validateUrl(parsedUrl);

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    // Defense-in-depth: for /api/media/from-url this is already rejected by
    // `validateUrl` (assertSafeRemoteImageUrl) above with a user-safe
    // message. This branch only guards direct/programmatic callers.
    throw Object.assign(new Error("Разрешены только http и https"), { httpStatus: 400 });
  }

  if (redirectCount > options.maxRedirects) {
    throw tooManyRedirectsError();
  }

  const transport = parsedUrl.protocol === "https:" ? https : http;
  // Source-specific CA bundles only extend the normal trusted roots for known
  // upstreams with incomplete chains (see familyByTls.ts). Verification is
  // never disabled, and unrelated hosts keep Node's default TLS behavior.
  const sourceSpecificTlsCa = resolveSourceSpecificTlsCa(parsedUrl);

  return new Promise<FetchBinaryResult>((resolve, reject) => {
    const request = transport.request(
      parsedUrl,
      {
        method: "GET",
        headers: options.headers,
        ca: sourceSpecificTlsCa,
        // Only reached after native fetch has already failed; IPv4 avoids
        // broken IPv6 routes on legacy upstream infrastructure without
        // weakening TLS verification.
        family: 4,
      },
      (response) => {
        const status = response.statusCode ?? 0;
        const statusText = response.statusMessage ?? "";
        const responseHeaders = nodeHeadersToRecord(response.headers);
        const location = response.headers.location;

        if (status >= 300 && status < 400 && location) {
          response.resume();

          let redirectedUrl: URL;
          try {
            redirectedUrl = new URL(location, parsedUrl);
            options.validateUrl(redirectedUrl);
          } catch (error) {
            reject(error);
            return;
          }

          void fetchBinaryViaNodeHttp(redirectedUrl.toString(), options, redirectCount + 1).then(
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
              httpStatus: 502,
            }),
          );
          return;
        }

        const declaredLength = response.headers["content-length"];
        const declaredLengthValue = Array.isArray(declaredLength) ? declaredLength[0] : declaredLength;
        if (exceedsDeclaredLength(declaredLengthValue, options.maxBytes)) {
          response.destroy();
          reject(sizeLimitError());
          return;
        }

        const chunks: Buffer[] = [];
        let total = 0;
        let settled = false;

        response.on("data", (chunk: Buffer | string) => {
          if (settled) return;
          const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          total += buf.length;

          if (total > options.maxBytes) {
            settled = true;
            response.destroy();
            reject(sizeLimitError());
            return;
          }

          chunks.push(buf);
        });

        response.on("error", (error) => {
          if (settled) return;
          settled = true;
          reject(error);
        });

        response.on("end", () => {
          if (settled) return;
          settled = true;
          resolve({
            buffer: Buffer.concat(chunks),
            finalUrl: parsedUrl.toString(),
            status,
            headers: responseHeaders,
          });
        });
      },
    );

    request.setTimeout(options.timeoutMs, () => {
      request.destroy(
        Object.assign(new Error(`request timed out after ${options.timeoutMs}ms`), {
          code: "ETIMEDOUT",
          httpStatus: 504,
        }),
      );
    });

    request.on("error", reject);
    request.end();
  });
}

/**
 * Download an arbitrary binary resource (e.g. a remote image) with TLS
 * verification always enabled. Reuses the same source-specific CA workaround
 * and transport-fallback heuristic as `fetchHtml`; the only workaround for an
 * upstream's incomplete chain lives in `familyByTls.ts`.
 *
 * Redirects are followed manually (native fetch and the Node http fallback
 * both call `options.validateUrl` on every hop) so callers handling
 * user-supplied URLs can reject unsafe redirect targets (SSRF) before the
 * next request is made.
 */
export async function fetchBinary(
  url: string,
  options: FetchBinaryOptions = {},
): Promise<FetchBinaryResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_BINARY_TIMEOUT_MS;
  const maxRedirects = options.maxRedirects ?? MAX_REDIRECTS;
  const maxBytes = options.maxBytes ?? Number.POSITIVE_INFINITY;
  const headers = { ...options.headers };
  const nodeHttpFallback = options.nodeHttpFallback ?? DEFAULT_NODE_HTTP_FALLBACK;
  const validateUrl = options.validateUrl ?? (() => {});

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    try {
      return await fetchBinaryViaNativeFetch(url, {
        signal: controller.signal,
        headers,
        maxRedirects,
        maxBytes,
        validateUrl,
      });
    } catch (nativeError) {
      if (hasHttpStatus(nativeError)) {
        // Already a controlled classification (SSRF/redirect/size limit) —
        // surface it as-is instead of masking it behind a transport retry.
        throw nativeError;
      }

      if (nativeError instanceof Error && nativeError.name === "AbortError") {
        throw Object.assign(new Error(`Timed out after ${timeoutMs}ms loading ${url}`), {
          httpStatus: 504,
          cause: nativeError,
        });
      }

      if (!nodeHttpFallback || !shouldUseNodeHttpFallback(nativeError)) {
        throw Object.assign(new Error(buildNetworkErrorMessage(url, nativeError)), {
          httpStatus: 502,
          cause: nativeError,
        });
      }

      console.warn("[import.fetchBinary] native fetch transport failed; trying node http fallback", {
        url,
        error: describeFetchError(nativeError),
      });

      try {
        return await fetchBinaryViaNodeHttp(url, {
          timeoutMs,
          headers,
          maxRedirects,
          maxBytes,
          validateUrl,
        });
      } catch (fallbackError) {
        if (hasHttpStatus(fallbackError)) throw fallbackError;
        throw createNodeTransportError(nativeError, fallbackError, 502);
      }
    }
  } finally {
    clearTimeout(timer);
  }
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
