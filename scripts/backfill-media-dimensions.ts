/**
 * Idempotent backfill of MediaAsset.width/height for images stored locally.
 *
 * - Selects only IMAGE assets with width or height NULL (re-runs skip filled rows).
 * - Reads only the file header via sharp `metadata()` (no decode, no download).
 * - Remote-only assets (no local file) are skipped and logged, never fetched.
 * - Keyset batches by id; per-row errors are logged and do not stop the run.
 *
 * Usage:
 *   pnpm media:backfill-dimensions --dry-run [--limit 100] [--batch 200]
 *   pnpm media:backfill-dimensions --confirm-writes [--limit 100] [--batch 200]
 *
 * Env: DATABASE_URL, MEDIA_STORAGE_ROOT (same as the app runtime).
 */
import { existsSync } from "node:fs";
import { MediaAssetKind, PrismaClient } from "@prisma/client";
import { readImageDimensions } from "@/server/media/readImageDimensions";
import { resolveLegacyPublicUploadPath, resolveStoredMediaPath } from "@/server/media/media-storage";

export type BackfillArgs = { dryRun: boolean; limit: number | null; batch: number };

export function parseBackfillArgs(argv: string[]): BackfillArgs {
  const dryRun = argv.includes("--dry-run");
  const confirmWrites = argv.includes("--confirm-writes");
  if (dryRun === confirmWrites) throw new Error("Pass exactly one of --dry-run / --confirm-writes.");
  const num = (flag: string): number | null => {
    const idx = argv.indexOf(flag);
    if (idx === -1) return null;
    const value = Number(argv[idx + 1]);
    if (!Number.isInteger(value) || value <= 0) throw new Error(`${flag} expects a positive integer`);
    return value;
  };
  return { dryRun, limit: num("--limit"), batch: num("--batch") ?? 200 };
}

export function resolveLocalMediaFile(asset: { storageKey: string; publicUrl: string | null }): string | null {
  for (const candidate of [asset.storageKey, asset.publicUrl]) {
    const abs = resolveStoredMediaPath(candidate) ?? resolveLegacyPublicUploadPath(candidate);
    if (abs && existsSync(abs)) return abs;
  }
  return null;
}

async function main() {
  const args = parseBackfillArgs(process.argv.slice(2));
  const prisma = new PrismaClient();
  const stats = { scanned: 0, updated: 0, wouldUpdate: 0, noLocalFile: 0, unreadable: 0, errors: 0 };
  let cursor: string | undefined;

  try {
    console.log(`[media-dimensions] mode=${args.dryRun ? "dry-run" : "WRITE"} batch=${args.batch} limit=${args.limit ?? "none"}`);
    for (;;) {
      const remaining = args.limit == null ? args.batch : Math.min(args.batch, args.limit - stats.scanned);
      if (remaining <= 0) break;

      const rows = await prisma.mediaAsset.findMany({
        where: { kind: MediaAssetKind.IMAGE, OR: [{ width: null }, { height: null }] },
        select: { id: true, storageKey: true, publicUrl: true },
        orderBy: { id: "asc" },
        take: remaining,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (rows.length === 0) break;
      cursor = rows[rows.length - 1]!.id;

      for (const row of rows) {
        stats.scanned++;
        try {
          const file = resolveLocalMediaFile(row);
          if (!file) {
            stats.noLocalFile++;
            console.warn(`[media-dimensions] skip ${row.id}: no local file for ${row.storageKey}`);
            continue;
          }
          const dims = await readImageDimensions(file);
          if (!dims) {
            stats.unreadable++;
            console.warn(`[media-dimensions] skip ${row.id}: unreadable image header (${file})`);
            continue;
          }
          if (args.dryRun) {
            stats.wouldUpdate++;
            continue;
          }
          // Guard keeps the write idempotent even if another process filled it meanwhile.
          const res = await prisma.mediaAsset.updateMany({
            where: { id: row.id, OR: [{ width: null }, { height: null }] },
            data: { width: dims.width, height: dims.height },
          });
          stats.updated += res.count;
        } catch (error) {
          stats.errors++;
          console.error(`[media-dimensions] error ${row.id}:`, error instanceof Error ? error.message : error);
        }
      }
      console.log(`[media-dimensions] progress ${JSON.stringify(stats)}`);
    }
    console.log(`[media-dimensions] done ${JSON.stringify(stats)}`);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.endsWith("backfill-media-dimensions.ts")) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
