import * as http from "node:http";
import * as https from "node:https";
import type { LookupAddress } from "node:dns";
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP, type LookupFunction } from "node:net";

import { assertSafeRemoteImageUrl, isPublicIpAddress } from "@/lib/media/safeRemoteImageUrl";
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
   * Kept for call-site compatibility. HTML transport is now always the pinned
   * Node http/https path used by fetchBinary(), so there is no unsafe native
   * fetch fallback anymore.
   */
  nodeHttpFallback?: boolean;
  /** Maximum response body size across HTML import requests. */
  maxBytes?: number;
  /** Maximum number of redirects; every hop is revalidated and DNS-pinned. */
  maxRedirects?: number;
  /**
   * Optional source-specific URL policy. The generic public-http(s) SSRF
   * policy is always applied first; this hook can further restrict hosts/path.
   */
  validateUrl?: (url: URL) => void;
  /** @internal Deterministic security-test injection only. */
  resolveHostname?: FetchBinaryOptions["resolveHostname"];
  /** @internal Deterministic security-test injection only. */
  request?: FetchBinaryOptions["request"];
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
const DEFAULT_HTML_MAX_BYTES = 5 * 1024 * 1024;
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
// and low-level Node http/https transport. Unlike `fetchHtml`, DNS is resolved
// and classified before each request, then the socket is pinned to that exact
// approved address. Redirects are followed manually so
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
  /** @internal Injected only by deterministic transport security tests. */
  resolveHostname?: (hostname: string) => Promise<LookupAddress[]>;
  /** @internal Injected only by deterministic transport security tests. */
  request?: BinaryRequestFactory;
}

type BinaryRequest = Pick<http.ClientRequest, "setTimeout" | "on" | "end" | "destroy">;
type BinaryRequestFactory = (
  url: URL,
  options: https.RequestOptions,
  onResponse: (response: http.IncomingMessage) => void,
) => BinaryRequest;

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

function unsafeRemoteUrlError(): Error {
  return Object.assign(new Error("Remote URL is not allowed"), { httpStatus: 400 });
}

function unbracketHostname(hostname: string): string {
  return hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;
}

/**
 * Resolve every A/AAAA answer, reject the whole hostname if any destination
 * is non-public, and return one already-approved address for connection
 * pinning. DNS errors and empty answers fail closed.
 */
export async function resolveSafeRemoteAddress(
  url: URL,
  resolveHostname: (hostname: string) => Promise<LookupAddress[]> = (hostname) =>
    dnsLookup(hostname, { all: true, verbatim: true }),
): Promise<LookupAddress> {
  const hostname = unbracketHostname(url.hostname).replace(/\.$/, "");
  const literalFamily = isIP(hostname);

  let addresses: LookupAddress[];
  try {
    addresses = literalFamily
      ? [{ address: hostname, family: literalFamily }]
      : await resolveHostname(hostname);
  } catch {
    throw unsafeRemoteUrlError();
  }

  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicIpAddress(address))) {
    throw unsafeRemoteUrlError();
  }

  return addresses[0]!;
}

function exceedsDeclaredLength(headerValue: string | undefined | null, maxBytes: number): boolean {
  if (!headerValue) return false;
  const declared = Number.parseInt(headerValue, 10);
  return Number.isFinite(declared) && declared > maxBytes;
}

async function fetchBinaryViaNodeHttp(
  url: string,
  options: {
    timeoutMs: number;
    headers: Record<string, string>;
    maxRedirects: number;
    maxBytes: number;
    validateUrl: (url: URL) => void;
    resolveHostname: (hostname: string) => Promise<LookupAddress[]>;
    request?: BinaryRequestFactory;
    deadline: number;
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

  const pinnedAddress = await resolveSafeRemoteAddress(parsedUrl, options.resolveHostname);
  const remainingMs = options.deadline - Date.now();
  if (remainingMs <= 0) {
    throw Object.assign(new Error("Remote request timed out"), { httpStatus: 504 });
  }

  const transport = parsedUrl.protocol === "https:" ? https : http;
  // Source-specific CA bundles only extend the normal trusted roots for known
  // upstreams with incomplete chains (see familyByTls.ts). Verification is
  // never disabled, and unrelated hosts keep Node's default TLS behavior.
  const sourceSpecificTlsCa = resolveSourceSpecificTlsCa(parsedUrl);

  return new Promise<FetchBinaryResult>((resolve, reject) => {
    const requestOptions: https.RequestOptions = {
        method: "GET",
        headers: options.headers,
        ca: sourceSpecificTlsCa,
        // Bind the socket to the exact address approved above. The URL keeps
        // the original hostname, so Host, TLS SNI and certificate validation
        // retain their normal semantics while no uncontrolled second DNS
        // lookup can change the destination.
        lookup: ((_hostname, lookupOptions, callback) => {
          if (typeof lookupOptions === "object" && lookupOptions.all) {
            (callback as (error: null, addresses: LookupAddress[]) => void)(null, [pinnedAddress]);
            return;
          }
          (callback as (error: null, address: string, family: number) => void)(
            null,
            pinnedAddress.address,
            pinnedAddress.family,
          );
        }) as LookupFunction,
      };
    const onResponse = (response: http.IncomingMessage) => {
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
      };
    const request = options.request
      ? options.request(parsedUrl, requestOptions, onResponse)
      : transport.request(parsedUrl, requestOptions, onResponse);

    request.setTimeout(remainingMs, () => {
      request.destroy(
        Object.assign(new Error("Remote request timed out"), {
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
 * and source-specific CA workaround as `fetchHtml`; the only workaround for
 * an upstream's incomplete chain lives in `familyByTls.ts`.
 *
 * Redirects are followed manually; every hop is URL-validated, fully resolved
 * and IP-classified before a pinned connection is made.
 */
export async function fetchBinary(
  url: string,
  options: FetchBinaryOptions = {},
): Promise<FetchBinaryResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_BINARY_TIMEOUT_MS;
  const maxRedirects = options.maxRedirects ?? MAX_REDIRECTS;
  const maxBytes = options.maxBytes ?? Number.POSITIVE_INFINITY;
  const headers = { ...options.headers };
  const validateUrl = options.validateUrl ?? (() => {});
  const resolveHostname = options.resolveHostname ?? ((hostname: string) =>
    dnsLookup(hostname, { all: true, verbatim: true }));
  const deadline = Date.now() + timeoutMs;
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      fetchBinaryViaNodeHttp(url, {
        timeoutMs,
        headers,
        maxRedirects,
        maxBytes,
        validateUrl,
        resolveHostname,
        request: options.request,
        deadline,
      }),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(Object.assign(new Error("Remote request timed out"), { httpStatus: 504 }));
        }, timeoutMs);
      }),
    ]);
  } catch (error) {
    if (hasHttpStatus(error)) throw error;
    throw Object.assign(new Error(buildNetworkErrorMessage(url, error)), {
      httpStatus: 502,
      cause: error,
    });
  } finally {
    if (timer) clearTimeout(timer);
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
  const maxBytes = options.maxBytes ?? DEFAULT_HTML_MAX_BYTES;
  const maxRedirects = options.maxRedirects ?? MAX_REDIRECTS;
  const headers = {
    ...DEFAULT_HEADERS,
    // Low-level Node transport does not transparently decompress responses.
    // Explicit identity encoding keeps HTML decoding deterministic.
    "Accept-Encoding": "identity",
    ...options.headers,
  };

  const validateUrl = (candidate: URL) => {
    // Generic SSRF policy: http(s) only, no credentials/private literals.
    // fetchBinary additionally resolves every A/AAAA answer, rejects any
    // non-public destination, and pins the approved address to the socket.
    assertSafeRemoteImageUrl(candidate.toString());
    options.validateUrl?.(candidate);
  };

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetchBinary(url, {
        timeoutMs,
        headers,
        maxBytes,
        maxRedirects,
        validateUrl,
        resolveHostname: options.resolveHostname,
        request: options.request,
      });

      return {
        html: new TextDecoder(encoding).decode(response.buffer),
        finalUrl: response.finalUrl,
        status: response.status,
        headers: response.headers,
      };
    } catch (error) {
      const normalizedError =
        error instanceof Error ? error : new Error(buildNetworkErrorMessage(url, error));

      console.warn("[import.fetchHtml] request failed", {
        url,
        attempt,
        error: describeFetchError(error),
      });

      lastError = normalizedError;
      if (attempt < attempts) {
        await sleep(retryDelayMs);
      }
    }
  }

  const fallbackMessage = lastError?.message ?? `Failed to load ${url} (unknown error)`;
  throw Object.assign(new Error(fallbackMessage), {
    cause: lastError ?? undefined,
    ...(hasHttpStatus(lastError) ? { httpStatus: lastError.httpStatus } : {}),
  });
}
