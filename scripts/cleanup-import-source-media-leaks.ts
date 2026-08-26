import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, rename } from "node:fs/promises";
import { basename, dirname, extname, join, relative, sep } from "node:path";
import { PrismaClient } from "@prisma/client";

import {
  buildMediaFilePublicUrl,
  extractMediaRelativePathFromUrl,
} from "@/lib/media/mediaUrlBuilder";
import {
  MEDIA_UPLOADS_DIR,
  resolveMediaStorageAbsolutePath,
} from "@/server/media/media-storage";

type Mode = "dry-run" | "write";

type MediaRow = {
  id: string;
  filename: string;
  originalName: string;
  storageKey: string;
  publicUrl: string | null;
  title: string | null;
  alt: string | null;
  caption: string | null;
};

function parseMode(argv: string[]): Mode {
  const dryRun = argv.includes("--dry-run");
  const confirmWrites = argv.includes("--confirm-writes");
  if (dryRun === confirmWrites) {
    throw new Error("Pass exactly one of --dry-run or --confirm-writes");
  }
  return dryRun ? "dry-run" : "write";
}

function addToken(target: Set<string>, raw: string | null | undefined): void {
  const value = raw?.trim().toLowerCase();
  if (!value) return;
  if (value.length >= 4) target.add(value);

  const dashed = value.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const compact = value.replace(/[^a-z0-9]+/g, "");
  if (dashed.length >= 4) target.add(dashed);
  if (compact.length >= 4) target.add(compact);
}

function sourceTokens(
  sources: Array<{ slug: string; parserKey: string | null; baseUrl: string | null }>,
): string[] {
  const tokens = new Set<string>();
  for (const source of sources) {
    addToken(tokens, source.slug);
    addToken(tokens, source.parserKey);
    if (source.baseUrl) {
      try {
        const host = new URL(source.baseUrl).hostname.replace(/^www\./i, "");
        addToken(tokens, host);
      } catch {
        // Invalid/legacy baseUrl: slug/parserKey still provide coverage.
      }
    }
  }
  return [...tokens].sort((a, b) => b.length - a.length);
}

function leaks(value: string | null | undefined, tokens: string[]): boolean {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return tokens.some((token) => normalized.includes(token));
}

function technicalTitleLeaks(value: string | null, tokens: string[]): boolean {
  if (!value || !leaks(value, tokens)) return false;
  return /^\s*(?:import|imported)\b[\s:_-]*/i.test(value);
}

function stableNeutralFilename(seed: string, extension: string): string {
  const digest = createHash("sha256").update(seed).digest("hex").slice(0, 18);
  return `media-${digest}${extension || ".webp"}`;
}

function relativeFromMedia(media: MediaRow): string | null {
  return (
    extractMediaRelativePathFromUrl(media.publicUrl) ??
    extractMediaRelativePathFromUrl(media.storageKey)
  );
}

function rewriteUrlKeepingOrigin(value: string, newRelativePath: string): string {
  const nextPath = buildMediaFilePublicUrl(newRelativePath);
  try {
    const parsed = new URL(value);
    parsed.pathname = nextPath;
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return nextPath;
  }
}

async function linkedUrlUpdates(
  prisma: PrismaClient,
  oldRelativePath: string,
  newRelativePath: string,
): Promise<{
  activities: Array<{ id: string; oldUrl: string; newUrl: string }>;
  places: Array<{ id: string; oldUrl: string; newUrl: string }>;
}> {
  const oldFilename = basename(oldRelativePath);
  const [activityRows, placeRows] = await Promise.all([
    prisma.activityImage.findMany({
      where: { url: { contains: oldFilename } },
      select: { id: true, url: true },
    }),
    prisma.placeImage.findMany({
      where: { url: { contains: oldFilename } },
      select: { id: true, url: true },
    }),
  ]);

  const exact = (url: string) => extractMediaRelativePathFromUrl(url) === oldRelativePath;
  return {
    activities: activityRows
      .filter((row) => exact(row.url))
      .map((row) => ({
        id: row.id,
        oldUrl: row.url,
        newUrl: rewriteUrlKeepingOrigin(row.url, newRelativePath),
      })),
    places: placeRows
      .filter((row) => exact(row.url))
      .map((row) => ({
        id: row.id,
        oldUrl: row.url,
        newUrl: rewriteUrlKeepingOrigin(row.url, newRelativePath),
      })),
  };
}

async function walkFiles(root: string): Promise<string[]> {
  if (!existsSync(root)) return [];
  const out: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
      } else if (entry.isFile()) {
        out.push(relative(root, absolute).split(sep).join("/"));
      }
    }
  }

  await walk(root);
  return out;
}

async function main(): Promise<void> {
  const mode = parseMode(process.argv.slice(2));
  const prisma = new PrismaClient();

  try {
    const sources = await prisma.importSource.findMany({
      select: { slug: true, parserKey: true, baseUrl: true },
    });
    const tokens = sourceTokens(sources);
    if (tokens.length === 0) {
      throw new Error("No import-source tokens discovered; refusing to run");
    }

    const allMedia = (await prisma.mediaAsset.findMany({
      select: {
        id: true,
        filename: true,
        originalName: true,
        storageKey: true,
        publicUrl: true,
        title: true,
        alt: true,
        caption: true,
      },
    })) as MediaRow[];

    const candidates = allMedia.filter((media) => {
      const pathLeak = [
        media.filename,
        media.originalName,
        media.storageKey,
        media.publicUrl,
      ].some((value) => leaks(value, tokens));
      const metadataLeak =
        technicalTitleLeaks(media.title, tokens) ||
        (pathLeak && (leaks(media.alt, tokens) || leaks(media.caption, tokens)));
      return pathLeak || metadataLeak;
    });

    console.log(
      JSON.stringify(
        {
          mode,
          importSources: sources.length,
          sourceTokens: tokens,
          mediaAssetsScanned: allMedia.length,
          mediaAssetsMatched: candidates.length,
        },
        null,
        2,
      ),
    );

    let renamedAssets = 0;
    let metadataOnlyAssets = 0;
    let activityUrlsUpdated = 0;
    let placeUrlsUpdated = 0;
    let blockedMissingFiles = 0;

    for (const media of candidates) {
      const pathLeak = [
        media.filename,
        media.originalName,
        media.storageKey,
        media.publicUrl,
      ].some((value) => leaks(value, tokens));
      const oldRelativePath = relativeFromMedia(media);

      if (pathLeak && !oldRelativePath) {
        blockedMissingFiles++;
        console.error(`BLOCKED ${media.id}: cannot resolve stored media path`);
        continue;
      }

      const oldRelative = oldRelativePath ?? "";
      const extension = extname(oldRelative || media.filename).toLowerCase() || ".webp";
      const newFilename = stableNeutralFilename(`${media.id}:${oldRelative || media.filename}`, extension);
      const newRelative = oldRelative
        ? `${dirname(oldRelative) === "." ? "" : `${dirname(oldRelative)}/`}${newFilename}`
        : "";
      const newPublicUrl = newRelative ? buildMediaFilePublicUrl(newRelative) : media.publicUrl;
      const nextOriginalName = leaks(media.originalName, tokens)
        ? `media${extension}`
        : media.originalName;
      const nextTitle = technicalTitleLeaks(media.title, tokens) ? null : media.title;
      const nextAlt = pathLeak && leaks(media.alt, tokens) ? null : media.alt;
      const nextCaption = pathLeak && leaks(media.caption, tokens) ? null : media.caption;

      const linked = oldRelative
        ? await linkedUrlUpdates(prisma, oldRelative, newRelative)
        : { activities: [], places: [] };

      console.log(
        `${mode === "dry-run" ? "DRY" : "WRITE"} ${media.id}: ${media.filename}` +
          (oldRelative ? ` -> ${newFilename}` : " (metadata only)") +
          `; activityUrls=${linked.activities.length}; placeUrls=${linked.places.length}`,
      );

      if (mode === "dry-run") continue;

      if (oldRelative) {
        const oldAbsolute = resolveMediaStorageAbsolutePath(oldRelative);
        const newAbsolute = resolveMediaStorageAbsolutePath(newRelative);
        if (!oldAbsolute || !newAbsolute || !existsSync(oldAbsolute)) {
          blockedMissingFiles++;
          console.error(`BLOCKED ${media.id}: source file not found on disk (${oldRelative})`);
          continue;
        }
        if (existsSync(newAbsolute)) {
          throw new Error(`Refusing to overwrite existing file: ${newRelative}`);
        }

        await mkdir(dirname(newAbsolute), { recursive: true });
        await rename(oldAbsolute, newAbsolute);

        try {
          await prisma.$transaction(async (tx) => {
            await tx.mediaAsset.update({
              where: { id: media.id },
              data: {
                filename: newFilename,
                originalName: nextOriginalName,
                storageKey: newPublicUrl!,
                publicUrl: newPublicUrl,
                title: nextTitle,
                alt: nextAlt,
                caption: nextCaption,
              },
            });
            for (const row of linked.activities) {
              await tx.activityImage.update({ where: { id: row.id }, data: { url: row.newUrl } });
            }
            for (const row of linked.places) {
              await tx.placeImage.update({ where: { id: row.id }, data: { url: row.newUrl } });
            }
          });
        } catch (error) {
          await rename(newAbsolute, oldAbsolute).catch(() => undefined);
          throw error;
        }

        renamedAssets++;
        activityUrlsUpdated += linked.activities.length;
        placeUrlsUpdated += linked.places.length;
      } else {
        await prisma.mediaAsset.update({
          where: { id: media.id },
          data: {
            originalName: nextOriginalName,
            title: nextTitle,
            alt: nextAlt,
            caption: nextCaption,
          },
        });
        metadataOnlyAssets++;
      }
    }

    // The old endpoint also created responsive derivatives that are not
    // registered as MediaAsset rows. Remove source branding from those orphan
    // filenames too, otherwise a guessed /api/media/file URL could still leak
    // the import source name.
    const registeredPaths = new Set(
      (await prisma.mediaAsset.findMany({ select: { publicUrl: true, storageKey: true } }))
        .flatMap((row) => [
          extractMediaRelativePathFromUrl(row.publicUrl),
          extractMediaRelativePathFromUrl(row.storageKey),
        ])
        .filter((value): value is string => Boolean(value)),
    );
    const diskFiles = await walkFiles(MEDIA_UPLOADS_DIR);
    const orphanLeakyFiles = diskFiles.filter(
      (relativePath) => !registeredPaths.has(relativePath) && leaks(basename(relativePath), tokens),
    );

    let orphanFilesRenamed = 0;
    for (const oldRelative of orphanLeakyFiles) {
      const extension = extname(oldRelative).toLowerCase() || ".webp";
      const newFilename = stableNeutralFilename(`orphan:${oldRelative}`, extension);
      const newRelative = `${dirname(oldRelative) === "." ? "" : `${dirname(oldRelative)}/`}${newFilename}`;
      console.log(`${mode === "dry-run" ? "DRY" : "WRITE"} orphan: ${oldRelative} -> ${newRelative}`);
      if (mode === "dry-run") continue;

      const oldAbsolute = resolveMediaStorageAbsolutePath(oldRelative);
      const newAbsolute = resolveMediaStorageAbsolutePath(newRelative);
      if (!oldAbsolute || !newAbsolute || !existsSync(oldAbsolute)) continue;
      if (existsSync(newAbsolute)) {
        throw new Error(`Refusing to overwrite existing orphan target: ${newRelative}`);
      }
      await mkdir(dirname(newAbsolute), { recursive: true });
      await rename(oldAbsolute, newAbsolute);
      orphanFilesRenamed++;
    }

    console.log(
      JSON.stringify(
        {
          mode,
          matchedAssets: candidates.length,
          renamedAssets,
          metadataOnlyAssets,
          activityUrlsUpdated,
          placeUrlsUpdated,
          blockedMissingFiles,
          orphanLeakyFiles: orphanLeakyFiles.length,
          orphanFilesRenamed,
        },
        null,
        2,
      ),
    );

    if (mode === "write" && blockedMissingFiles > 0) {
      throw new Error(
        `Cleanup incomplete: ${blockedMissingFiles} asset(s) were blocked because their file/path could not be resolved`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
