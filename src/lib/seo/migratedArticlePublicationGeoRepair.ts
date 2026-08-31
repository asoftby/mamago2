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
  before: {
    status: string;
    geoScope: string | null;
    cityId: string | null;
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
      select: { id: true, slug: true, status: true, geoScope: true, cityId: true },
    });

    if (!article) {
      plan.push({
        articleId: recovery.articleId,
        title: recovery.title,
        before: null,
        after,
        finalCanonicalPath,
        action: "not_found",
        reason: "article missing",
      });
      continue;
    }

    if (article.slug !== recovery.currentSlug) {
      plan.push({
        articleId: recovery.articleId,
        title: recovery.title,
        before: { status: article.status, geoScope: article.geoScope, cityId: article.cityId },
        after,
        finalCanonicalPath,
        action: "conflict",
        reason: `slug drift: db=${article.slug} expected=${recovery.currentSlug}`,
      });
      continue;
    }

    const before = { status: article.status, geoScope: article.geoScope, cityId: article.cityId };
    const matchesPrecondition =
      before.status === "PENDING" && before.geoScope === null && before.cityId === null;
    const matchesTarget =
      before.status === after.status &&
      before.geoScope === after.geoScope &&
      before.cityId === after.cityId;

    if (matchesTarget) {
      plan.push({
        articleId: recovery.articleId,
        title: recovery.title,
        before,
        after,
        finalCanonicalPath,
        action: "already_applied",
      });
      continue;
    }

    if (!matchesPrecondition) {
      plan.push({
        articleId: recovery.articleId,
        title: recovery.title,
        before,
        after,
        finalCanonicalPath,
        action: "conflict",
        reason: `unexpected current state: status=${before.status} geoScope=${before.geoScope} cityId=${before.cityId}`,
      });
      continue;
    }

    plan.push({
      articleId: recovery.articleId,
      title: recovery.title,
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
 */
export async function applyPublicationGeoPlan(prisma: PrismaClient, plan: PublicationGeoPlanRow[]) {
  const conflicts = plan.filter((row) => row.action === "conflict" || row.action === "not_found");
  if (conflicts.length > 0) {
    throw new Error(
      `[migratedArticlePublicationGeoRepair] Refusing to apply: ${conflicts.length} conflict/not_found row(s) present`,
    );
  }

  const toApply = plan.filter((row) => row.action === "apply");
  if (toApply.length === 0) return { applied: 0 };

  await prisma.$transaction(async (tx) => {
    for (const row of toApply) {
      await tx.article.update({
        where: { id: row.articleId },
        data: {
          status: row.after.status,
          geoScope: row.after.geoScope,
          cityId: row.after.cityId,
        },
        select: { id: true },
      });
    }
  });

  return { applied: toApply.length };
}
