import { PrismaClient } from "@prisma/client";
import { optimizeImportedImage } from "@/server/media/imported-image-optimizer";

type Mode = "dry-run" | "write";

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

function buildSourceTokens(
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
        // Legacy/invalid base URL: slug/parserKey still provide coverage.
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

async function main(): Promise<void> {
  const mode = parseMode(process.argv.slice(2));
  const prisma = new PrismaClient();

  try {
    const sources = await prisma.importSource.findMany({
      select: { slug: true, parserKey: true, baseUrl: true },
    });
    const tokens = buildSourceTokens(sources);
    if (tokens.length === 0) {
      throw new Error("No import-source tokens discovered; refusing to run");
    }

    const activities = await prisma.activity.findMany({
      where: { coverImageUrl: { not: null } },
      select: { id: true, ownerUserId: true, coverImageUrl: true, title: true },
    });
    const matched = activities.filter((activity) => leaks(activity.coverImageUrl, tokens));

    console.log(
      JSON.stringify(
        {
          mode,
          activitiesScanned: activities.length,
          sourceCoverLeaks: matched.length,
        },
        null,
        2,
      ),
    );

    let localized = 0;
    let cleared = 0;
    let failed = 0;

    for (const activity of matched) {
      const sourceUrl = activity.coverImageUrl;
      if (!sourceUrl) continue;

      console.log(
        `${mode === "dry-run" ? "DRY" : "WRITE"} ${activity.id} ${JSON.stringify(activity.title)}: ${sourceUrl}`,
      );
      if (mode === "dry-run") continue;

      if (!activity.ownerUserId) {
        await prisma.activity.update({
          where: { id: activity.id },
          data: { coverImageUrl: null },
        });
        cleared++;
        console.warn(`cleared ${activity.id}: no ownerUserId available for local media ownership`);
        continue;
      }

      const result = await optimizeImportedImage(
        sourceUrl,
        `activity-cover-${activity.id}`,
        activity.ownerUserId,
      );

      if (result.ok) {
        await prisma.activity.update({
          where: { id: activity.id },
          data: { coverImageUrl: result.publicUrl },
        });
        localized++;
        console.log(`localized ${activity.id}: ${result.publicUrl}`);
      } else {
        // Privacy wins over retaining a broken external source URL. The editor
        // can add a replacement image later, but provenance must not stay public.
        await prisma.activity.update({
          where: { id: activity.id },
          data: { coverImageUrl: null },
        });
        cleared++;
        failed++;
        console.warn(`cleared ${activity.id}: localization failed: ${result.error}`);
      }
    }

    console.log(
      JSON.stringify(
        {
          mode,
          matched: matched.length,
          localized,
          cleared,
          localizationFailures: failed,
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
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
