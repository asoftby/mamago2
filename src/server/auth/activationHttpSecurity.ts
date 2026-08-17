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

// Trusted client-IP extraction lives in @/lib/security/clientIp
// (getTrustedClientIp) — the single canonical helper for the whole app.
// Do not re-implement IP extraction here.

export async function waitForGenericResponseFloor(
  startedAt: number,
  floorMs = 200,
): Promise<void> {
  const remaining = floorMs - (performance.now() - startedAt);
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
}
