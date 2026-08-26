/**
 * Title ownership policy for MediaAsset.title backfill.
 *
 * Product rule: for single-owner content media,
 *   MediaAsset.title = entity.title
 *
 * Never invents alt/caption. Never renames files.
 */

import type { MediaEntityType } from "@prisma/client";
import {
  isTechnicalMediaTitle,
  isTitleDerivedFromOriginalName,
} from "./isTechnicalMediaTitle";

export type MediaTitleBackfillAction =
  | "update-title-article"
  | "update-title-place"
  | "update-title-event"
  | "update-title-route"
  | "update-title-offer"
  | "already-correct"
  | "skip-shared-title"
  | "skip-manual-title"
  | "skip-user"
  | "skip-branding"
  | "skip-orphan"
  | "skip-unsupported"
  | "skip-error";

export const TITLE_OWNER_ENTITY_TYPES = ["ARTICLE", "PLACE", "EVENT", "ROUTE", "OFFER"] as const;
export type TitleOwnerEntityType = (typeof TITLE_OWNER_ENTITY_TYPES)[number];

export type MediaTitleOwnershipInput = {
  mediaId: string;
  currentTitle: string | null | undefined;
  originalName?: string | null;
  filename?: string | null;
  branding?: boolean;
  /** Distinct owning entities (entityType:entityId). Multiple usages of ONE entity = 1. */
  owners: Array<{
    entityType: MediaEntityType | string;
    entityId: string;
    entityTitle: string | null | undefined;
  }>;
};

export type MediaTitleOwnershipDecision = {
  mediaId: string;
  entityType: string | null;
  entityId: string | null;
  entityTitle: string | null;
  currentTitle: string | null;
  proposedTitle: string | null;
  usageCount: number;
  action: MediaTitleBackfillAction;
  reason: string;
};

function updateActionFor(type: TitleOwnerEntityType): MediaTitleBackfillAction {
  switch (type) {
    case "ARTICLE":
      return "update-title-article";
    case "PLACE":
      return "update-title-place";
    case "EVENT":
      return "update-title-event";
    case "ROUTE":
      return "update-title-route";
    case "OFFER":
      return "update-title-offer";
  }
}

function isTitleOwnerType(value: string): value is TitleOwnerEntityType {
  return (TITLE_OWNER_ENTITY_TYPES as readonly string[]).includes(value);
}

function titlesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = (a ?? "").trim();
  const right = (b ?? "").trim();
  if (!left || !right) return false;
  // Exact product match only — do not fuzzy-normalize (067.jpg ≠ «0,67»).
  return left === right;
}

/**
 * Should we auto-replace current title with entity title?
 * Only when current is clearly technical / derived from original filename.
 */
export function shouldAutoReplaceMediaTitle(input: {
  currentTitle: string | null | undefined;
  originalName?: string | null;
  filename?: string | null;
}): boolean {
  if (isTechnicalMediaTitle(input.currentTitle)) return true;
  if (isTitleDerivedFromOriginalName(input.currentTitle, input.originalName)) return true;
  if (isTitleDerivedFromOriginalName(input.currentTitle, input.filename)) return true;
  return false;
}

export function decideMediaTitleOwnership(
  input: MediaTitleOwnershipInput,
): MediaTitleOwnershipDecision {
  const currentTitle = input.currentTitle?.trim() || null;
  const uniqueOwners = new Map<string, MediaTitleOwnershipInput["owners"][number]>();
  for (const owner of input.owners) {
    uniqueOwners.set(`${owner.entityType}:${owner.entityId}`, owner);
  }
  const owners = [...uniqueOwners.values()];
  const usageCount = owners.length;
  const first = owners[0] ?? null;

  const base = {
    mediaId: input.mediaId,
    entityType: first?.entityType ?? null,
    entityId: first?.entityId ?? null,
    entityTitle: first?.entityTitle?.trim() || null,
    currentTitle,
    proposedTitle: currentTitle,
    usageCount,
  };

  if (input.branding) {
    return { ...base, action: "skip-branding", reason: "branding-direct-fk" };
  }
  if (usageCount === 0) {
    return { ...base, action: "skip-orphan", reason: "no-entity-owner" };
  }
  if (usageCount > 1) {
    return { ...base, action: "skip-shared-title", reason: "asset-used-by-multiple-entities" };
  }

  const owner = first!;
  const entityType = String(owner.entityType);
  const entityTitle = owner.entityTitle?.trim() || null;

  if (entityType === "USER") {
    return { ...base, entityTitle, action: "skip-user", reason: "user-avatar-or-profile" };
  }
  if (!isTitleOwnerType(entityType)) {
    return {
      ...base,
      entityTitle,
      action: "skip-unsupported",
      reason: `unsupported-entity-${entityType.toLowerCase()}`,
    };
  }
  if (!entityTitle) {
    return {
      ...base,
      entityType,
      entityId: owner.entityId,
      entityTitle: null,
      action: "skip-error",
      reason: "entity-title-empty",
    };
  }

  if (titlesMatch(currentTitle, entityTitle)) {
    return {
      ...base,
      entityType,
      entityId: owner.entityId,
      entityTitle,
      proposedTitle: entityTitle,
      action: "already-correct",
      reason: "title-already-equals-entity",
    };
  }

  if (
    !shouldAutoReplaceMediaTitle({
      currentTitle,
      originalName: input.originalName,
      filename: input.filename,
    })
  ) {
    return {
      ...base,
      entityType,
      entityId: owner.entityId,
      entityTitle,
      action: "skip-manual-title",
      reason: "human-authored-title-preserved",
    };
  }

  return {
    ...base,
    entityType,
    entityId: owner.entityId,
    entityTitle,
    proposedTitle: entityTitle,
    action: updateActionFor(entityType),
    reason: "technical-title-replace-with-entity",
  };
}

export function countMediaTitleActions(
  rows: Array<{ action: MediaTitleBackfillAction }>,
): Record<MediaTitleBackfillAction, number> {
  const counts: Record<MediaTitleBackfillAction, number> = {
    "update-title-article": 0,
    "update-title-place": 0,
    "update-title-event": 0,
    "update-title-route": 0,
    "update-title-offer": 0,
    "already-correct": 0,
    "skip-shared-title": 0,
    "skip-manual-title": 0,
    "skip-user": 0,
    "skip-branding": 0,
    "skip-orphan": 0,
    "skip-unsupported": 0,
    "skip-error": 0,
  };
  for (const row of rows) counts[row.action] += 1;
  return counts;
}

/** Admin list primary label: title → entity title → canonical filename. Never originalName. */
export function resolveAdminMediaListTitle(input: {
  title?: string | null;
  entityTitle?: string | null;
  filename: string;
}): string {
  const title = input.title?.trim();
  if (title) return title;
  const entityTitle = input.entityTitle?.trim();
  if (entityTitle) return entityTitle;
  return input.filename;
}

export function mediaEntityTypeBadgeLabel(entityType: string | null | undefined): string | null {
  switch (entityType) {
    case "ARTICLE":
      return "Статья";
    case "PLACE":
      return "Место";
    case "EVENT":
      return "Событие";
    case "ROUTE":
      return "Маршрут";
    case "OFFER":
      return "Предложение";
    case "USER":
      return "Пользователь";
    case "BUSINESS":
      return "Бизнес";
    case "STORY":
      return "Сторис";
    default:
      return null;
  }
}
