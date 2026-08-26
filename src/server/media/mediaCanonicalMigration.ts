import { access, copyFile, readdir, stat, unlink } from "node:fs/promises";
import { basename, dirname, extname } from "node:path";
import { Prisma, type MediaEntityType } from "@prisma/client";
import { prismaBase } from "@/lib/prisma";
import { buildMediaFilePublicUrl } from "@/lib/media/mediaUrlBuilder";
import { resolveStoredMediaPath } from "@/server/media/media-storage";
import { normalizeMediaAliasPath } from "@/server/media/mediaUrlAlias";
import type { CanonicalAuditAction } from "@/server/media/mediaCanonicalPolicy";
import { buildCanonicalNamingDryRun } from "@/server/media/mediaCanonicalPolicy";

export type CanonicalPolicyRow = Awaited<ReturnType<typeof buildCanonicalNamingDryRun>>["rows"][number];

export type CanonicalApplyResult = {
  mediaId: string;
  entityType: MediaEntityType | null;
  entityId: string | null;
  oldFilename: string;
  newFilename: string;
  oldUrl: string;
  newUrl: string;
  action: "renamed" | "error";
  reason: string;
  variants: number;
  cleanupWarnings?: string[];
};

export type CanonicalApplyReport = {
  mode: "apply";
  attempted: number;
  renamed: number;
  failed: number;
  collisions: number;
  missingSource: number;
  verificationFailures: number;
  aliasesCreated: number;
  aliasesExisting: number;
  results: CanonicalApplyResult[];
};

type FilePlan = {
  row: CanonicalPolicyRow;
  oldUrl: string;
  oldPath: string;
  newPath: string;
  legacyPath: string;
  variants: Array<{ oldPath: string; newPath: string }>;
};

export function replaceJsonExact(value: unknown, oldUrl: string, newUrl: string): unknown {
  if (typeof value === "string") return value === oldUrl ? newUrl : value;
  if (Array.isArray(value)) return value.map((item) => replaceJsonExact(item, oldUrl, newUrl));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceJsonExact(item, oldUrl, newUrl)]));
  }
  return value;
}

async function existingVariants(masterPath: string) {
  const directory = dirname(masterPath);
  const stem = basename(masterPath, extname(masterPath));
  return (await readdir(directory))
    .filter((name) => name.startsWith(`${stem}-`) && extname(name).toLowerCase() === ".webp")
    .map((name) => ({ oldPath: `${directory}/${name}`, suffix: basename(name, ".webp").slice(stem.length + 1) }));
}

async function assertPathAbsent(path: string, label: string): Promise<void> {
  try {
    await access(path);
  } catch {
    return;
  }
  throw new Error(`${label}-target-exists:${path}`);
}

async function buildFilePlan(row: CanonicalPolicyRow): Promise<FilePlan> {
  if (!row.currentUrl) throw new Error("missing-current-url");
  const oldPath = resolveStoredMediaPath(row.currentUrl);
  const newUrl = buildMediaFilePublicUrl(row.proposedFilename);
  const newPath = resolveStoredMediaPath(newUrl);
  const legacyPath = normalizeMediaAliasPath(row.currentUrl);
  if (!oldPath || !newPath || !legacyPath) throw new Error("unmanaged-or-invalid-path");
  const source = await stat(oldPath).catch(() => null);
  if (!source) throw new Error("missing-source");
  if (source.size <= 0) throw new Error("source-verification-failed");
  if (oldPath !== newPath) await assertPathAbsent(newPath, "master");
  const variants = (await existingVariants(oldPath)).map((variant) => ({
    oldPath: variant.oldPath,
    newPath: `${dirname(newPath)}/${basename(newPath, ".webp")}-${variant.suffix}.webp`,
  }));
  for (const variant of variants) {
    if (variant.oldPath !== variant.newPath) await assertPathAbsent(variant.newPath, "variant");
  }
  return { row, oldUrl: row.currentUrl, oldPath, newPath, legacyPath, variants };
}

async function updateOwnerJsonReferences(
  tx: Prisma.TransactionClient,
  row: CanonicalPolicyRow,
  oldUrl: string,
  newUrl: string,
) {
  if (row.entityType === "ARTICLE" && row.entityId) {
    const article = await tx.article.findUnique({ where: { id: row.entityId }, select: { contentJson: true } });
    if (article?.contentJson) {
      const next = replaceJsonExact(article.contentJson, oldUrl, newUrl);
      if (JSON.stringify(next) !== JSON.stringify(article.contentJson)) {
        await tx.article.update({ where: { id: row.entityId }, data: { contentJson: next as Prisma.InputJsonValue } });
      }
    }
  }
  if (row.entityType === "OFFER" && row.entityId) {
    const offer = await tx.offer.findUnique({ where: { id: row.entityId }, select: { galleryImages: true } });
    if (offer?.galleryImages) {
      const next = replaceJsonExact(offer.galleryImages, oldUrl, newUrl);
      if (JSON.stringify(next) !== JSON.stringify(offer.galleryImages)) {
        await tx.offer.update({ where: { id: row.entityId }, data: { galleryImages: next as Prisma.InputJsonValue } });
      }
    }
  }
}

async function rewriteKnownReferences(
  tx: Prisma.TransactionClient,
  row: CanonicalPolicyRow,
  oldUrl: string,
  newUrl: string,
) {
  await tx.article.updateMany({ where: { heroImage: oldUrl }, data: { heroImage: newUrl } });
  await tx.article.updateMany({ where: { seoOgImage: oldUrl }, data: { seoOgImage: newUrl } });
  await tx.activity.updateMany({ where: { coverImageUrl: oldUrl }, data: { coverImageUrl: newUrl } });
  await tx.activity.updateMany({ where: { seoOgImage: oldUrl }, data: { seoOgImage: newUrl } });
  await tx.activityImage.updateMany({ where: { url: oldUrl }, data: { url: newUrl } });
  await tx.place.updateMany({ where: { seoOgImage: oldUrl }, data: { seoOgImage: newUrl } });
  await tx.placeImage.updateMany({ where: { url: oldUrl }, data: { url: newUrl } });
  await tx.offer.updateMany({ where: { coverImage: oldUrl }, data: { coverImage: newUrl } });
  await tx.offer.updateMany({ where: { seoOgImage: oldUrl }, data: { seoOgImage: newUrl } });
  await tx.route.updateMany({ where: { coverImageUrl: oldUrl }, data: { coverImageUrl: newUrl } });
  await tx.route.updateMany({ where: { seoOgImage: oldUrl }, data: { seoOgImage: newUrl } });
  await tx.routeStop.updateMany({ where: { photoUrl: oldUrl }, data: { photoUrl: newUrl } });
  await tx.routeStopImage.updateMany({ where: { url: oldUrl }, data: { url: newUrl } });
  await updateOwnerJsonReferences(tx, row, oldUrl, newUrl);
  // Deliberately last and on prismaBase: no fire-and-forget search extension
  // may race this deterministic denormalized-reference update.
  await tx.searchDocument.updateMany({ where: { imageUrl: oldUrl }, data: { imageUrl: newUrl } });
}

function countError(report: CanonicalApplyReport, reason: string) {
  report.failed += 1;
  if (reason.includes("target-exists") || reason.includes("alias-conflict")) report.collisions += 1;
  if (reason.includes("missing-source")) report.missingSource += 1;
  if (reason.includes("verification-failed")) report.verificationFailures += 1;
}

export async function applyCanonicalNamingRows(rows: CanonicalPolicyRow[]): Promise<CanonicalApplyReport> {
  const actionable = rows.filter((row) => row.action.startsWith("rename-"));
  const report: CanonicalApplyReport = {
    mode: "apply", attempted: actionable.length, renamed: 0, failed: 0,
    collisions: 0, missingSource: 0, verificationFailures: 0,
    aliasesCreated: 0, aliasesExisting: 0, results: [],
  };
  const targets = new Set<string>();
  const plans: FilePlan[] = [];
  for (const row of actionable) {
    try {
      if (targets.has(row.proposedFilename)) throw new Error(`duplicate-canonical-target:${row.proposedFilename}`);
      targets.add(row.proposedFilename);
      plans.push(await buildFilePlan(row));
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      countError(report, reason);
      report.results.push({
        mediaId: row.mediaId, entityType: row.entityType, entityId: row.entityId,
        oldFilename: row.currentFilename, newFilename: row.proposedFilename,
        oldUrl: row.currentUrl ?? "", newUrl: buildMediaFilePublicUrl(row.proposedFilename),
        action: "error", reason, variants: 0,
      });
      throw Object.assign(new Error(`canonical-preflight-aborted:${reason}`), { report });
    }
  }

  for (const plan of plans) {
    const row = plan.row;
    const newUrl = buildMediaFilePublicUrl(row.proposedFilename);
    const created: string[] = [];
    try {
      const alias = await prismaBase.mediaUrlAlias.findUnique({ where: { legacyPath: plan.legacyPath } });
      if (alias && alias.mediaId !== row.mediaId) throw new Error(`alias-conflict:${plan.legacyPath}`);
      if (plan.oldPath !== plan.newPath) {
        await copyFile(plan.oldPath, plan.newPath);
        created.push(plan.newPath);
        if ((await stat(plan.newPath)).size <= 0) throw new Error("master-verification-failed");
      }
      for (const variant of plan.variants) {
        if (variant.oldPath === variant.newPath) continue;
        await copyFile(variant.oldPath, variant.newPath);
        created.push(variant.newPath);
        if ((await stat(variant.newPath)).size <= 0) throw new Error("variant-verification-failed");
      }
      await prismaBase.$transaction(async (tx) => {
        const current = await tx.mediaAsset.findUniqueOrThrow({ where: { id: row.mediaId } });
        if (current.filename !== row.currentFilename || current.publicUrl !== row.currentUrl) {
          throw new Error("asset-changed-since-dry-run");
        }
        await rewriteKnownReferences(tx, row, plan.oldUrl, newUrl);
        if (!alias) {
          await tx.mediaUrlAlias.create({
            data: { mediaId: row.mediaId, legacyPath: plan.legacyPath, reason: "canonical-rename", source: "canonical-cli" },
          });
        }
        await tx.mediaAsset.update({
          where: { id: row.mediaId },
          data: { filename: row.proposedFilename, storageKey: newUrl, publicUrl: newUrl },
        });
      });
      const cleanup = await Promise.allSettled([
        ...(plan.oldPath === plan.newPath ? [] : [unlink(plan.oldPath)]),
        ...plan.variants.filter((item) => item.oldPath !== item.newPath).map((item) => unlink(item.oldPath)),
      ]);
      const cleanupWarnings = cleanup.flatMap((item) => item.status === "rejected" ? [String(item.reason)] : []);
      report.renamed += 1;
      if (alias) report.aliasesExisting += 1; else report.aliasesCreated += 1;
      report.results.push({
        mediaId: row.mediaId, entityType: row.entityType, entityId: row.entityId,
        oldFilename: row.currentFilename, newFilename: row.proposedFilename,
        oldUrl: plan.oldUrl, newUrl, action: "renamed", reason: "canonicalized-with-alias",
        variants: plan.variants.length, ...(cleanupWarnings.length ? { cleanupWarnings } : {}),
      });
    } catch (error) {
      await Promise.allSettled(created.map((path) => unlink(path)));
      const reason = error instanceof Error ? error.message : String(error);
      countError(report, reason);
      report.results.push({
        mediaId: row.mediaId, entityType: row.entityType, entityId: row.entityId,
        oldFilename: row.currentFilename, newFilename: row.proposedFilename,
        oldUrl: plan.oldUrl, newUrl, action: "error", reason, variants: plan.variants.length,
      });
      throw Object.assign(new Error(`canonical-apply-aborted:${reason}`), { report });
    }
  }
  return report;
}

export function filterCanonicalRows(rows: CanonicalPolicyRow[], input: {
  mediaId?: string;
  entityType?: MediaEntityType;
  entityId?: string;
  limit?: number;
}) {
  let result = rows;
  if (input.mediaId) result = result.filter((row) => row.mediaId === input.mediaId);
  if (input.entityType) result = result.filter((row) => row.entityType === input.entityType);
  if (input.entityId) result = result.filter((row) => row.entityId === input.entityId);
  if (input.limit) result = result.slice(0, input.limit);
  return result;
}

export function countCanonicalActions(rows: CanonicalPolicyRow[]) {
  const actions = new Set<CanonicalAuditAction>(rows.map((row) => row.action));
  return Object.fromEntries([...actions].sort().map((action) => [action, rows.filter((row) => row.action === action).length]));
}
