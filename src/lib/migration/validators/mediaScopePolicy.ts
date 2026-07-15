import type { MigrationMediaScope, MigrationWarning } from "../types";

/**
 * `EVENT` was added 2026-07-15 (sampled media policy PR) — this scope used
 * to be the unconditionally-blocked `EVENT_BLOCKED`, reflecting an earlier
 * "Phoenix v1 does not migrate WordPress event images" decision. That
 * decision was superseded once `EventMediaSyncer`/
 * `MediaPolicyGatedEventMediaSyncer` were built: Event media is real and
 * approved, gated the same way as every other entity (FULL in production,
 * sampled FULL/METADATA in local/dev via `resolveSampledMediaPolicy`).
 * This validator was never actually wired into any commit path (confirmed
 * by grep — zero callers outside this module and its own test), so
 * flipping it has no runtime effect on its own; it's fixed here so it
 * doesn't keep asserting a stale blanket block if it's ever wired in.
 */
export const APPROVED_MEDIA_SCOPES = [
  "USER_PROFILE",
  "BUSINESS_PROFILE",
  "PLACE",
  "ARTICLE",
  "OFFER_SERVICES",
  "OFFER_PROGRAMS",
  "ROUTE",
  "EVENT",
] as const satisfies readonly MigrationMediaScope[];

const approvedMediaScopes = new Set<MigrationMediaScope>(APPROVED_MEDIA_SCOPES);

export interface MediaScopePolicyDecision {
  scope: MigrationMediaScope;
  allowed: boolean;
  warning?: MigrationWarning;
}

export function isApprovedMediaScope(scope: MigrationMediaScope): boolean {
  return approvedMediaScopes.has(scope);
}

export function evaluateMediaScope(
  scope: MigrationMediaScope,
): MediaScopePolicyDecision {
  if (isApprovedMediaScope(scope)) {
    return { scope, allowed: true };
  }

  return {
    scope,
    allowed: false,
    warning: {
      code: "MEDIA_SCOPE_NOT_APPROVED",
      message: `Media scope "${scope}" is not on the approved list for this migration phase.`,
      severity: "WARNING",
      details: { scope },
    },
  };
}
