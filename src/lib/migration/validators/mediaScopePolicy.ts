import type { MigrationMediaScope, MigrationWarning } from "../types";

export const APPROVED_MEDIA_SCOPES = [
  "USER_PROFILE",
  "BUSINESS_PROFILE",
  "PLACE",
  "ARTICLE",
  "OFFER_SERVICES",
  "OFFER_PROGRAMS",
  "ROUTE",
] as const satisfies readonly MigrationMediaScope[];

export const BLOCKED_EVENT_MEDIA_POLICY = {
  policyKey: "PHOENIX_V1_EVENT_MEDIA_BLOCKED",
  blockedScope: "EVENT_BLOCKED",
  reasonCode: "EVENT_MEDIA_NOT_MIGRATED",
  message: "Phoenix v1 does not migrate WordPress event images.",
} as const;

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
      code: BLOCKED_EVENT_MEDIA_POLICY.reasonCode,
      message: BLOCKED_EVENT_MEDIA_POLICY.message,
      severity: "WARNING",
      details: {
        policyKey: BLOCKED_EVENT_MEDIA_POLICY.policyKey,
        scope,
      },
    },
  };
}
