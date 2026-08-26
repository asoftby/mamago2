/**
 * MediaAsset.title ownership backfill — dry-run / apply.
 * Touches ONLY MediaAsset.title. Never filename/storage/aliases/alt/caption.
 */
import { writeFile } from "node:fs/promises";
import { prismaBase } from "@/lib/prisma";
import {
  countMediaTitleActions,
  decideMediaTitleOwnership,
  type MediaTitleBackfillAction,
  type MediaTitleOwnershipDecision,
} from "@/lib/media/mediaTitleOwnership";
import { auditAllMediaReferences } from "@/server/media/mediaReferenceAudit";

export type MediaTitleBackfillRow = MediaTitleOwnershipDecision & {
  filename: string;
  originalName: string;
  alt: string | null;
  caption: string | null;
  publicUrl: string | null;
  field: string | null;
};

export type MediaTitleBackfillReport = {
  mode: "dry-run" | "apply";
  examined: number;
  byAction: Record<MediaTitleBackfillAction, number>;
  updateCount: number;
  rows: MediaTitleBackfillRow[];
  applied?: number;
  failed?: Array<{ mediaId: string; error: string }>;
};

function entityKey(entityType: string, entityId: string) {
  return `${entityType}:${entityId}`;
}

export async function buildMediaTitleBackfillDryRun(options?: {
  mediaId?: string;
  limit?: number;
}): Promise<MediaTitleBackfillReport> {
  const audit = await auditAllMediaReferences();
  const assets = options?.mediaId
    ? audit.assets.filter((asset) => asset.id === options.mediaId)
    : audit.assets;

  const rows: MediaTitleBackfillRow[] = [];
  for (const asset of assets) {
    const refs = audit.refsByMedia.get(asset.id) ?? [];
    const ownersByKey = new Map<string, { entityType: string; entityId: string; entityTitle: string }>();
    let primaryField: string | null = null;
    for (const ref of [...refs].sort((a, b) => a.order - b.order)) {
      const key = entityKey(ref.entityType, ref.entityId);
      if (!ownersByKey.has(key)) {
        ownersByKey.set(key, {
          entityType: ref.entityType,
          entityId: ref.entityId,
          entityTitle: ref.entityTitle,
        });
      }
      if (!primaryField) primaryField = ref.field;
    }

    const decision = decideMediaTitleOwnership({
      mediaId: asset.id,
      currentTitle: asset.title,
      originalName: asset.originalName,
      filename: asset.filename,
      branding: audit.brandingIds.has(asset.id),
      owners: [...ownersByKey.values()],
    });

    rows.push({
      ...decision,
      filename: asset.filename,
      originalName: asset.originalName,
      alt: asset.alt,
      caption: asset.caption,
      publicUrl: asset.publicUrl,
      field: primaryField,
    });
  }

  const limited = options?.limit && options.limit > 0 ? rows.slice(0, options.limit) : rows;
  const byAction = countMediaTitleActions(limited);
  const updateCount =
    byAction["update-title-article"] +
    byAction["update-title-place"] +
    byAction["update-title-event"] +
    byAction["update-title-route"] +
    byAction["update-title-offer"];

  return {
    mode: "dry-run",
    examined: limited.length,
    byAction,
    updateCount,
    rows: limited,
  };
}

const UPDATE_ACTIONS = new Set<MediaTitleBackfillAction>([
  "update-title-article",
  "update-title-place",
  "update-title-event",
  "update-title-route",
  "update-title-offer",
]);

/**
 * Apply title-only updates. Caller must enforce production guards.
 * Each update verifies filename/publicUrl/originalName/alt/caption unchanged after write.
 */
export async function applyMediaTitleBackfillRows(
  rows: MediaTitleBackfillRow[],
): Promise<MediaTitleBackfillReport> {
  const targets = rows.filter((row) => UPDATE_ACTIONS.has(row.action) && row.proposedTitle);
  const failed: Array<{ mediaId: string; error: string }> = [];
  let applied = 0;

  for (const row of targets) {
    try {
      const before = await prismaBase.mediaAsset.findUniqueOrThrow({
        where: { id: row.mediaId },
        select: {
          id: true,
          title: true,
          filename: true,
          storageKey: true,
          publicUrl: true,
          originalName: true,
          alt: true,
          caption: true,
          contentHash: true,
          checksum: true,
          width: true,
          height: true,
          sizeBytes: true,
        },
      });

      await prismaBase.mediaAsset.update({
        where: { id: row.mediaId },
        data: { title: row.proposedTitle },
      });

      const after = await prismaBase.mediaAsset.findUniqueOrThrow({
        where: { id: row.mediaId },
        select: {
          title: true,
          filename: true,
          storageKey: true,
          publicUrl: true,
          originalName: true,
          alt: true,
          caption: true,
          contentHash: true,
          checksum: true,
          width: true,
          height: true,
          sizeBytes: true,
        },
      });

      if (after.title !== row.proposedTitle) throw new Error("title-not-updated");
      if (after.filename !== before.filename) throw new Error("filename-mutated");
      if (after.storageKey !== before.storageKey) throw new Error("storageKey-mutated");
      if (after.publicUrl !== before.publicUrl) throw new Error("publicUrl-mutated");
      if (after.originalName !== before.originalName) throw new Error("originalName-mutated");
      if (after.alt !== before.alt) throw new Error("alt-mutated");
      if (after.caption !== before.caption) throw new Error("caption-mutated");
      if (after.contentHash !== before.contentHash) throw new Error("contentHash-mutated");
      if (after.checksum !== before.checksum) throw new Error("checksum-mutated");
      if (after.width !== before.width || after.height !== before.height) {
        throw new Error("dimensions-mutated");
      }
      if (after.sizeBytes !== before.sizeBytes) throw new Error("size-mutated");

      applied += 1;
    } catch (error) {
      failed.push({ mediaId: row.mediaId, error: error instanceof Error ? error.message : String(error) });
    }
  }

  const byAction = countMediaTitleActions(rows);
  return {
    mode: "apply",
    examined: rows.length,
    byAction,
    updateCount: targets.length,
    rows,
    applied,
    failed,
  };
}

export async function persistMediaTitleReport(path: string | undefined, report: unknown) {
  if (path) await writeFile(path, JSON.stringify(report, null, 2));
}
