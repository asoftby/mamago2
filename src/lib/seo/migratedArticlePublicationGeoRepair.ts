import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { parseArticleContentJson } from "@/lib/publications/articleMvp";
import { DEFAULT_COUNTRY_ISO } from "@/server/geo/geoConstants";
import type { MigratedArticlePublicationGeoRecovery } from "./migratedArticlePublicationGeoRecovery";
import { expectedFinalCanonicalPath, MINSK_CITY_SLUG } from "./migratedArticlePublicationGeoRecovery";

/**
 * Resolves the Minsk city unambiguously, scoped to Belarus
 * (DEFAULT_COUNTRY_ISO), excluding legacy/inactive rows. A same-slug city
 * in another country can never be selected: `slug` is unique per-country
 * (`@@unique([countryId, slug])` on City), so once the lookup is scoped by
 * `country.isoCode`, at most one row can match — this is the single source
 * of truth both the CLI script and its tests exercise, so they can never
 * drift apart.
 */
export async function resolveMinskCity(
  prisma: PrismaClient,
): Promise<{ id: string } | null> {
  return prisma.city.findFirst({
    where: {
      slug: MINSK_CITY_SLUG,
      isActive: true,
      isLegacyNonCity: false,
      country: { isoCode: DEFAULT_COUNTRY_ISO },
    },
    select: { id: true },
  });
}

export type PublicationGeoTargetState = {
  status: "PUBLISHED";
  geoScope: "CITY" | "COUNTRY";
  cityId: string | null;
};

export type PublicationGeoPlanRow = {
  articleId: string;
  title: string;
  /** The slug PLAN observed (and, on "apply" rows, the precondition APPLY re-checks atomically). */
  expectedSlug: string;
  /** The audited updatedAt PLAN validated against (and, on "apply" rows, the precondition APPLY re-checks atomically). */
  expectedUpdatedAt: string;
  before: {
    status: string;
    geoScope: string | null;
    cityId: string | null;
    regionId: string | null;
    updatedAt: string | null;
    /** The title PLAN read — for audited-state drift detection. */
    dbTitle: string | null;
    publishedAt: string | null;
    noindex: boolean | null;
    seoRobots: string | null;
    blocksCount: number | null;
    contentSha256: string | null;
  } | null;
  after: PublicationGeoTargetState;
  finalCanonicalPath: string;
  action: "apply" | "already_applied" | "conflict" | "not_found";
  reason?: string;
};

export function targetState(
  recovery: MigratedArticlePublicationGeoRecovery,
  minskCityId: string,
): PublicationGeoTargetState {
  return {
    status: "PUBLISHED",
    geoScope: recovery.geoScope,
    cityId: recovery.geoScope === "CITY" ? minskCityId : null,
  };
}

/**
 * Pure plan builder: reads current DB state for each recovery record and
 * classifies it as apply / already_applied (idempotent no-op) / conflict
 * (fails closed) / not_found. Never writes.
 *
 * Classification order:
 * 1. not_found — article row missing.
 * 2. slug conflict — slug differs from expected.
 * 3. region conflict — regionId must be null for every CITY/COUNTRY target.
 * 4. already_applied — publication state already matches target. For these
 *    rows, non-updatedAt audited fields (title, publishedAt, noindex,
 *    seoRobots, blocksCount) are still validated; only updatedAt is exempt
 *    because a successful APPLY legitimately advances it via @updatedAt.
 * 5. audited-state drift — for rows NOT yet in the target state (pre-repair),
 *    every audited field including updatedAt must exactly match the PROD
 *    snapshot. If any drifted, the row is classified as conflict and APPLY
 *    is blocked.
 * 6. precondition violated — publication fields are not PENDING/null/null/null.
 * 7. apply — all checks pass, ready for atomic repair.
 */
export async function buildPublicationGeoPlan(
  prisma: PrismaClient,
  recoveries: MigratedArticlePublicationGeoRecovery[],
  minskCityId: string,
): Promise<PublicationGeoPlanRow[]> {
  const plan: PublicationGeoPlanRow[] = [];

  for (const recovery of recoveries) {
    const after = targetState(recovery, minskCityId);
    const finalCanonicalPath = expectedFinalCanonicalPath(recovery);

    const article = await prisma.article.findUnique({
      where: { id: recovery.articleId },
      select: {
        id: true,
        slug: true,
        status: true,
        geoScope: true,
        cityId: true,
        regionId: true,
        title: true,
        updatedAt: true,
        publishedAt: true,
        noindex: true,
        seoRobots: true,
        contentJson: true,
      },
    });

    // ---------- not_found ----------
    if (!article) {
      plan.push({
        articleId: recovery.articleId,
        title: recovery.title,
        expectedSlug: recovery.currentSlug,
        expectedUpdatedAt: recovery.expectedUpdatedAt,
        before: null,
        after,
        finalCanonicalPath,
        action: "not_found",
        reason: "article missing",
      });
      continue;
    }

    const parsedContent = parseArticleContentJson(article.contentJson);
    const before = {
      status: article.status,
      geoScope: article.geoScope,
      cityId: article.cityId,
      regionId: article.regionId,
      updatedAt: article.updatedAt?.toISOString() ?? null,
      dbTitle: article.title,
      publishedAt: article.publishedAt?.toISOString() ?? null,
      noindex: article.noindex,
      seoRobots: article.seoRobots,
      blocksCount: parsedContent.blocks.length,
      contentSha256: createHash("sha256").update(JSON.stringify(parsedContent)).digest("hex"),
    };

    // ---------- slug drift ----------
    if (article.slug !== recovery.currentSlug) {
      plan.push({
        articleId: recovery.articleId,
        title: recovery.title,
        expectedSlug: recovery.currentSlug,
        expectedUpdatedAt: recovery.expectedUpdatedAt,
        before,
        after,
        finalCanonicalPath,
        action: "conflict",
        reason: `slug drift: db=${article.slug} expected=${recovery.currentSlug}`,
      });
      continue;
    }

    // CITY and COUNTRY recovery targets must never retain a primary region.
    // This is an audited precondition, not a field this repair may normalize.
    if (before.regionId !== null) {
      plan.push({
        articleId: recovery.articleId,
        title: recovery.title,
        expectedSlug: recovery.currentSlug,
        expectedUpdatedAt: recovery.expectedUpdatedAt,
        before,
        after,
        finalCanonicalPath,
        action: "conflict",
        reason: `unexpected regionId: db=${before.regionId} expected=null`,
      });
      continue;
    }

    // ---------- already applied / idempotent check (FIRST, before audited-state) ----------
    // After a successful APPLY, Article.updatedAt advances via @updatedAt. The audited
    // expectedUpdatedAt timestamp is then stale. We must detect already_applied by the
    // publication-state fields FIRST, exempting updatedAt from the comparison because the
    // repair legitimately moved it forward.
    //
    // For already_applied rows we still validate every other audited field (title,
    // publishedAt, noindex, seoRobots, blocksCount) — only updatedAt is exempt.
    const matchesTargetPubState =
      before.status === after.status &&
      before.geoScope === after.geoScope &&
      before.cityId === after.cityId &&
      before.regionId === null;

    if (matchesTargetPubState) {
      // Row already matches the target state. Check non-updatedAt audited fields for
      // unrelated post-repair drift (e.g. an editor changed title after repair).
      const postRepairChecks: string[] = [];
      if (before.dbTitle !== recovery.auditedTitle) {
        postRepairChecks.push(
          `title mismatch: db="${before.dbTitle}" audited="${recovery.auditedTitle}"`,
        );
      }
      if (before.publishedAt !== recovery.auditedPublishedAt) {
        postRepairChecks.push(
          `publishedAt mismatch: db=${before.publishedAt} audited=${recovery.auditedPublishedAt}`,
        );
      }
      if (before.noindex !== recovery.auditedNoindex) {
        postRepairChecks.push(
          `noindex mismatch: db=${before.noindex} audited=${recovery.auditedNoindex}`,
        );
      }
      if (before.seoRobots !== recovery.auditedSeoRobots) {
        postRepairChecks.push(
          `seoRobots mismatch: db="${before.seoRobots}" audited="${recovery.auditedSeoRobots}"`,
        );
      }
      if (before.blocksCount !== recovery.auditedBlocksCount) {
        postRepairChecks.push(
          `blocksCount mismatch: db=${before.blocksCount} audited=${recovery.auditedBlocksCount} (sanity)`,
        );
      }
      if (recovery.auditedContentSha256 && before.contentSha256 !== recovery.auditedContentSha256) {
        postRepairChecks.push(
          `contentSha256 mismatch: db=${before.contentSha256} audited=${recovery.auditedContentSha256}`,
        );
      }

      if (postRepairChecks.length > 0) {
        // Non-updatedAt audited field drifted after repair — real content edit, fail closed.
        plan.push({
          articleId: recovery.articleId,
          title: recovery.title,
          expectedSlug: recovery.currentSlug,
          expectedUpdatedAt: recovery.expectedUpdatedAt,
          before,
          after,
          finalCanonicalPath,
          action: "conflict",
          reason: `post-repair drift: ${postRepairChecks.join("; ")}`,
        });
        continue;
      }

      // All post-repair checks pass (or differed only in updatedAt, which is exempt).
      plan.push({
        articleId: recovery.articleId,
        title: recovery.title,
        expectedSlug: recovery.currentSlug,
        expectedUpdatedAt: recovery.expectedUpdatedAt,
        before,
        after,
        finalCanonicalPath,
        action: "already_applied",
      });
      continue;
    }

    // ---------- audited-state drift: fail-closed against any PROD change ----------
    // This block only runs for rows NOT yet in the target state (i.e. pre-repair).
    // Full audited check including updatedAt — must match the exact PROD snapshot.
    const auditedStateChecks: string[] = [];
    if (before.dbTitle !== recovery.auditedTitle) {
      auditedStateChecks.push(
        `title mismatch: db="${before.dbTitle}" audited="${recovery.auditedTitle}"`,
      );
    }
    if (before.updatedAt !== recovery.expectedUpdatedAt) {
      auditedStateChecks.push(
        `updatedAt mismatch: db=${before.updatedAt} audited=${recovery.expectedUpdatedAt}`,
      );
    }
    if (before.publishedAt !== recovery.auditedPublishedAt) {
      auditedStateChecks.push(
        `publishedAt mismatch: db=${before.publishedAt} audited=${recovery.auditedPublishedAt}`,
      );
    }
    if (before.noindex !== recovery.auditedNoindex) {
      auditedStateChecks.push(
        `noindex mismatch: db=${before.noindex} audited=${recovery.auditedNoindex}`,
      );
    }
    if (before.seoRobots !== recovery.auditedSeoRobots) {
      auditedStateChecks.push(
        `seoRobots mismatch: db="${before.seoRobots}" audited="${recovery.auditedSeoRobots}"`,
      );
    }
    // blocks count is a sanity check only — warn but don't block on it alone
    if (before.blocksCount !== recovery.auditedBlocksCount) {
      auditedStateChecks.push(
        `blocksCount mismatch: db=${before.blocksCount} audited=${recovery.auditedBlocksCount} (sanity)`,
      );
    }
    if (recovery.auditedContentSha256 && before.contentSha256 !== recovery.auditedContentSha256) {
      auditedStateChecks.push(
        `contentSha256 mismatch: db=${before.contentSha256} audited=${recovery.auditedContentSha256}`,
      );
    }

    if (auditedStateChecks.length > 0) {
      plan.push({
        articleId: recovery.articleId,
        title: recovery.title,
        expectedSlug: recovery.currentSlug,
        expectedUpdatedAt: recovery.expectedUpdatedAt,
        before,
        after,
        finalCanonicalPath,
        action: "conflict",
        reason: `audited state drift: ${auditedStateChecks.join("; ")}`,
      });
      continue;
    }

    // ---------- precondition violated (publication-state fields) ----------
    const matchesPrecondition =
      before.status === "PENDING" &&
      before.geoScope === null &&
      before.cityId === null &&
      before.regionId === null;

    if (!matchesPrecondition) {
      plan.push({
        articleId: recovery.articleId,
        title: recovery.title,
        expectedSlug: recovery.currentSlug,
        expectedUpdatedAt: recovery.expectedUpdatedAt,
        before,
        after,
        finalCanonicalPath,
        action: "conflict",
        reason:
          `unexpected current state: status=${before.status} geoScope=${before.geoScope} ` +
          `cityId=${before.cityId} regionId=${before.regionId}`,
      });
      continue;
    }

    // ---------- apply ----------
    plan.push({
      articleId: recovery.articleId,
      title: recovery.title,
      expectedSlug: recovery.currentSlug,
      expectedUpdatedAt: recovery.expectedUpdatedAt,
      before,
      after,
      finalCanonicalPath,
      action: "apply",
    });
  }

  return plan;
}

export function summarizePublicationGeoPlan(plan: PublicationGeoPlanRow[], mode: "plan" | "apply") {
  return {
    total: plan.length,
    apply: plan.filter((row) => row.action === "apply").length,
    already_applied: plan.filter((row) => row.action === "already_applied").length,
    conflict: plan.filter((row) => row.action === "conflict").length,
    not_found: plan.filter((row) => row.action === "not_found").length,
    mode,
  };
}

export type StrictArticleSearchIndexer = {
  upsertArticleStrict(articleId: string): Promise<void>;
};

export type SearchDocumentVerification = {
  articleId: string;
  status: "verified" | "missing" | "mismatch";
  urlPath: string;
  reason?: string;
};

/**
 * Reads the SearchDocument for one article back and confirms it reflects
 * the repair: published, correct title, correct canonical urlPath. Never
 * writes. Used right after a strict reindex to fail loudly (rather than
 * trust the indexer's own success) if the document is missing or wrong.
 */
export async function verifySearchDocument(
  prisma: PrismaClient,
  row: PublicationGeoPlanRow,
): Promise<SearchDocumentVerification> {
  const expectedTitle = row.before?.dbTitle ?? row.title;
  const doc = await prisma.searchDocument.findUnique({
    where: { entityType_entityId: { entityType: "article", entityId: row.articleId } },
  });
  if (!doc) {
    return {
      articleId: row.articleId,
      status: "missing",
      urlPath: row.finalCanonicalPath,
      reason: "SearchDocument not found",
    };
  }
  const mismatches: string[] = [];
  if (!doc.isPublished) mismatches.push("isPublished=false");
  if (doc.title !== expectedTitle) {
    mismatches.push(`title mismatch: doc="${doc.title}" expected="${expectedTitle}"`);
  }
  if (doc.urlPath !== row.finalCanonicalPath) {
    mismatches.push(`urlPath mismatch: doc="${doc.urlPath}" expected="${row.finalCanonicalPath}"`);
  }
  if (mismatches.length > 0) {
    return {
      articleId: row.articleId,
      status: "mismatch",
      urlPath: doc.urlPath,
      reason: mismatches.join("; "),
    };
  }
  return { articleId: row.articleId, status: "verified", urlPath: doc.urlPath };
}

/**
 * Applies `action: "apply"` rows inside a single transaction, then strictly
 * reindexes and verifies search for every `"apply"` AND `"already_applied"`
 * row. Refuses (throws, no writes, no reindex) if any conflict/not_found
 * rows are present in the plan — the caller must resolve those first.
 *
 * `prisma` should be a plain (non-search-indexing-extended) client for the
 * transaction — e.g. `prismaBase` from `@/lib/prisma`, not the default
 * extended `prisma` export. This repair's own strict, verified,
 * post-commit reindex below is the sole authoritative indexing step; using
 * the extended client here would additionally fire an un-awaited
 * fire-and-forget reindex from inside the transaction, racing the commit
 * and duplicating work the strict step already guarantees.
 *
 * ATOMICITY (publication write):
 * PLAN and APPLY are two separate round-trips, so the DB state PLAN read can
 * go stale before APPLY runs (TOCTOU). Each apply-row's write is therefore
 * an `updateMany` whose WHERE clause re-asserts the *exact* expected
 * precondition atomically as part of the same UPDATE statement — not a
 * separate read-then-write. The WHERE clause includes both:
 * 1. Atomic publication-state guard: id + slug + PENDING/null/null
 * 2. Audited-state guard: updatedAt === expectedUpdatedAt
 * If any row's `updated.count !== 1`, the current DB state no longer
 * matches what PLAN saw; the whole transaction throws and every write in
 * it (including any already-issued updates for other rows in this same
 * APPLY call) rolls back. No partial mutations are possible.
 *
 * RESUMABLE SEARCH REINDEX:
 * `searchRows` = "apply" rows (just published) UNION "already_applied" rows
 * (already published — by this run or a prior one). Reindex runs for both,
 * and — critically — runs even when there are zero "apply" rows (an
 * already-fully-applied rerun). This makes a post-commit indexing failure
 * resumable: if run #1's transaction commits but `upsertArticleStrict`
 * throws, the Article is left PUBLISHED with a stale/missing
 * SearchDocument; PLAN then classifies it `already_applied` (not
 * `conflict`) on the next run, and run #2's APPLY reaches the reindex step
 * again with zero publication writes and repairs the index. Indexing uses
 * `upsertArticleStrict`, which propagates errors instead of swallowing
 * them (`SearchIndexerService.upsertArticle` catches/logs and would make
 * this function falsely report success), and each reindex is immediately
 * verified via `verifySearchDocument` — fails loudly (throws) if the
 * document is still missing or wrong after the indexer claims success.
 */
export async function applyPublicationGeoPlan(
  prisma: PrismaClient,
  plan: PublicationGeoPlanRow[],
  searchIndexer: StrictArticleSearchIndexer,
) {
  const conflicts = plan.filter((row) => row.action === "conflict" || row.action === "not_found");
  if (conflicts.length > 0) {
    throw new Error(
      `[migratedArticlePublicationGeoRepair] Refusing to apply: ${conflicts.length} conflict/not_found row(s) present`,
    );
  }

  const publicationRows = plan.filter((row) => row.action === "apply");
  const searchRows = plan.filter(
    (row) => row.action === "apply" || row.action === "already_applied",
  );

  if (publicationRows.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const row of publicationRows) {
        const result = await tx.article.updateMany({
          where: {
            // Atomic publication-state guard
            id: row.articleId,
            slug: row.expectedSlug,
            status: "PENDING",
            geoScope: null,
            cityId: null,
            regionId: null,
            // Audited-state guard: fail-closed if content was edited after the PROD audit
            updatedAt: new Date(row.expectedUpdatedAt),
          },
          data: {
            status: row.after.status,
            geoScope: row.after.geoScope,
            cityId: row.after.cityId,
          },
        });
        if (result.count !== 1) {
          throw new Error(
            `[migratedArticlePublicationGeoRepair] Precondition no longer holds for ${row.articleId} ` +
              `(expected status=PENDING geoScope=null cityId=null regionId=null ` +
              `slug=${row.expectedSlug} updatedAt=${row.expectedUpdatedAt}); ` +
              `aborting transaction, no partial writes`,
          );
        }
      }
    });
  }

  // Search reindex runs for apply + already_applied rows regardless of
  // whether the transaction above ran — do NOT early-return when
  // publicationRows is empty (see RESUMABLE SEARCH REINDEX above).
  const verifications: SearchDocumentVerification[] = [];
  for (const row of searchRows) {
    await searchIndexer.upsertArticleStrict(row.articleId);
    const verification = await verifySearchDocument(prisma, row);
    verifications.push(verification);
    if (verification.status !== "verified") {
      throw new Error(
        `[migratedArticlePublicationGeoRepair] SearchDocument verification failed for ${row.articleId}: ` +
          `${verification.status} — ${verification.reason ?? "unknown"}`,
      );
    }
  }

  return { applied: publicationRows.length, reindexed: searchRows.length, verifications };
}
