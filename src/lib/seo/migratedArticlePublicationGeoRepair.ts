import type { PrismaClient } from "@prisma/client";
import type { MigratedArticlePublicationGeoRecovery } from "./migratedArticlePublicationGeoRecovery";
import { expectedFinalCanonicalPath } from "./migratedArticlePublicationGeoRecovery";

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
  before: {
    status: string;
    geoScope: string | null;
    cityId: string | null;
    updatedAt: string | null;
    /** The title PLAN read — for audited-state drift detection. */
    dbTitle: string | null;
    publishedAt: string | null;
    noindex: boolean | null;
    seoRobots: string | null;
    blocksCount: number | null;
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
 * In addition to the publication-state precondition (PENDING/null/null),
 * PLAN validates every audited field against the PROD snapshot captured in
 * the recovery matrix: title, updatedAt, publishedAt, noindex, seoRobots,
 * and the content blocks count (sanity check). If any audited field
 * drifted, the row is classified as conflict and APPLY is blocked.
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
        before: null,
        after,
        finalCanonicalPath,
        action: "not_found",
        reason: "article missing",
      });
      continue;
    }

    const before = {
      status: article.status,
      geoScope: article.geoScope,
      cityId: article.cityId,
      updatedAt: article.updatedAt?.toISOString() ?? null,
      dbTitle: article.title,
      publishedAt: article.publishedAt?.toISOString() ?? null,
      noindex: article.noindex,
      seoRobots: article.seoRobots,
      blocksCount: article.contentJson
        ? ((article.contentJson as Record<string, unknown>)?.blocks as unknown[] | undefined)
            ?.length ?? null
        : null,
    };

    // ---------- slug drift ----------
    if (article.slug !== recovery.currentSlug) {
      plan.push({
        articleId: recovery.articleId,
        title: recovery.title,
        expectedSlug: recovery.currentSlug,
        before,
        after,
        finalCanonicalPath,
        action: "conflict",
        reason: `slug drift: db=${article.slug} expected=${recovery.currentSlug}`,
      });
      continue;
    }

    // ---------- audited-state drift: fail-closed against any PROD change ----------
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

    if (auditedStateChecks.length > 0) {
      plan.push({
        articleId: recovery.articleId,
        title: recovery.title,
        expectedSlug: recovery.currentSlug,
        before,
        after,
        finalCanonicalPath,
        action: "conflict",
        reason: `audited state drift: ${auditedStateChecks.join("; ")}`,
      });
      continue;
    }

    // ---------- already applied (idempotent) ----------
    const matchesTarget =
      before.status === after.status &&
      before.geoScope === after.geoScope &&
      before.cityId === after.cityId;

    if (matchesTarget) {
      plan.push({
        articleId: recovery.articleId,
        title: recovery.title,
        expectedSlug: recovery.currentSlug,
        before,
        after,
        finalCanonicalPath,
        action: "already_applied",
      });
      continue;
    }

    // ---------- precondition violated (publication-state fields) ----------
    const matchesPrecondition =
      before.status === "PENDING" && before.geoScope === null && before.cityId === null;

    if (!matchesPrecondition) {
      plan.push({
        articleId: recovery.articleId,
        title: recovery.title,
        expectedSlug: recovery.currentSlug,
        before,
        after,
        finalCanonicalPath,
        action: "conflict",
        reason: `unexpected current state: status=${before.status} geoScope=${before.geoScope} cityId=${before.cityId}`,
      });
      continue;
    }

    // ---------- apply ----------
    plan.push({
      articleId: recovery.articleId,
      title: recovery.title,
      expectedSlug: recovery.currentSlug,
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

/**
 * Applies only `action: "apply"` rows inside a single transaction. Refuses
 * (throws, no writes) if any conflict/not_found rows are present in the
 * plan — the caller must resolve those first. Re-running with an
 * already-applied plan is a no-op (idempotent).
 *
 * PLAN and APPLY are two separate round-trips, so the DB state PLAN read can
 * go stale before APPLY runs (TOCTOU). Each row's write is therefore an
 * `updateMany` whose WHERE clause re-asserts the *exact* expected
 * precondition atomically as part of the same UPDATE statement — not a
 * separate read-then-write.
 *
 * The WHERE clause includes **both** guards:
 * 1. Atomic publication-state guard: id + slug + PENDING/null/null
 * 2. Audited-state guard: updatedAt === expectedUpdatedAt
 *
 * If any row's `updated.count !== 1`, the current DB state no longer matches
 * what PLAN saw; the whole transaction throws and every write in it (including
 * any already-issued updates for other rows in this same APPLY call) rolls
 * back. No partial mutations are possible.
 */
export async function applyPublicationGeoPlan(
  prisma: PrismaClient,
  plan: PublicationGeoPlanRow[],
  recoveries?: MigratedArticlePublicationGeoRecovery[],
) {
  const conflicts = plan.filter((row) => row.action === "conflict" || row.action === "not_found");
  if (conflicts.length > 0) {
    throw new Error(
      `[migratedArticlePublicationGeoRepair] Refusing to apply: ${conflicts.length} conflict/not_found row(s) present`,
    );
  }

  const toApply = plan.filter((row) => row.action === "apply");
  if (toApply.length === 0) return { applied: 0 };

  // Build a lookup map for expectedUpdatedAt by articleId
  const updatedAtMap = new Map<string, string>();
  if (recoveries) {
    for (const rec of recoveries) {
      updatedAtMap.set(rec.articleId, rec.expectedUpdatedAt);
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const row of toApply) {
      const expectedUpdatedAt = updatedAtMap.get(row.articleId);
      if (!expectedUpdatedAt) {
        throw new Error(
          `[migratedArticlePublicationGeoRepair] Missing expectedUpdatedAt for ${row.articleId}`,
        );
      }

      const result = await tx.article.updateMany({
        where: {
          // Atomic publication-state guard
          id: row.articleId,
          slug: row.expectedSlug,
          status: "PENDING",
          geoScope: null,
          cityId: null,
          // Audited-state guard: fail-closed if content was edited after the PROD audit
          updatedAt: new Date(expectedUpdatedAt),
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
            `(expected PENDING/null/null slug=${row.expectedSlug} updatedAt=${expectedUpdatedAt}); ` +
            `aborting transaction, no partial writes`,
        );
      }
    }
  });

  return { applied: toApply.length };
}