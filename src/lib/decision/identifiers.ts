import { z } from "zod";

/**
 * Bounded contract for opaque product identifiers that clients supply and we
 * persist or match on (guest anonymousId, recommendation exposure id). UUIDs
 * and cuids both fit; anything longer or with free-text characters is
 * rejected before it can reach the database.
 */
export const SAFE_OPAQUE_ID_MAX_LENGTH = 64;
const SAFE_OPAQUE_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

export const SafeOpaqueIdSchema = z.string().regex(SAFE_OPAQUE_ID_RE, "invalid_identifier");

/** Returns the id when it satisfies the bounded contract, otherwise null. */
export function parseSafeOpaqueId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const parsed = SafeOpaqueIdSchema.safeParse(value.trim());
  return parsed.success ? parsed.data : null;
}

/**
 * Optional client-supplied identifier: absent/blank means "not provided"
 * (ok), a present-but-malformed value means the request is malformed.
 */
export function readOptionalSafeOpaqueId(
  value: unknown,
): { ok: true; value: string | null } | { ok: false } {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false };
  const trimmed = value.trim();
  if (trimmed.length === 0) return { ok: true, value: null };
  const parsed = parseSafeOpaqueId(trimmed);
  return parsed ? { ok: true, value: parsed } : { ok: false };
}
