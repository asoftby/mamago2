import { isIP } from "node:net";
import type { NextRequest } from "next/server";

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

/**
 * The ONLY sanctioned way to read a client's IP address anywhere in this
 * app. Verified against the live Traefik v3.6.1 ingress (2026-08-18):
 * `forwardedHeaders.insecure=false`, `trustedIPs` empty, no CDN in front —
 * a client-supplied `X-Forwarded-For`/`X-Real-IP` does NOT survive ingress,
 * but a client-supplied `CF-Connecting-IP` DOES (nothing strips it, there's
 * no real Cloudflare in front). Traefik itself sets `X-Real-IP` from the
 * true TCP peer address, so that is the only header this app may trust.
 *
 * Trust is gated behind `TRUST_PROXY_HEADERS` — off by default everywhere
 * (including this repo's env files), flipped only once a deployment is
 * confirmed to sit behind this exact Traefik contract. Never fall back to
 * `CF-Connecting-IP`, `X-Forwarded-For`, or the RFC 7239 `Forwarded`
 * header — all are attacker-controllable in this topology.
 *
 * Never persist the raw return value and never log it — callers use it
 * only as an ephemeral rate-limit/identity key component.
 */
export function getTrustedClientIp(
  request: NextRequest,
  trustProxyHeaders = process.env.TRUST_PROXY_HEADERS === "true",
): string | null {
  if (!trustProxyHeaders) {
    return null;
  }
  const raw = request.headers.get("x-real-ip");
  if (!raw) {
    return null;
  }
  return normalizeIp(raw);
}
