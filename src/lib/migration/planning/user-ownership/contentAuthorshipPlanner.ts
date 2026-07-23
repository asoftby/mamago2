import { canonicalHash } from "./canonicalJson";
import type { UserOwnershipReadOnlyRepository } from "./readOnlyRepository";
import type { AuthoredContentItem, ContentAuthorshipSourceEvidence } from "./snapshotEvidence";
import type { AuthoredContentType, AuthorshipAction, ContentAuthorshipPlanEntry } from "./types";

const SOURCE_PREFIX: Record<AuthoredContentType, string> = {
  ARTICLE: "wordpress-db:post:",
  ROUTE: "wordpress-db:routes:",
  ACTIVITY: "wordpress-db:events:",
};

const LINEAGE_TARGET_TYPE: Record<AuthoredContentType, "ARTICLE" | "ROUTE" | "ACTIVITY"> = {
  ARTICLE: "ARTICLE",
  ROUTE: "ROUTE",
  ACTIVITY: "ACTIVITY",
};

function sourceRecordKeyFor(item: AuthoredContentItem): string | null {
  if (item.contentType === "UNSUPPORTED") return null;
  return `${SOURCE_PREFIX[item.contentType]}${item.postId}`;
}

/**
 * Reconciles each content-author migrated user against the *exact*
 * `MigrationLineage` rows for the User and for every authored Article /
 * Route / Activity post — never by title/slug similarity. `Article` and
 * `Route` authorship is nullable in the schema (unset reads as "not yet
 * linked", not a conflict); `Activity.ownerUserId` is a required column,
 * so a migrated Activity always already has *some* owner and a mismatch
 * is a real conflict, not an absence.
 */
export async function planContentAuthorship(
  evidenceList: readonly ContentAuthorshipSourceEvidence[],
  repository: UserOwnershipReadOnlyRepository,
): Promise<readonly ContentAuthorshipPlanEntry[]> {
  const userSourceKeys = evidenceList.map(evidence => evidence.sourceRecordKey);
  const userLineage = await repository.findLineageTargetIds("USER", userSourceKeys);

  const byType: Record<AuthoredContentType, string[]> = { ARTICLE: [], ROUTE: [], ACTIVITY: [] };
  for (const evidence of evidenceList) {
    for (const item of evidence.authoredItems) {
      const key = sourceRecordKeyFor(item);
      if (key) byType[item.contentType as AuthoredContentType].push(key);
    }
  }

  const [articleLineage, routeLineage, activityLineage] = await Promise.all([
    repository.findLineageTargetIds(LINEAGE_TARGET_TYPE.ARTICLE, byType.ARTICLE),
    repository.findLineageTargetIds(LINEAGE_TARGET_TYPE.ROUTE, byType.ROUTE),
    repository.findLineageTargetIds(LINEAGE_TARGET_TYPE.ACTIVITY, byType.ACTIVITY),
  ]);
  const lineageByType: Record<AuthoredContentType, ReadonlyMap<string, string>> = { ARTICLE: articleLineage, ROUTE: routeLineage, ACTIVITY: activityLineage };

  const matchedArticleIds = [...new Set([...articleLineage.values()])];
  const matchedRouteIds = [...new Set([...routeLineage.values()])];
  const matchedActivityIds = [...new Set([...activityLineage.values()])];
  const [articleAuthors, routeAuthors, activityOwners] = await Promise.all([
    repository.findArticleAuthors(matchedArticleIds),
    repository.findRouteAuthors(matchedRouteIds),
    repository.findActivityOwners(matchedActivityIds),
  ]);
  const currentAuthorByType: Record<AuthoredContentType, ReadonlyMap<string, string | null>> = {
    ARTICLE: articleAuthors,
    ROUTE: routeAuthors,
    ACTIVITY: activityOwners,
  };

  // Detect the same migrated content item claimed by more than one content-author source user.
  const contentTargetClaimants = new Map<string, string[]>();
  for (const evidence of evidenceList) {
    for (const item of evidence.authoredItems) {
      const key = sourceRecordKeyFor(item);
      if (!key) continue;
      const targetId = lineageByType[item.contentType as AuthoredContentType].get(key);
      if (!targetId) continue;
      const compositeKey = `${item.contentType}:${targetId}`;
      const claimants = contentTargetClaimants.get(compositeKey) ?? [];
      claimants.push(evidence.sourceRecordKey);
      contentTargetClaimants.set(compositeKey, claimants);
    }
  }

  const entries: ContentAuthorshipPlanEntry[] = [];
  for (const evidence of evidenceList) {
    const targetUserId = userLineage.get(evidence.sourceRecordKey) ?? null;
    const userLineagePresent = targetUserId !== null;

    const supportedItems = evidence.authoredItems.filter(item => item.contentType !== "UNSUPPORTED");
    const unsupportedCount = evidence.authoredItems.length - supportedItems.length;
    const authoredContentTypes = [...new Set(supportedItems.map(item => item.contentType as AuthoredContentType))].sort();

    const resolved = supportedItems.map(item => {
      const key = sourceRecordKeyFor(item)!;
      const contentType = item.contentType as AuthoredContentType;
      const targetId = lineageByType[contentType].get(key) ?? null;
      const currentAuthor = targetId ? (currentAuthorByType[contentType].get(targetId) ?? null) : null;
      const hasMultipleClaimants = targetId ? (contentTargetClaimants.get(`${contentType}:${targetId}`) ?? []).length > 1 : false;
      return { targetId, currentAuthor, hasMultipleClaimants };
    });
    const matched = resolved.filter(item => item.targetId !== null);

    let action: AuthorshipAction;
    if (!userLineagePresent) {
      action = "MANUAL_REVIEW";
    } else if (supportedItems.length === 0) {
      action = unsupportedCount > 0 ? "UNSUPPORTED_CONTENT_TYPE" : "TARGET_CONTENT_NOT_MIGRATED";
    } else if (matched.length === 0) {
      action = "TARGET_CONTENT_NOT_MIGRATED";
    } else if (matched.some(item => item.hasMultipleClaimants)) {
      action = "MULTIPLE_SOURCE_AUTHORS";
    } else if (matched.some(item => item.currentAuthor !== null && item.currentAuthor !== targetUserId)) {
      action = "CURRENT_AUTHOR_CONFLICT";
    } else if (matched.length < supportedItems.length) {
      action = "MANUAL_REVIEW";
    } else if (matched.every(item => item.currentAuthor === targetUserId)) {
      action = "ALREADY_SATISFIED";
    } else {
      action = "EXACT_AUTHOR_LINK_CANDIDATE";
    }

    const entryCore = {
      sourceRecordKey: evidence.sourceRecordKey,
      userLineagePresent,
      authoredContentTypes,
      authoredContentCount: supportedItems.length,
      authoredContentLineagePresentCount: matched.length,
      action,
    };
    entries.push({ ...entryCore, evidenceHash: canonicalHash(entryCore) });
  }

  return entries.sort((a, b) => (a.sourceRecordKey < b.sourceRecordKey ? -1 : 1));
}
