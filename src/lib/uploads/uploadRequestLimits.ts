import type { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { getTrustedClientIp } from "@/lib/security/clientIp";
import { MAX_UPLOAD_SIZE_BYTES } from "./uploadConfig";
import { jsonUploadError } from "./uploadErrors";

/** Multipart framing around one file (boundary, headers, small text fields). */
export const UPLOAD_MULTIPART_OVERHEAD_BYTES = 256 * 1024;
export const UPLOAD_MAX_REQUEST_BYTES = MAX_UPLOAD_SIZE_BYTES + UPLOAD_MULTIPART_OVERHEAD_BYTES;

export const UPLOAD_RATE_LIMITS = {
  perUser: { limit: 60, windowMs: 10 * 60 * 1000 },
  perIp: { limit: 120, windowMs: 10 * 60 * 1000 },
} as const;

type RateLimitCheck = (key: string, limit: number, windowMs: number) => Promise<{ allowed: boolean }>;

/**
 * AUDIT-XR-20: bound the request before `formData()` buffers it, and cap the
 * upload rate per user and per IP (image decoding and storage are costly).
 * Must run after authentication. Returns an error response or null.
 */
export async function enforceUploadRequestLimits(
  request: Pick<NextRequest, "headers">,
  userId: string,
  check: RateLimitCheck = checkRateLimit,
): Promise<NextResponse | null> {
  const declared = request.headers.get("content-length");
  if (declared === null || !/^\d+$/.test(declared)) {
    return jsonUploadError("LENGTH_REQUIRED", "Upload request must declare its size", 411);
  }
  if (Number(declared) > UPLOAD_MAX_REQUEST_BYTES) {
    return jsonUploadError("FILE_TOO_LARGE", "Upload request is too large", 413);
  }

  const user = await check(`upload:user:${userId}`, UPLOAD_RATE_LIMITS.perUser.limit, UPLOAD_RATE_LIMITS.perUser.windowMs);
  if (!user.allowed) return jsonUploadError("RATE_LIMITED", "Too many uploads. Try again later.", 429);

  const ip = getTrustedClientIp(request as NextRequest);
  if (ip) {
    const byIp = await check(`upload:ip:${ip}`, UPLOAD_RATE_LIMITS.perIp.limit, UPLOAD_RATE_LIMITS.perIp.windowMs);
    if (!byIp.allowed) return jsonUploadError("RATE_LIMITED", "Too many uploads. Try again later.", 429);
  }
  return null;
}
