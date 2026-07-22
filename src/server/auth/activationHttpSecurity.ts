import { isIP } from "node:net";
import type { NextRequest } from "next/server";

export async function readSizeLimitedJson(
  request: NextRequest,
  maxBytes: number,
): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    throw new Error("INVALID_CONTENT_TYPE");
  }
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error("BODY_TOO_LARGE");
  }
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    throw new Error("BODY_TOO_LARGE");
  }
  return JSON.parse(text) as unknown;
}

function normalizeIp(value: string): string | null {
  const candidate = value.trim().toLowerCase();
  const version = isIP(candidate);
  if (version === 4) {
    return candidate;
  }
  if (version === 6) {
    const hostname = new URL(`http://[${candidate}]/`).hostname;
    return hostname.slice(1, -1).toLowerCase();
  }
  return null;
}

/** Proxy headers are accepted only when the deployment explicitly trusts its proxy. */
export function trustedClientIp(
  request: NextRequest,
  trustProxyHeaders = process.env.TRUST_PROXY_HEADERS === "true",
): string | null {
  if (!trustProxyHeaders) {
    return null;
  }
  const raw =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0] ??
    "";
  return normalizeIp(raw);
}

export async function waitForGenericResponseFloor(
  startedAt: number,
  floorMs = 200,
): Promise<void> {
  const remaining = floorMs - (performance.now() - startedAt);
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
}
