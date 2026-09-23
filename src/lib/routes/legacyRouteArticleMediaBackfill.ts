import {
  ArticleContentPayloadSchema,
  type ArticleBlockMvp,
  type ArticleContentPayload,
} from "@/lib/publications/articleMvp";

export type LegacyRouteArticleStopMedia = {
  order: number;
  mediaIds: readonly string[];
};

export type LegacyRouteArticleMediaBackfillResult =
  | {
      ok: true;
      changed: boolean;
      content: ArticleContentPayload;
      desiredMediaCount: number;
      existingLegacyMediaCount: number;
      galleryCount: number;
      insertedBlockCount: number;
      replacedBlockCount: number;
    }
  | {
      ok: false;
      errors: string[];
    };

function sourceExternalId(sourceRecordKey: string): string {
  return sourceRecordKey.split(":").at(-1) ?? "unknown";
}

export function legacyRouteArticleBlockId(
  sourceRecordKey: string,
  order: number,
  kind: "heading" | "text" | "image",
): string {
  return `legacy-route-${sourceExternalId(sourceRecordKey)}-stop-${order}-${kind}`;
}

function mediaIdsForBlock(block: ArticleBlockMvp): string[] | null {
  if (block.type === "image") return [block.mediaId];
  if (block.type === "gallery") return [...block.mediaIds];
  return null;
}

function uniquePreserveOrder(values: readonly string[]): string[] {
  return values.filter((value, index, all) => value.trim() && all.indexOf(value) === index);
}

/**
 * Patch only the deterministic legacy media slot for each migrated RouteStop.
 *
 * Non-media blocks are never rewritten. If an editor has inserted a custom
 * image/gallery in a stop segment and the deterministic legacy slot is gone,
 * the operation refuses instead of guessing where to merge media.
 */
export function planLegacyRouteArticleMediaBackfill(input: {
  sourceRecordKey: string;
  currentContent: unknown;
  stops: readonly LegacyRouteArticleStopMedia[];
}): LegacyRouteArticleMediaBackfillResult {
  const parsed = ArticleContentPayloadSchema.safeParse(input.currentContent);
  if (!parsed.success) {
    return { ok: false, errors: ["ARTICLE_CONTENT_SCHEMA_INVALID"] };
  }

  const blocks = [...parsed.data.blocks];
  const errors: string[] = [];
  const replacements = new Map<number, ArticleBlockMvp>();
  const insertions: Array<{ index: number; block: ArticleBlockMvp }> = [];

  let desiredMediaCount = 0;
  let existingLegacyMediaCount = 0;
  let galleryCount = 0;
  let replacedBlockCount = 0;

  const sortedStops = [...input.stops].sort((a, b) => a.order - b.order);

  for (const stop of sortedStops) {
    const headingId = legacyRouteArticleBlockId(input.sourceRecordKey, stop.order, "heading");
    const textId = legacyRouteArticleBlockId(input.sourceRecordKey, stop.order, "text");
    const mediaBlockId = legacyRouteArticleBlockId(input.sourceRecordKey, stop.order, "image");

    const headingIndexes = blocks.flatMap((block, index) => (block.id === headingId ? [index] : []));
    const textIndexes = blocks.flatMap((block, index) => (block.id === textId ? [index] : []));
    const mediaIndexes = blocks.flatMap((block, index) => (block.id === mediaBlockId ? [index] : []));

    if (headingIndexes.length !== 1) {
      errors.push(`STOP_${stop.order}_HEADING_COUNT:${headingIndexes.length}/1`);
      continue;
    }
    if (textIndexes.length !== 1) {
      errors.push(`STOP_${stop.order}_TEXT_COUNT:${textIndexes.length}/1`);
      continue;
    }
    if (mediaIndexes.length > 1) {
      errors.push(`STOP_${stop.order}_LEGACY_MEDIA_BLOCK_COUNT:${mediaIndexes.length}/<=1`);
      continue;
    }

    const headingIndex = headingIndexes[0];
    const textIndex = textIndexes[0];
    if (textIndex <= headingIndex) {
      errors.push(`STOP_${stop.order}_BLOCK_ORDER_INVALID`);
      continue;
    }

    const nextHeadingId = legacyRouteArticleBlockId(input.sourceRecordKey, stop.order + 1, "heading");
    const nextHeadingIndex = blocks.findIndex((block, index) => index > textIndex && block.id === nextHeadingId);
    const segmentEnd = nextHeadingIndex === -1 ? blocks.length : nextHeadingIndex;

    const desiredIds = uniquePreserveOrder(stop.mediaIds);
    desiredMediaCount += desiredIds.length;

    const legacyMediaIndex = mediaIndexes[0] ?? -1;
    const legacyMediaBlock = legacyMediaIndex >= 0 ? blocks[legacyMediaIndex] : null;
    if (
      legacyMediaIndex >= 0 &&
      (legacyMediaIndex <= textIndex || legacyMediaIndex >= segmentEnd)
    ) {
      errors.push(`STOP_${stop.order}_LEGACY_MEDIA_OUTSIDE_STOP_SEGMENT`);
      continue;
    }
    const existingIds = legacyMediaBlock ? mediaIdsForBlock(legacyMediaBlock) : null;

    if (legacyMediaBlock && existingIds === null) {
      errors.push(`STOP_${stop.order}_LEGACY_MEDIA_ID_USED_BY_${legacyMediaBlock.type}`);
      continue;
    }

    if (existingIds) {
      existingLegacyMediaCount += existingIds.length;
      if (desiredIds.length === 0) {
        errors.push(`STOP_${stop.order}_SOURCE_MEDIA_EMPTY_BUT_ARTICLE_HAS_LEGACY_MEDIA`);
        continue;
      }
      if (existingIds[0] !== desiredIds[0]) {
        errors.push(
          `STOP_${stop.order}_FIRST_MEDIA_MISMATCH:article=${existingIds[0]}:source=${desiredIds[0]}`,
        );
        continue;
      }
    }

    if (desiredIds.length === 0) continue;

    if (!legacyMediaBlock) {
      const customMedia = blocks
        .slice(textIndex + 1, segmentEnd)
        .filter((block) => block.type === "image" || block.type === "gallery");
      if (customMedia.length > 0) {
        errors.push(`STOP_${stop.order}_CUSTOM_MEDIA_PRESENT_WITHOUT_LEGACY_SLOT`);
        continue;
      }
    }

    const desiredBlock: ArticleBlockMvp =
      desiredIds.length === 1
        ? {
            id: mediaBlockId,
            type: "image",
            mediaId: desiredIds[0],
            alt:
              legacyMediaBlock?.type === "image"
                ? legacyMediaBlock.alt
                : blocks[headingIndex].type === "heading"
                  ? blocks[headingIndex].text
                  : undefined,
            ...(legacyMediaBlock?.type === "image" && legacyMediaBlock.caption
              ? { caption: legacyMediaBlock.caption }
              : {}),
          }
        : {
            id: mediaBlockId,
            type: "gallery",
            mediaIds: desiredIds,
            presentation:
              legacyMediaBlock?.type === "gallery"
                ? legacyMediaBlock.presentation ?? "carousel"
                : "carousel",
            ...(legacyMediaBlock &&
            (legacyMediaBlock.type === "image" || legacyMediaBlock.type === "gallery") &&
            legacyMediaBlock.caption
              ? { caption: legacyMediaBlock.caption }
              : {}),
          };

    if (desiredBlock.type === "gallery") galleryCount += 1;

    if (legacyMediaIndex >= 0) {
      if (JSON.stringify(blocks[legacyMediaIndex]) !== JSON.stringify(desiredBlock)) {
        replacements.set(legacyMediaIndex, desiredBlock);
        replacedBlockCount += 1;
      }
    } else {
      insertions.push({ index: textIndex + 1, block: desiredBlock });
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  for (const [index, block] of replacements) blocks[index] = block;
  for (const insertion of [...insertions].sort((a, b) => b.index - a.index)) {
    blocks.splice(insertion.index, 0, insertion.block);
  }

  const content = ArticleContentPayloadSchema.parse({ version: 1, blocks });
  const changed = JSON.stringify(content) !== JSON.stringify(parsed.data);

  return {
    ok: true,
    changed,
    content,
    desiredMediaCount,
    existingLegacyMediaCount,
    galleryCount,
    insertedBlockCount: insertions.length,
    replacedBlockCount,
  };
}
