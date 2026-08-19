import { canonicalHash } from "./canonicalJson";
import type { ManualSourceEvidence } from "./snapshotEvidence";
import type {
  ManualBacklogEntry,
  ManualCollisionType,
  ManualPrivilegeSignalType,
  ManualReasonCode,
  ManualRecommendedDisposition,
  ManualTargetStateCategory,
} from "./types";

const ELEVATED_LOCAL_ROLES = new Set(["ADMIN", "MODERATOR", "BUSINESS_OWNER"]);

function privilegeSignalTypes(roles: readonly string[]): readonly ManualPrivilegeSignalType[] {
  const signals: ManualPrivilegeSignalType[] = [];
  if (roles.includes("administrator")) signals.push("LEGACY_ADMINISTRATOR_ROLE");
  if (roles.some(role => role.toLowerCase().includes("moderator"))) signals.push("LEGACY_MODERATOR_ROLE");
  if (signals.length === 0) signals.push("OTHER_LEGACY_PRIVILEGED_ROLE");
  return signals;
}

function collisionType(evidence: ManualSourceEvidence): ManualCollisionType {
  if (!evidence.emailCollision || evidence.localCandidateRoles.length === 0) return "NONE";
  const hasElevatedCandidate = evidence.localCandidateRoles.some(role => ELEVATED_LOCAL_ROLES.has(role));
  return hasElevatedCandidate ? "EMAIL_COLLISION_PRIVILEGED_TARGET" : "EMAIL_COLLISION_NON_PRIVILEGED_TARGET";
}

function targetStateCategory(collision: ManualCollisionType): ManualTargetStateCategory {
  if (collision === "EMAIL_COLLISION_PRIVILEGED_TARGET") return "EXISTING_PRIVILEGED_TARGET_ACCOUNT";
  if (collision === "EMAIL_COLLISION_NON_PRIVILEGED_TARGET") return "EXISTING_NON_PRIVILEGED_TARGET_ACCOUNT";
  return "NO_TARGET_ACCOUNT_EXISTS";
}

function reasonCodes(evidence: ManualSourceEvidence, collision: ManualCollisionType): readonly ManualReasonCode[] {
  const codes: ManualReasonCode[] = ["PRIVILEGED_SOURCE_ACCOUNT", "MISSING_SAFE_AUTO_MIGRATION_PATH"];
  if (evidence.emailCollision) codes.push("EXISTING_USER_EMAIL_COLLISION");
  if (collision === "EMAIL_COLLISION_PRIVILEGED_TARGET") codes.push("PRIVILEGED_TARGET_COLLISION");
  if (evidence.localCandidateRoles.length > 0 && evidence.identityConfidence === "LOW") codes.push("AMBIGUOUS_IDENTITY");
  if (evidence.ownershipEvidenceCount > 0) codes.push("OWNERSHIP_REQUIRES_MANUAL_REVIEW");
  if (evidence.authorshipEvidenceCount > 0) codes.push("AUTHORSHIP_REQUIRES_MANUAL_REVIEW");
  return codes;
}

/**
 * Deterministic disposition rule, evidence-driven only (no per-user
 * hardcoding): an existing elevated local account is never touched; a
 * privileged source account with real ownership/authorship evidence needs
 * a founder decision; a privileged source account with no observable
 * footprint at all is the safest default to recommend excluding.
 */
function recommendedDisposition(collision: ManualCollisionType, evidence: ManualSourceEvidence): ManualRecommendedDisposition {
  if (collision === "EMAIL_COLLISION_PRIVILEGED_TARGET") return "KEEP_EXISTING_TARGET_UNCHANGED";
  if (collision === "EMAIL_COLLISION_NON_PRIVILEGED_TARGET") return "MANUAL_LINK_AFTER_IDENTITY_VERIFICATION";
  if (evidence.ownershipEvidenceCount > 0 || evidence.authorshipEvidenceCount > 0) return "REQUIRES_FOUNDER_DECISION";
  return "EXCLUDE_FROM_MIGRATION";
}

export function planManualBacklog(evidenceList: readonly ManualSourceEvidence[]): readonly ManualBacklogEntry[] {
  const seen = new Set<string>();
  const entries: ManualBacklogEntry[] = [];
  for (const evidence of evidenceList) {
    if (seen.has(evidence.sourceRecordKey)) throw new Error(`Duplicate manual/privileged sourceRecordKey "${evidence.sourceRecordKey}".`);
    seen.add(evidence.sourceRecordKey);

    const collision = collisionType(evidence);
    const entryCore = {
      sourceRecordKey: evidence.sourceRecordKey,
      classification: "MANUAL_PRIVILEGED" as const,
      reasonCodes: reasonCodes(evidence, collision),
      privilegeSignalTypes: privilegeSignalTypes(evidence.roles),
      collisionType: collision,
      targetStateCategory: targetStateCategory(collision),
      ownershipEvidenceCount: evidence.ownershipEvidenceCount,
      authorshipEvidenceCount: evidence.authorshipEvidenceCount,
      recommendedDisposition: recommendedDisposition(collision, evidence),
      requiresHumanDecision: true as const,
      automaticRoleChange: "FORBIDDEN" as const,
    };
    entries.push({ ...entryCore, evidenceHash: canonicalHash(entryCore) });
  }
  return entries.sort((a, b) => (a.sourceRecordKey < b.sourceRecordKey ? -1 : 1));
}
