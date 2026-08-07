/**
 * Idempotent metadata-only backfill for migrated MediaAsset rows on DEV.
 *
 * Discovers linkages:
 * - PlaceImage → PLACE gallery/logo
 * - Activity coverImageId → EVENT cover
 * - ActivityImage.mediaAssetId → EVENT gallery
 * - Article coverImageId / seoImageId → ARTICLE cover/seo
 * - Article contentJson image/gallery blocks → ARTICLE content/gallery
 *
 * Then:
 * - Ensures MediaUsage rows exist (CLI-safe prisma create, no server-only)
 * - Fills/replaces technical titles and missing alt/caption from
 *   generateMediaMetadata(entity context)
 * - Preserves originalName / filename / storageKey / binaries
 * - Never overwrites non-empty alt/caption or meaningful titles
 * - Orphan migrated assets (no discoverable entity link) are left unchanged
 *
 * Usage:
 *   pnpm media:backfill-migrated-metadata --dry-run --limit 10
 *   pnpm media:backfill-migrated-metadata --confirm-writes --limit 10
 *   pnpm media:backfill-migrated-metadata --confirm-writes --media-id <id> [--media-id <id2>]
 *   pnpm media:backfill-migrated-metadata --confirm-writes
 */
import { PrismaClient, type MediaEntityType } from "@prisma/client";
import {
  buildGeneratedMetadataForLink,
  decideMigratedMediaMetadataPatch,
  type DiscoveredMediaLink,
} from "@/lib/media/decideMigratedMediaMetadataPatch";

/** Same idempotent semantics as registerMediaUsage — inlined to avoid `server-only` CLI import. */
async function ensureMediaUsage(
  prisma: PrismaClient,
  input: { mediaId: string; entityType: MediaEntityType; entityId: string; field: string },
): Promise<"created" | "already"> {
  const existing = await prisma.mediaUsage.findFirst({
    where: {
      mediaId: input.mediaId,
      entityType: input.entityType,
      entityId: input.entityId,
      field: input.field,
    },
  });
  if (existing) return "already";
  await prisma.mediaUsage.create({ data: input });
  return "created";
}

type CliArgs = {
  dryRun: boolean;
  confirmWrites: boolean;
  limit?: number;
  mediaIds: string[];
};

function parseArgs(argv: string[]): CliArgs {
  const dryRun = argv.includes("--dry-run");
  const confirmWrites = argv.includes("--confirm-writes");
  if (!dryRun && !confirmWrites) {
    throw new Error("Pass --dry-run or --confirm-writes.");
  }
  if (dryRun && confirmWrites) {
    throw new Error("Pass only one of --dry-run / --confirm-writes.");
  }
  const limitIdx = argv.indexOf("--limit");
  const limit = limitIdx === -1 ? undefined : Number(argv[limitIdx + 1]);
  if (limitIdx !== -1 && (!Number.isFinite(limit) || (limit as number) <= 0)) {
    throw new Error(`Invalid --limit "${argv[limitIdx + 1]}".`);
  }

  const mediaIds: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--media-id") {
      const value = argv[i + 1]?.trim();
      if (!value || value.startsWith("--")) {
        throw new Error("Missing value for --media-id.");
      }
      mediaIds.push(value);
      i++;
    }
  }

  return { dryRun, confirmWrites, limit, mediaIds };
}

function mediaUrlKeys(url: string): string[] {
  const trimmed = url.trim();
  const keys = new Set<string>([trimmed]);
  const file = trimmed.split("/").pop();
  if (file) {
    keys.add(file);
    keys.add(`/api/media/file/${file}`);
  }
  return [...keys];
}

function extractArticleMediaLinks(
  contentJson: unknown,
): Array<{ mediaId: string; field: "content" | "gallery" }> {
  const out: Array<{ mediaId: string; field: "content" | "gallery" }> = [];
  const seen = new Set<string>();

  const visit = (node: unknown, inGallery: boolean) => {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const child of node) visit(child, inGallery);
      return;
    }
    if (typeof node !== "object") return;
    const obj = node as Record<string, unknown>;
    const type = typeof obj.type === "string" ? obj.type : null;
    const nextInGallery = inGallery || type === "gallery";

    if (typeof obj.mediaId === "string" && obj.mediaId.trim()) {
      const mediaId = obj.mediaId.trim();
      if (!seen.has(mediaId)) {
        seen.add(mediaId);
        out.push({ mediaId, field: nextInGallery ? "gallery" : "content" });
      }
    }

    for (const value of Object.values(obj)) {
      if (typeof value === "object" && value !== null) {
        visit(value, nextInGallery);
      }
    }
  };

  visit(contentJson, false);
  return out;
}

async function discoverLinks(prisma: PrismaClient, mediaIdFilter?: Set<string>): Promise<DiscoveredMediaLink[]> {
  const links: DiscoveredMediaLink[] = [];
  const allow = (id: string) => !mediaIdFilter || mediaIdFilter.has(id);

  const places = await prisma.place.findMany({
    select: {
      id: true,
      title: true,
      shortAddress: true,
      city: { select: { name: true } },
      images: { select: { url: true, kind: true } },
    },
  });

  for (const place of places) {
    for (const image of place.images) {
      if (!image.url?.trim()) continue;
      const keys = mediaUrlKeys(image.url);
      const media = await prisma.mediaAsset.findFirst({
        where: {
          sourceType: "MIGRATED",
          status: "ACTIVE",
          ...(mediaIdFilter ? { id: { in: [...mediaIdFilter] } } : {}),
          OR: [
            { publicUrl: { in: keys } },
            { storageKey: { in: keys } },
            { filename: { in: keys.map((k) => k.split("/").pop()!).filter(Boolean) } },
          ],
        },
        select: { id: true },
      });
      if (!media || !allow(media.id)) continue;
      const field = image.kind === "LOGO" ? "logo" : "gallery";
      links.push({
        mediaId: media.id,
        entityType: "PLACE",
        entityId: place.id,
        field,
        entityTitle: place.title,
        placeAddress: {
          cityName: place.city?.name ?? null,
          shortAddress: place.shortAddress ?? null,
        },
      });
    }
  }

  const events = await prisma.activity.findMany({
    where: { type: "EVENT" },
    select: {
      id: true,
      title: true,
      coverImageId: true,
      images: { select: { mediaAssetId: true } },
    },
  });
  for (const event of events) {
    if (event.coverImageId && allow(event.coverImageId)) {
      const media = await prisma.mediaAsset.findFirst({
        where: { id: event.coverImageId, sourceType: "MIGRATED", status: "ACTIVE" },
        select: { id: true },
      });
      if (media) {
        links.push({
          mediaId: media.id,
          entityType: "EVENT",
          entityId: event.id,
          field: "cover",
          entityTitle: event.title,
        });
      }
    }
    for (const image of event.images) {
      if (!image.mediaAssetId || !allow(image.mediaAssetId)) continue;
      const media = await prisma.mediaAsset.findFirst({
        where: { id: image.mediaAssetId, sourceType: "MIGRATED", status: "ACTIVE" },
        select: { id: true },
      });
      if (!media) continue;
      links.push({
        mediaId: media.id,
        entityType: "EVENT",
        entityId: event.id,
        field: "gallery",
        entityTitle: event.title,
      });
    }
  }

  const articles = await prisma.article.findMany({
    select: {
      id: true,
      title: true,
      coverImageId: true,
      seoImageId: true,
      contentJson: true,
    },
  });
  for (const article of articles) {
    const pairs: Array<{ id: string | null; field: string }> = [
      { id: article.coverImageId, field: "cover" },
      { id: article.seoImageId, field: "seo" },
    ];
    for (const pair of pairs) {
      if (!pair.id || !allow(pair.id)) continue;
      const media = await prisma.mediaAsset.findFirst({
        where: { id: pair.id, sourceType: "MIGRATED", status: "ACTIVE" },
        select: { id: true },
      });
      if (!media) continue;
      links.push({
        mediaId: media.id,
        entityType: "ARTICLE",
        entityId: article.id,
        field: pair.field,
        entityTitle: article.title,
      });
    }

    for (const inline of extractArticleMediaLinks(article.contentJson)) {
      if (!allow(inline.mediaId)) continue;
      const media = await prisma.mediaAsset.findFirst({
        where: { id: inline.mediaId, sourceType: "MIGRATED", status: "ACTIVE" },
        select: { id: true },
      });
      if (!media) continue;
      links.push({
        mediaId: media.id,
        entityType: "ARTICLE",
        entityId: article.id,
        field: inline.field,
        entityTitle: article.title,
      });
    }
  }

  return links;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();
  const mediaIdFilter = args.mediaIds.length > 0 ? new Set(args.mediaIds) : undefined;

  const summary = {
    consideredLinks: 0,
    usageCreated: 0,
    usageAlready: 0,
    metadataApplied: 0,
    metadataSkipped: 0,
    uniqueMediaTouched: new Set<string>(),
  };

  try {
    let links = await discoverLinks(prisma, mediaIdFilter);
    const seen = new Set<string>();
    links = links.filter((l) => {
      const key = `${l.mediaId}:${l.entityType}:${l.entityId}:${l.field}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (args.limit != null) {
      const mediaOrder: string[] = [];
      const byMedia = new Map<string, DiscoveredMediaLink[]>();
      for (const link of links) {
        if (!byMedia.has(link.mediaId)) {
          byMedia.set(link.mediaId, []);
          mediaOrder.push(link.mediaId);
        }
        byMedia.get(link.mediaId)!.push(link);
      }
      // Prefer assets still missing alt (or not yet in MediaUsage) for proof batches.
      const mediaMeta = await prisma.mediaAsset.findMany({
        where: { id: { in: mediaOrder } },
        select: {
          id: true,
          alt: true,
          _count: { select: { usages: true } },
        },
      });
      const score = new Map(
        mediaMeta.map((m) => [m.id, (m.alt ? 0 : 2) + (m._count.usages === 0 ? 1 : 0)]),
      );
      mediaOrder.sort((a, b) => (score.get(b) ?? 0) - (score.get(a) ?? 0));
      const kept = new Set(mediaOrder.slice(0, args.limit));
      links = links.filter((l) => kept.has(l.mediaId));
    }

    summary.consideredLinks = links.length;
    console.log(`Discovered ${links.length} media↔entity link(s) to process.`);

    const byMedia = new Map<string, DiscoveredMediaLink[]>();
    for (const link of links) {
      if (!byMedia.has(link.mediaId)) byMedia.set(link.mediaId, []);
      byMedia.get(link.mediaId)!.push(link);
    }

    for (const [mediaId, mediaLinks] of byMedia) {
      summary.uniqueMediaTouched.add(mediaId);
      // Prefer cover over gallery/content when choosing generation context
      const primary =
        mediaLinks.find((l) => l.field === "cover") ??
        mediaLinks.find((l) => l.field === "logo") ??
        mediaLinks.find((l) => l.field === "gallery") ??
        mediaLinks[0]!;

      for (const link of mediaLinks) {
        const usageInput = {
          mediaId: link.mediaId,
          entityType: link.entityType as MediaEntityType,
          entityId: link.entityId,
          field: link.field,
        };
        if (args.dryRun) {
          const existing = await prisma.mediaUsage.findFirst({ where: usageInput });
          if (existing) summary.usageAlready++;
          else summary.usageCreated++;
        } else {
          const result = await ensureMediaUsage(prisma, usageInput);
          if (result === "already") summary.usageAlready++;
          else summary.usageCreated++;
        }
      }

      const asset = await prisma.mediaAsset.findUnique({
        where: { id: mediaId },
        select: { id: true, title: true, alt: true, caption: true, originalName: true, filename: true },
      });
      if (!asset) continue;

      const generated = buildGeneratedMetadataForLink({
        entityType: primary.entityType,
        entityTitle: primary.entityTitle,
        field: primary.field,
        placeAddress: primary.placeAddress,
      });

      const decision = decideMigratedMediaMetadataPatch({
        current: { title: asset.title, alt: asset.alt, caption: asset.caption },
        generated,
      });

      console.log(
        `${decision.action} ${mediaId} :: ${decision.reason} :: title="${asset.title}" → "${decision.next.title}"`,
      );

      if (decision.action === "SKIP_UNCHANGED") {
        summary.metadataSkipped++;
        continue;
      }

      summary.metadataApplied++;
      if (!args.dryRun) {
        await prisma.mediaAsset.update({
          where: { id: mediaId },
          data: {
            title: decision.next.title,
            alt: decision.next.alt,
            caption: decision.next.caption,
          },
        });
      }
    }

    console.log("\nSummary:");
    console.log(
      JSON.stringify(
        {
          mode: args.dryRun ? "dry-run" : "writes",
          consideredLinks: summary.consideredLinks,
          uniqueMedia: summary.uniqueMediaTouched.size,
          usageCreated: summary.usageCreated,
          usageAlready: summary.usageAlready,
          metadataApplied: summary.metadataApplied,
          metadataSkipped: summary.metadataSkipped,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(`\nmedia:backfill-migrated-metadata failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
