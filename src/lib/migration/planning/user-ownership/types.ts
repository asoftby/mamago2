/**
 * Read-only planning models for USERS Slice 6 (manual/privileged backlog +
 * business ownership + content authorship planning). Nothing in this module
 * performs a database write — see `readOnlyRepository.ts` for the runtime
 * and compile-time enforcement.
 */

export type ManualPrivilegeSignalType = "LEGACY_ADMINISTRATOR_ROLE" | "LEGACY_MODERATOR_ROLE" | "OTHER_LEGACY_PRIVILEGED_ROLE";

export type ManualCollisionType = "NONE" | "EMAIL_COLLISION_NON_PRIVILEGED_TARGET" | "EMAIL_COLLISION_PRIVILEGED_TARGET";

export type ManualTargetStateCategory = "NO_TARGET_ACCOUNT_EXISTS" | "EXISTING_NON_PRIVILEGED_TARGET_ACCOUNT" | "EXISTING_PRIVILEGED_TARGET_ACCOUNT";

export type ManualReasonCode =
  | "PRIVILEGED_SOURCE_ACCOUNT"
  | "PRIVILEGED_TARGET_COLLISION"
  | "EXISTING_USER_EMAIL_COLLISION"
  | "AMBIGUOUS_IDENTITY"
  | "CONFLICTING_PRIVILEGE_SIGNALS"
  | "MISSING_SAFE_AUTO_MIGRATION_PATH"
  | "OWNERSHIP_REQUIRES_MANUAL_REVIEW"
  | "AUTHORSHIP_REQUIRES_MANUAL_REVIEW";

export type ManualRecommendedDisposition =
  | "KEEP_EXISTING_TARGET_UNCHANGED"
  | "MANUAL_LINK_AFTER_IDENTITY_VERIFICATION"
  | "MANUAL_CREATE_PENDING_ACCOUNT"
  | "EXCLUDE_FROM_MIGRATION"
  | "REQUIRES_FOUNDER_DECISION";

export interface ManualBacklogEntry {
  sourceRecordKey: string;
  classification: "MANUAL_PRIVILEGED";
  reasonCodes: readonly ManualReasonCode[];
  privilegeSignalTypes: readonly ManualPrivilegeSignalType[];
  collisionType: ManualCollisionType;
  targetStateCategory: ManualTargetStateCategory;
  ownershipEvidenceCount: number;
  authorshipEvidenceCount: number;
  recommendedDisposition: ManualRecommendedDisposition;
  requiresHumanDecision: true;
  automaticRoleChange: "FORBIDDEN";
  evidenceHash: string;
}

export type OwnershipAction =
  | "EXACT_LINK_CANDIDATE"
  | "ALREADY_SATISFIED"
  | "TARGET_ENTITY_NOT_MIGRATED"
  | "TARGET_ENTITY_AMBIGUOUS"
  | "CURRENT_OWNER_CONFLICT"
  | "MULTIPLE_SOURCE_OWNERS"
  | "UNSUPPORTED_RELATION"
  | "MANUAL_REVIEW";

export type OwnershipRoleRecommendation = "KEEP_USER" | "ELIGIBLE_FOR_BUSINESS_OWNER_AFTER_OWNERSHIP_WRITE" | "MANUAL_ROLE_REVIEW";

export interface BusinessOwnershipPlanEntry {
  sourceRecordKey: string;
  userLineagePresent: boolean;
  sourceEntityType: "PLACE";
  sourceEntityCount: number;
  sourceEntityLineagePresentCount: number;
  action: OwnershipAction;
  roleRecommendation: OwnershipRoleRecommendation;
  currentStateCategory: "NO_TARGET_BUSINESS" | "TARGET_BUSINESS_OWNED_BY_SAME_USER" | "TARGET_BUSINESS_OWNED_BY_OTHER_USER" | "NOT_APPLICABLE";
  evidenceHash: string;
}

export type AuthorshipAction =
  | "EXACT_AUTHOR_LINK_CANDIDATE"
  | "ALREADY_SATISFIED"
  | "TARGET_CONTENT_NOT_MIGRATED"
  | "TARGET_CONTENT_AMBIGUOUS"
  | "CURRENT_AUTHOR_CONFLICT"
  | "MULTIPLE_SOURCE_AUTHORS"
  | "UNSUPPORTED_CONTENT_TYPE"
  | "MANUAL_REVIEW";

export type AuthoredContentType = "ARTICLE" | "ROUTE" | "ACTIVITY";

export interface ContentAuthorshipPlanEntry {
  sourceRecordKey: string;
  userLineagePresent: boolean;
  authoredContentTypes: readonly AuthoredContentType[];
  authoredContentCount: number;
  authoredContentLineagePresentCount: number;
  action: AuthorshipAction;
  evidenceHash: string;
}

export interface PlanningSummary {
  manual: {
    total: number;
    automaticActions: 0;
    dispositionCounts: Record<ManualRecommendedDisposition, number>;
  };
  businessOwnership: {
    users: number;
    reconciledUserLineages: number;
    exactCandidates: number;
    alreadySatisfied: number;
    missingTarget: number;
    conflicts: number;
    ambiguousOrManual: number;
    unsupported: number;
    ownershipWrites: 0;
    roleChanges: 0;
  };
  contentAuthorship: {
    users: number;
    reconciledUserLineages: number;
    exactCandidates: number;
    alreadySatisfied: number;
    missingTarget: number;
    conflicts: number;
    ambiguousOrManual: number;
    unsupported: number;
    authorshipWrites: 0;
  };
}

export interface PlanningManifests {
  manualBacklog: readonly ManualBacklogEntry[];
  businessOwnershipPlan: readonly BusinessOwnershipPlanEntry[];
  contentAuthorshipPlan: readonly ContentAuthorshipPlanEntry[];
  summary: PlanningSummary;
  hashes: {
    manualBacklog: string;
    businessOwnershipPlan: string;
    contentAuthorshipPlan: string;
  };
}
