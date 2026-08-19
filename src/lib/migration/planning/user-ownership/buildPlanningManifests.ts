import { planBusinessOwnership } from "./businessOwnershipPlanner";
import { canonicalHash } from "./canonicalJson";
import { planContentAuthorship } from "./contentAuthorshipPlanner";
import { planManualBacklog } from "./manualBacklogPlanner";
import type { UserOwnershipReadOnlyRepository } from "./readOnlyRepository";
import { legacyUserIdFromSourceRecordKey, loadBusinessOwnershipEvidence, loadClassification, loadContentAuthorshipEvidence, loadManualEvidence } from "./snapshotEvidence";
import type {
  BusinessOwnershipPlanEntry,
  ContentAuthorshipPlanEntry,
  ManualBacklogEntry,
  ManualRecommendedDisposition,
  OwnershipAction,
  AuthorshipAction,
  PlanningManifests,
  PlanningSummary,
} from "./types";

const EXPECTED_SOURCE_SCOPE = 579;
const EXPECTED_CLEAN_SCOPE = 564;
const EXPECTED_MANUAL_COUNT = 15;
const EXPECTED_BUSINESS_COUNT = 38;
const EXPECTED_AUTHOR_COUNT = 12;

const MANUAL_DISPOSITIONS: readonly ManualRecommendedDisposition[] = [
  "KEEP_EXISTING_TARGET_UNCHANGED",
  "MANUAL_LINK_AFTER_IDENTITY_VERIFICATION",
  "MANUAL_CREATE_PENDING_ACCOUNT",
  "EXCLUDE_FROM_MIGRATION",
  "REQUIRES_FOUNDER_DECISION",
];

const OWNERSHIP_ACTIONS: readonly OwnershipAction[] = [
  "EXACT_LINK_CANDIDATE",
  "ALREADY_SATISFIED",
  "TARGET_ENTITY_NOT_MIGRATED",
  "TARGET_ENTITY_AMBIGUOUS",
  "CURRENT_OWNER_CONFLICT",
  "MULTIPLE_SOURCE_OWNERS",
  "UNSUPPORTED_RELATION",
  "MANUAL_REVIEW",
];

const AUTHORSHIP_ACTIONS: readonly AuthorshipAction[] = [
  "EXACT_AUTHOR_LINK_CANDIDATE",
  "ALREADY_SATISFIED",
  "TARGET_CONTENT_NOT_MIGRATED",
  "TARGET_CONTENT_AMBIGUOUS",
  "CURRENT_AUTHOR_CONFLICT",
  "MULTIPLE_SOURCE_AUTHORS",
  "UNSUPPORTED_CONTENT_TYPE",
  "MANUAL_REVIEW",
];

function count<T>(items: readonly T[], predicate: (item: T) => boolean): number {
  return items.filter(predicate).length;
}

function summarizeManual(entries: readonly ManualBacklogEntry[]): PlanningSummary["manual"] {
  const dispositionCounts = Object.fromEntries(MANUAL_DISPOSITIONS.map(d => [d, count(entries, e => e.recommendedDisposition === d)])) as Record<
    ManualRecommendedDisposition,
    number
  >;
  return { total: entries.length, automaticActions: 0, dispositionCounts };
}

function summarizeBusiness(entries: readonly BusinessOwnershipPlanEntry[]): PlanningSummary["businessOwnership"] {
  return {
    users: entries.length,
    reconciledUserLineages: count(entries, e => e.userLineagePresent),
    exactCandidates: count(entries, e => e.action === "EXACT_LINK_CANDIDATE"),
    alreadySatisfied: count(entries, e => e.action === "ALREADY_SATISFIED"),
    missingTarget: count(entries, e => e.action === "TARGET_ENTITY_NOT_MIGRATED"),
    conflicts: count(entries, e => e.action === "CURRENT_OWNER_CONFLICT" || e.action === "MULTIPLE_SOURCE_OWNERS"),
    ambiguousOrManual: count(entries, e => e.action === "MANUAL_REVIEW" || e.action === "TARGET_ENTITY_AMBIGUOUS"),
    unsupported: count(entries, e => e.action === "UNSUPPORTED_RELATION"),
    ownershipWrites: 0,
    roleChanges: 0,
  };
}

function summarizeAuthorship(entries: readonly ContentAuthorshipPlanEntry[]): PlanningSummary["contentAuthorship"] {
  return {
    users: entries.length,
    reconciledUserLineages: count(entries, e => e.userLineagePresent),
    exactCandidates: count(entries, e => e.action === "EXACT_AUTHOR_LINK_CANDIDATE"),
    alreadySatisfied: count(entries, e => e.action === "ALREADY_SATISFIED"),
    missingTarget: count(entries, e => e.action === "TARGET_CONTENT_NOT_MIGRATED"),
    conflicts: count(entries, e => e.action === "CURRENT_AUTHOR_CONFLICT" || e.action === "MULTIPLE_SOURCE_AUTHORS"),
    ambiguousOrManual: count(entries, e => e.action === "MANUAL_REVIEW" || e.action === "TARGET_CONTENT_AMBIGUOUS"),
    unsupported: count(entries, e => e.action === "UNSUPPORTED_CONTENT_TYPE"),
    authorshipWrites: 0,
  };
}

export async function buildPlanningManifests(snapshotRoot: string, repository: UserOwnershipReadOnlyRepository): Promise<PlanningManifests> {
  const classification = loadClassification(snapshotRoot);

  if (classification.sourceScope !== EXPECTED_SOURCE_SCOPE) throw new Error(`Expected ${EXPECTED_SOURCE_SCOPE} source users, found ${classification.sourceScope}.`);
  if (classification.cleanScope !== EXPECTED_CLEAN_SCOPE) throw new Error(`Expected ${EXPECTED_CLEAN_SCOPE} clean users, found ${classification.cleanScope}.`);
  if (classification.manualPrivileged.length !== EXPECTED_MANUAL_COUNT)
    throw new Error(`Expected ${EXPECTED_MANUAL_COUNT} manual/privileged users, found ${classification.manualPrivileged.length}.`);
  if (classification.businessLinked.length !== EXPECTED_BUSINESS_COUNT)
    throw new Error(`Expected ${EXPECTED_BUSINESS_COUNT} business-linked users, found ${classification.businessLinked.length}.`);
  if (classification.contentAuthor.length !== EXPECTED_AUTHOR_COUNT)
    throw new Error(`Expected ${EXPECTED_AUTHOR_COUNT} content-author users, found ${classification.contentAuthor.length}.`);
  if (classification.cleanScope + classification.manualPrivileged.length !== classification.sourceScope) {
    throw new Error("Clean scope + manual/privileged scope must equal the total source scope.");
  }

  const manualEvidence = loadManualEvidence(snapshotRoot, classification.manualPrivileged);
  const manualBacklog = planManualBacklog(manualEvidence);

  const businessEvidence = loadBusinessOwnershipEvidence(snapshotRoot, classification.businessLinked);
  const businessOwnershipPlan = await planBusinessOwnership(businessEvidence, repository);

  const contentAuthorLegacyIds = classification.contentAuthor.map(legacyUserIdFromSourceRecordKey);
  const contentEvidence = loadContentAuthorshipEvidence(snapshotRoot, contentAuthorLegacyIds);
  const contentAuthorshipPlan = await planContentAuthorship(contentEvidence, repository);

  const summary: PlanningSummary = {
    manual: summarizeManual(manualBacklog),
    businessOwnership: summarizeBusiness(businessOwnershipPlan),
    contentAuthorship: summarizeAuthorship(contentAuthorshipPlan),
  };

  return {
    manualBacklog,
    businessOwnershipPlan,
    contentAuthorshipPlan,
    summary,
    hashes: {
      manualBacklog: canonicalHash(manualBacklog),
      businessOwnershipPlan: canonicalHash(businessOwnershipPlan),
      contentAuthorshipPlan: canonicalHash(contentAuthorshipPlan),
    },
  };
}

export { OWNERSHIP_ACTIONS, AUTHORSHIP_ACTIONS, MANUAL_DISPOSITIONS };
