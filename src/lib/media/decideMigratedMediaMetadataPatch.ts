import type { MediaEntityType } from "@prisma/client";
import { generateMediaMetadata, type GeneratedMediaMetadata, type MediaMetadataContext } from "./generateMediaMetadata";
import { decodeBasicHtmlEntities } from "./decodeBasicHtmlEntities";
import { isTechnicalMediaTitle } from "./isTechnicalMediaTitle";

export type MediaMetadataFields = {
  title: string | null;
  alt: string | null;
  caption: string | null;
};

export type MetadataBackfillDecision =
  | { action: "SKIP_UNCHANGED"; reason: string; next: MediaMetadataFields }
  | { action: "APPLY"; reason: string; next: MediaMetadataFields; changed: Array<"title" | "alt" | "caption"> };

/**
 * Pure decision for one MediaAsset given current fields + entity-generated
 * metadata. Never invents text without `generated`. Preserves meaningful
 * source titles and any non-empty alt/caption (treated as curated).
 */
export function decideMigratedMediaMetadataPatch(input: {
  current: MediaMetadataFields;
  generated: GeneratedMediaMetadata;
}): MetadataBackfillDecision {
  const decodedTitle = input.current.title ? decodeBasicHtmlEntities(input.current.title).trim() : null;
  const currentAlt = input.current.alt?.trim() || null;
  const currentCaption = input.current.caption?.trim() || null;

  const next: MediaMetadataFields = {
    title: decodedTitle,
    alt: currentAlt,
    caption: currentCaption,
  };
  const changed: Array<"title" | "alt" | "caption"> = [];

  const titleNeedsReplace = isTechnicalMediaTitle(decodedTitle);
  if (titleNeedsReplace && input.generated.title?.trim()) {
    next.title = input.generated.title.trim();
    changed.push("title");
  } else if (decodedTitle && input.current.title && decodedTitle !== input.current.title.trim()) {
    // HTML-entity cleanup only
    next.title = decodedTitle;
    changed.push("title");
  }

  if (!currentAlt && input.generated.alt?.trim()) {
    next.alt = input.generated.alt.trim();
    changed.push("alt");
  }

  if (!currentCaption && input.generated.caption?.trim()) {
    next.caption = input.generated.caption.trim();
    changed.push("caption");
  }

  if (changed.length === 0) {
    return {
      action: "SKIP_UNCHANGED",
      reason: titleNeedsReplace
        ? "Technical title but no generated replacement available; alt/caption already set or unavailable."
        : "Title meaningful (or empty with no generator); alt/caption already set or unavailable.",
      next,
    };
  }

  return {
    action: "APPLY",
    reason: `Update ${changed.join(", ")} from entity context / entity decode.`,
    next,
    changed,
  };
}

export function buildGeneratedMetadataForLink(input: {
  entityType: MediaEntityType;
  entityTitle: string;
  field: string;
  placeAddress?: MediaMetadataContext["placeAddress"];
}): GeneratedMediaMetadata {
  return generateMediaMetadata({
    entityType: input.entityType,
    entityTitle: input.entityTitle,
    field: input.field,
    placeAddress: input.placeAddress,
  });
}

export type DiscoveredMediaLink = {
  mediaId: string;
  entityType: MediaEntityType;
  entityId: string;
  field: string;
  entityTitle: string;
  placeAddress?: MediaMetadataContext["placeAddress"];
};
