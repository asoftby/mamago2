import type { Prisma, PrismaClient } from "@prisma/client";

export type RouteReviewDecision =
  | "READY"
  | "NEEDS_COPY_REVIEW"
  | "NEEDS_MEDIA_REVIEW"
  | "NEEDS_CITY"
  | "BLOCKED";

export interface RouteReviewWarning {
  code: string;
  message: string;
  severity?: string;
  details?: unknown;
}

export interface RouteReviewStop {
  routeStopId: string;
  order: number;
  title: string | null;
  sourceNote: string;
  noteLength: number;
  hasPhotoUrl: boolean;
  proposedNote: string;
  changeReason: string | null;
  reviewStatus: "OK" | "NEEDS_COPY_REVIEW" | "EMPTY_SOURCE";
}

export interface RouteReviewItem {
  sourceRecordKey: string;
  legacyWpId: number | null;
  routeId: string | null;
  title: string | null;
  slug: string | null;
  cityId: string | null;
  status: string | null;
  visibility: string | null;
  authorId: string | null;
  stopCount: number;
  stopsWithPhotoUrl: number;
  warnings: RouteReviewWarning[];
  stops: RouteReviewStop[];
  decision: RouteReviewDecision;
  blockers: string[];
}

export interface RouteReviewReport {
  generatedAt: string;
  expectedRouteCount: number;
  actualRouteCount: number;
  routesCreatedCount: number;
  activeLineageCount: number;
  draftPrivateCount: number;
  routes: RouteReviewItem[];
  decisionCounts: Record<RouteReviewDecision, number>;
  globalBlockers: string[];
}

export interface RouteReviewApplyPlanRoute {
  sourceRecordKey: string;
  routeId: string | null;
  decision: RouteReviewDecision;
  proposed: {
    status: "PUBLISHED";
    visibility: "PUBLIC";
    isEditorial: true;
    authorId: null;
  };
  stopNoteChanges: Array<{
    routeStopId: string;
    order: number;
    before: string;
    after: string;
    reason: string;
  }>;
  blockers: string[];
  warnings: RouteReviewWarning[];
}

export interface RouteReviewApplyPlan {
  generatedAt: string;
  expectedRouteCount: number;
  actualRouteCount: number;
  routes: RouteReviewApplyPlanRoute[];
  decisionCounts: Record<RouteReviewDecision, number>;
  globalBlockers: string[];
}

export interface RouteReviewPrismaClient {
  migrationLineage: Pick<PrismaClient["migrationLineage"], "findMany">;
  route: Pick<PrismaClient["route"], "findMany">;
}

type MigrationLineageRow = {
  sourceRecordKey: string;
  targetId: string | null;
  record: {
    status: string;
    validationSummary: Prisma.JsonValue | null;
  } | null;
};

type RouteRow = {
  id: string;
  title: string;
  slug: string;
  cityId: string | null;
  status: string;
  visibility: string;
  authorId: string | null;
  stops: Array<{
    id: string;
    order: number;
    customTitle: string | null;
    note: string;
    photoUrl: string | null;
  }>;
};

const EXPECTED_ROUTE_COUNT = 14;

function emptyDecisionCounts(): Record<RouteReviewDecision, number> {
  return {
    READY: 0,
    NEEDS_COPY_REVIEW: 0,
    NEEDS_MEDIA_REVIEW: 0,
    NEEDS_CITY: 0,
    BLOCKED: 0,
  };
}

function parseLegacyWpId(sourceRecordKey: string): number | null {
  const match = /^wordpress-db:routes:(\d+)$/.exec(sourceRecordKey);
  if (!match) return null;
  return Number(match[1]);
}

function normalizeWarnings(value: Prisma.JsonValue | null | undefined): RouteReviewWarning[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Prisma.JsonObject => typeof item === "object" && item !== null && !Array.isArray(item))
    .map((item) => ({
      code: typeof item.code === "string" ? item.code : "UNKNOWN_WARNING",
      message: typeof item.message === "string" ? item.message : "",
      severity: typeof item.severity === "string" ? item.severity : undefined,
      details: item.details,
    }));
}

function plainText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSentences(value: string): string[] {
  const matches = value.match(/[^.!?。！？]+[.!?。！？]?/g);
  return (matches ?? [value]).map((sentence) => sentence.trim()).filter(Boolean);
}

export function proposeShortRouteStopNote(sourceNote: string): {
  proposedNote: string;
  reason: string | null;
  status: RouteReviewStop["reviewStatus"];
} {
  const cleaned = plainText(sourceNote);
  if (!cleaned) {
    return { proposedNote: "", reason: null, status: "EMPTY_SOURCE" };
  }

  const hadMarkup = cleaned !== sourceNote.trim();
  if (cleaned.length <= 300 && !hadMarkup) {
    return { proposedNote: cleaned, reason: null, status: "OK" };
  }

  const sentences = splitSentences(cleaned);
  const selected: string[] = [];
  for (const sentence of sentences) {
    const candidate = [...selected, sentence].join(" ");
    if (candidate.length > 300) break;
    selected.push(sentence);
    if (selected.length >= 3) break;
  }

  let proposed = selected.join(" ");
  if (!proposed) {
    const words = cleaned.split(/\s+/);
    const kept: string[] = [];
    for (const word of words) {
      const candidate = [...kept, word].join(" ");
      if (candidate.length > 297) break;
      kept.push(word);
    }
    proposed = `${kept.join(" ")}...`.trim();
  }

  return {
    proposedNote: proposed,
    reason: hadMarkup
      ? "HTML/formatting cleaned and long note shortened for route-stop review."
      : "Long note shortened to the first practical sentences without adding new facts.",
    status: "NEEDS_COPY_REVIEW",
  };
}

function areOrdersContinuous(stops: RouteRow["stops"]): boolean {
  return stops.every((stop, index) => stop.order === index + 1);
}

function decideRoute(input: {
  route: RouteRow | null;
  warnings: RouteReviewWarning[];
  stopReviews: RouteReviewStop[];
}): { decision: RouteReviewDecision; blockers: string[] } {
  const blockers: string[] = [];
  const { route, warnings, stopReviews } = input;

  if (!route) {
    return { decision: "BLOCKED", blockers: ["ROUTE_NOT_CREATED"] };
  }
  if (!route.title.trim()) blockers.push("ROUTE_TITLE_EMPTY");
  if (!route.slug.trim()) blockers.push("ROUTE_SLUG_EMPTY");
  if (route.stops.length === 0) blockers.push("ROUTE_HAS_NO_STOPS");
  if (!areOrdersContinuous(route.stops)) blockers.push("ROUTE_STOP_ORDER_NOT_CONTINUOUS");
  if (!route.cityId) blockers.push("ROUTE_CITY_UNRESOLVED");
  if (route.authorId !== null) blockers.push("ROUTE_AUTHOR_NOT_NULL");
  if (warnings.some((warning) => warning.severity === "BLOCKER" || warning.severity === "ERROR")) {
    blockers.push("ROUTE_HAS_CRITICAL_MIGRATION_WARNING");
  }
  if (route.stops.some((stop) => !(stop.customTitle ?? "").trim())) {
    blockers.push("ROUTE_STOP_TITLE_EMPTY");
  }
  // No `isEditorial` schema field, and none is being added: Aliaksei
  // confirmed 2026-07-13 that `authorId === null` is the only editorial
  // marker (matches the existing public reader), so this is never a
  // publication blocker.

  if (blockers.length > 0) return { decision: "BLOCKED", blockers };
  if (stopReviews.some((stop) => stop.reviewStatus === "NEEDS_COPY_REVIEW")) {
    return { decision: "NEEDS_COPY_REVIEW", blockers };
  }
  return { decision: "READY", blockers };
}

export async function buildRouteEditorialReview(
  prisma: RouteReviewPrismaClient,
  now = new Date(),
): Promise<RouteReviewReport> {
  const lineages = (await prisma.migrationLineage.findMany({
    where: { targetType: "ROUTE", isActive: true },
    select: {
      sourceRecordKey: true,
      targetId: true,
      record: { select: { status: true, validationSummary: true } },
    },
    orderBy: { sourceRecordKey: "asc" },
  })) as MigrationLineageRow[];

  const routeIds = lineages
    .map((lineage) => lineage.targetId)
    .filter((id): id is string => Boolean(id?.trim()));

  const routes = (await prisma.route.findMany({
    where: { id: { in: routeIds } },
    select: {
      id: true,
      title: true,
      slug: true,
      cityId: true,
      status: true,
      visibility: true,
      authorId: true,
      stops: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          order: true,
          customTitle: true,
          note: true,
          photoUrl: true,
        },
      },
    },
  })) as RouteRow[];

  const routeById = new Map(routes.map((route) => [route.id, route]));

  const reviewRoutes = lineages.map<RouteReviewItem>((lineage) => {
    const route = lineage.targetId ? routeById.get(lineage.targetId) ?? null : null;
    const warnings = normalizeWarnings(lineage.record?.validationSummary);
    const stopReviews: RouteReviewStop[] = (route?.stops ?? []).map((stop) => {
      const proposal = proposeShortRouteStopNote(stop.note);
      return {
        routeStopId: stop.id,
        order: stop.order,
        title: stop.customTitle,
        sourceNote: stop.note,
        noteLength: stop.note.length,
        hasPhotoUrl: Boolean(stop.photoUrl),
        proposedNote: proposal.proposedNote,
        changeReason: proposal.reason,
        reviewStatus: proposal.status,
      };
    });
    const decision = decideRoute({ route, warnings, stopReviews });
    return {
      sourceRecordKey: lineage.sourceRecordKey,
      legacyWpId: parseLegacyWpId(lineage.sourceRecordKey),
      routeId: route?.id ?? lineage.targetId,
      title: route?.title ?? null,
      slug: route?.slug ?? null,
      cityId: route?.cityId ?? null,
      status: route?.status ?? null,
      visibility: route?.visibility ?? null,
      authorId: route?.authorId ?? null,
      stopCount: route?.stops.length ?? 0,
      stopsWithPhotoUrl: route?.stops.filter((stop) => stop.photoUrl).length ?? 0,
      warnings,
      stops: stopReviews,
      decision: decision.decision,
      blockers: decision.blockers,
    };
  });

  const decisionCounts = emptyDecisionCounts();
  for (const route of reviewRoutes) {
    decisionCounts[route.decision] += 1;
  }

  const globalBlockers: string[] = [];
  if (reviewRoutes.length !== EXPECTED_ROUTE_COUNT) {
    globalBlockers.push(`EXPECTED_14_ROUTES_FOUND_${reviewRoutes.length}`);
  }

  return {
    generatedAt: now.toISOString(),
    expectedRouteCount: EXPECTED_ROUTE_COUNT,
    actualRouteCount: reviewRoutes.length,
    routesCreatedCount: reviewRoutes.filter((route) => route.routeId).length,
    activeLineageCount: lineages.length,
    draftPrivateCount: reviewRoutes.filter((route) => route.status === "DRAFT" && route.visibility === "PRIVATE").length,
    routes: reviewRoutes,
    decisionCounts,
    globalBlockers,
  };
}

export function buildRouteReviewApplyPlan(report: RouteReviewReport): RouteReviewApplyPlan {
  return {
    generatedAt: report.generatedAt,
    expectedRouteCount: report.expectedRouteCount,
    actualRouteCount: report.actualRouteCount,
    decisionCounts: report.decisionCounts,
    globalBlockers: report.globalBlockers,
    routes: report.routes.map((route) => ({
      sourceRecordKey: route.sourceRecordKey,
      routeId: route.routeId,
      decision: route.decision,
      proposed: {
        status: "PUBLISHED",
        visibility: "PUBLIC",
        isEditorial: true,
        authorId: null,
      },
      stopNoteChanges: route.stops
        .filter((stop) => stop.changeReason && stop.proposedNote !== stop.sourceNote)
        .map((stop) => ({
          routeStopId: stop.routeStopId,
          order: stop.order,
          before: stop.sourceNote,
          after: stop.proposedNote,
          reason: stop.changeReason!,
        })),
      blockers: route.blockers,
      warnings: route.warnings,
    })),
  };
}

function mdEscape(value: string | null): string {
  if (!value) return "";
  return value.replace(/\|/g, "\\|").replace(/\n/g, "<br>");
}

export function renderRouteEditorialReviewMarkdown(report: RouteReviewReport): string {
  const lines: string[] = [];
  lines.push("# Route Editorial Review — 2026-07");
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Expected WP routes: ${report.expectedRouteCount}`);
  lines.push(`Active Route lineages: ${report.activeLineageCount}`);
  lines.push(`Routes created: ${report.routesCreatedCount}`);
  lines.push(`DRAFT/PRIVATE routes: ${report.draftPrivateCount}`);
  lines.push("");
  lines.push("## Decision Counts");
  lines.push("");
  lines.push("| Decision | Count |");
  lines.push("| --- | ---: |");
  for (const [decision, count] of Object.entries(report.decisionCounts)) {
    lines.push(`| ${decision} | ${count} |`);
  }
  lines.push("");
  if (report.globalBlockers.length > 0) {
    lines.push("## Global Blockers");
    lines.push("");
    for (const blocker of report.globalBlockers) {
      lines.push(`- ${blocker}`);
    }
    lines.push("");
  }
  lines.push("## Routes");
  lines.push("");

  for (const route of report.routes) {
    lines.push(`### ${route.sourceRecordKey} — ${route.title ?? "(missing route)"}`);
    lines.push("");
    lines.push(`- Legacy WP ID: ${route.legacyWpId ?? "(unknown)"}`);
    lines.push(`- Route ID: ${route.routeId ?? "(missing)"}`);
    lines.push(`- Slug: ${route.slug ?? "(missing)"}`);
    lines.push(`- cityId: ${route.cityId ?? "(null)"}`);
    lines.push(`- status / visibility / authorId: ${route.status ?? "(missing)"} / ${route.visibility ?? "(missing)"} / ${route.authorId ?? "null"}`);
    lines.push(`- Stops: ${route.stopCount} total, ${route.stopsWithPhotoUrl} with photoUrl`);
    lines.push(`- Review decision: ${route.decision}`);
    if (route.blockers.length > 0) {
      lines.push(`- Blockers: ${route.blockers.join("; ")}`);
    }
    if (route.warnings.length > 0) {
      lines.push(`- Warnings: ${route.warnings.map((warning) => `${warning.code} (${warning.severity ?? "UNKNOWN"})`).join(", ")}`);
    } else {
      lines.push("- Warnings: none");
    }
    lines.push("");
    lines.push("| Order | Source title | Source note | Len | Photo | Proposed short note | Reason | Review status |");
    lines.push("| ---: | --- | --- | ---: | --- | --- | --- | --- |");
    for (const stop of route.stops) {
      lines.push(
        `| ${stop.order} | ${mdEscape(stop.title)} | ${mdEscape(stop.sourceNote)} | ${stop.noteLength} | ${stop.hasPhotoUrl ? "yes" : "no"} | ${mdEscape(stop.proposedNote)} | ${mdEscape(stop.changeReason)} | ${stop.reviewStatus} |`,
      );
    }
    lines.push("");
  }

  return `${lines.join("\n").trim()}\n`;
}
