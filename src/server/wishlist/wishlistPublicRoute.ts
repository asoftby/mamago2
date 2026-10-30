import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { isSecureCookie } from "@/lib/auth/cookie";
import { getCurrentUser } from "@/lib/auth/server";
import { getTrustedClientIp } from "@/lib/security/clientIp";
import { checkRateLimit } from "@/lib/security/rateLimit";

import {
  WishlistError,
  claimCookieName,
  parseClaimCookie,
  serializeClaimCookie,
  wishlistEnabled,
  wishlistErrorStatus,
} from "./wishlistPure";

export type GuestViewer = { userId: string | null; rawClaims: string[] };

const CLAIM_COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

/** Flag + error mapping + viewer (optional account, claim tokens from the list's cookie). */
export async function withGuest(
  request: NextRequest,
  shareToken: string,
  handler: (viewer: GuestViewer) => Promise<NextResponse>,
  rate?: { bucket: string; limit: number; windowMs: number },
): Promise<NextResponse> {
  if (!wishlistEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  try {
    if (rate) {
      // IP is only an ephemeral key part (never stored). Without a trusted IP (no proxy
      // headers configured) there is no per-IP bucket: a shared "unknown" key would turn
      // it into a site-wide limit. The per-list bucket still caps abuse.
      const ip = getTrustedClientIp(request);
      const [perIp, perList] = await Promise.all([
        ip ? checkRateLimit(`wl:${rate.bucket}:ip:${ip}`, rate.limit, rate.windowMs) : Promise.resolve({ allowed: true }),
        checkRateLimit(`wl:${rate.bucket}:list:${shareToken.slice(0, 8)}`, rate.limit * 10, rate.windowMs),
      ]);
      if (!perIp.allowed || !perList.allowed) {
        throw new WishlistError("rate_limited", "Слишком много попыток, попробуйте позже");
      }
    }
    const user = await getCurrentUser();
    const rawClaims = parseClaimCookie(request.cookies.get(claimCookieName(shareToken))?.value);
    return await handler({ userId: user?.id ?? null, rawClaims });
  } catch (error) {
    if (error instanceof WishlistError) {
      return NextResponse.json(
        { error: error.code, message: error.message, details: error.details ?? null },
        { status: wishlistErrorStatus(error.code) },
      );
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "invalid_input", message: error.issues[0]?.message ?? "Некорректные данные" },
        { status: 400 },
      );
    }
    console.error("[wishlist] guest unexpected error", error instanceof Error ? error.name : typeof error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export function setClaimCookie(response: NextResponse, shareToken: string, tokens: string[]): void {
  response.cookies.set(claimCookieName(shareToken), serializeClaimCookie(tokens), {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureCookie(),
    path: "/",
    maxAge: CLAIM_COOKIE_MAX_AGE,
  });
}
