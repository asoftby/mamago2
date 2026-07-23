import { canonicalHash } from "./canonicalJson";
import type { UserOwnershipReadOnlyRepository } from "./readOnlyRepository";
import type { BusinessOwnershipSourceEvidence } from "./snapshotEvidence";
import type { BusinessOwnershipPlanEntry, OwnershipAction, OwnershipRoleRecommendation } from "./types";

/**
 * Reconciles each business-linked migrated user against the *exact*
 * `MigrationLineage` rows for the User and for every WordPress `places`
 * post they authored — never by title/slug/name/email similarity. Places
 * currently reach the target DB with `ownerBusinessId = null` (no Business
 * has been created from WordPress yet), so "already linked" is detected
 * from that field, not assumed.
 */
export async function planBusinessOwnership(
  evidenceList: readonly BusinessOwnershipSourceEvidence[],
  repository: UserOwnershipReadOnlyRepository,
): Promise<readonly BusinessOwnershipPlanEntry[]> {
  const userSourceKeys = evidenceList.map(evidence => evidence.sourceRecordKey);
  const userLineage = await repository.findLineageTargetIds("USER", userSourceKeys);

  const allPlaceSourceKeys = evidenceList.flatMap(evidence => evidence.placePostIds.map(postId => `wordpress-db:places:${postId}`));
  const placeLineage = await repository.findLineageTargetIds("PLACE", allPlaceSourceKeys);

  const matchedPlaceIds = [...new Set([...placeLineage.values()])];
  const placeOwnership = await repository.findPlaceOwnership(matchedPlaceIds);

  const businessIds = [...new Set([...placeOwnership.values()].map(row => row.ownerBusinessId).filter((id): id is string => id !== null))];
  const businessOwners = await repository.findBusinessOwners(businessIds);

  // Detect a Place claimed by more than one business-linked source user (a real ownership conflict signal).
  const placeTargetClaimants = new Map<string, string[]>();
  for (const evidence of evidenceList) {
    for (const postId of evidence.placePostIds) {
      const targetId = placeLineage.get(`wordpress-db:places:${postId}`);
      if (!targetId) continue;
      const claimants = placeTargetClaimants.get(targetId) ?? [];
      claimants.push(evidence.sourceRecordKey);
      placeTargetClaimants.set(targetId, claimants);
    }
  }

  const entries: BusinessOwnershipPlanEntry[] = [];
  for (const evidence of evidenceList) {
    const targetUserId = userLineage.get(evidence.sourceRecordKey) ?? null;
    const userLineagePresent = targetUserId !== null;

    const placeTargetIds = evidence.placePostIds.map(postId => placeLineage.get(`wordpress-db:places:${postId}`) ?? null);
    const matched = placeTargetIds.filter((id): id is string => id !== null);

    const hasMultipleClaimants = matched.some(id => (placeTargetClaimants.get(id) ?? []).length > 1);

    let action: OwnershipAction;
    let currentStateCategory: BusinessOwnershipPlanEntry["currentStateCategory"];

    if (!userLineagePresent) {
      action = "MANUAL_REVIEW";
      currentStateCategory = "NOT_APPLICABLE";
    } else if (matched.length === 0) {
      action = "TARGET_ENTITY_NOT_MIGRATED";
      currentStateCategory = "NOT_APPLICABLE";
    } else if (hasMultipleClaimants) {
      action = "MULTIPLE_SOURCE_OWNERS";
      currentStateCategory = "NOT_APPLICABLE";
    } else {
      const conflicting = matched.some(id => {
        const ownership = placeOwnership.get(id);
        if (!ownership?.ownerBusinessId) return false;
        const businessOwnerUserId = businessOwners.get(ownership.ownerBusinessId);
        return businessOwnerUserId !== undefined && businessOwnerUserId !== targetUserId;
      });
      const allAlreadyOwnedBySameUser =
        matched.length > 0 &&
        matched.every(id => {
          const ownership = placeOwnership.get(id);
          if (!ownership?.ownerBusinessId) return false;
          return businessOwners.get(ownership.ownerBusinessId) === targetUserId;
        });

      if (conflicting) {
        action = "CURRENT_OWNER_CONFLICT";
        currentStateCategory = "TARGET_BUSINESS_OWNED_BY_OTHER_USER";
      } else if (allAlreadyOwnedBySameUser) {
        action = "ALREADY_SATISFIED";
        currentStateCategory = "TARGET_BUSINESS_OWNED_BY_SAME_USER";
      } else if (matched.length < placeTargetIds.length) {
        // Not every owned source Place has a target lineage yet — evidence is incomplete, not exact.
        action = "MANUAL_REVIEW";
        currentStateCategory = "NO_TARGET_BUSINESS";
      } else {
        action = "EXACT_LINK_CANDIDATE";
        currentStateCategory = "NO_TARGET_BUSINESS";
      }
    }

    const roleRecommendation: OwnershipRoleRecommendation =
      action === "EXACT_LINK_CANDIDATE" ? "ELIGIBLE_FOR_BUSINESS_OWNER_AFTER_OWNERSHIP_WRITE" : action === "ALREADY_SATISFIED" ? "KEEP_USER" : "MANUAL_ROLE_REVIEW";

    const entryCore = {
      sourceRecordKey: evidence.sourceRecordKey,
      userLineagePresent,
      sourceEntityType: "PLACE" as const,
      sourceEntityCount: evidence.placePostIds.length,
      sourceEntityLineagePresentCount: matched.length,
      action,
      roleRecommendation,
      currentStateCategory,
    };
    entries.push({ ...entryCore, evidenceHash: canonicalHash(entryCore) });
  }

  return entries.sort((a, b) => (a.sourceRecordKey < b.sourceRecordKey ? -1 : 1));
}
