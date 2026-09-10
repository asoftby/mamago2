export type RoutePublicationAuditDecision = "READY" | string;

export interface RoutePublicationAuditPlanEntry {
  sourceRecordKey: string;
  routeId: string | null;
  decision: RoutePublicationAuditDecision;
}

export interface RoutePublicationAuditRouteRow {
  id: string;
  slug: string;
  status: string;
  visibility: string;
  authorId: string | null;
  seoCanonicalUrl: string | null;
  stopsCount: number;
}

export interface RoutePublicationAuditLineageRow {
  sourceRecordKey: string;
  targetId: string | null;
}

export type RoutePublicationAuditState =
  | "APPROVED_PUBLIC"
  | "APPROVED_RECOVERY_CANDIDATE"
  | "APPROVED_STATE_DRIFT"
  | "BLOCKED_NON_PUBLIC"
  | "BLOCKED_BECAME_PUBLIC"
  | "ROUTE_ID_MISSING"
  | "ROUTE_NOT_FOUND"
  | "LINEAGE_MISSING"
  | "LINEAGE_DUPLICATE"
  | "LINEAGE_TARGET_MISMATCH";

export interface RoutePublicationAuditResultRow {
  sourceRecordKey: string;
  routeId: string | null;
  decision: RoutePublicationAuditDecision;
  state: RoutePublicationAuditState;
  route: RoutePublicationAuditRouteRow | null;
  lineageTargetIds: string[];
}

export interface RoutePublicationAuditSummary {
  expected: number;
  ready: number;
  blocked: number;
  approvedPublic: number;
  approvedRecoveryCandidates: number;
  approvedStateDrift: number;
  blockedBecamePublic: number;
  missingRoutes: number;
  lineageProblems: number;
}

export interface RoutePublicationAuditResult {
  summary: RoutePublicationAuditSummary;
  routes: RoutePublicationAuditResultRow[];
}

function classifyEntry(
  entry: RoutePublicationAuditPlanEntry,
  route: RoutePublicationAuditRouteRow | null,
  lineageTargetIds: string[],
): RoutePublicationAuditState {
  if (!entry.routeId) return "ROUTE_ID_MISSING";
  if (lineageTargetIds.length === 0) return "LINEAGE_MISSING";
  if (lineageTargetIds.length > 1) return "LINEAGE_DUPLICATE";
  if (lineageTargetIds[0] !== entry.routeId) return "LINEAGE_TARGET_MISMATCH";
  if (!route) return "ROUTE_NOT_FOUND";

  const isPublic = route.status === "PUBLISHED" && route.visibility === "PUBLIC";
  if (entry.decision !== "READY") {
    return isPublic ? "BLOCKED_BECAME_PUBLIC" : "BLOCKED_NON_PUBLIC";
  }

  if (isPublic && route.authorId === null) return "APPROVED_PUBLIC";
  if (
    route.status === "DRAFT" &&
    route.visibility === "PRIVATE" &&
    route.authorId === null
  ) {
    return "APPROVED_RECOVERY_CANDIDATE";
  }
  return "APPROVED_STATE_DRIFT";
}

export function buildRoutePublicationAudit(params: {
  planEntries: RoutePublicationAuditPlanEntry[];
  routes: RoutePublicationAuditRouteRow[];
  lineages: RoutePublicationAuditLineageRow[];
}): RoutePublicationAuditResult {
  const routeById = new Map(params.routes.map((route) => [route.id, route]));
  const lineageByKey = new Map<string, string[]>();
  for (const lineage of params.lineages) {
    const current = lineageByKey.get(lineage.sourceRecordKey) ?? [];
    if (lineage.targetId) current.push(lineage.targetId);
    lineageByKey.set(lineage.sourceRecordKey, current);
  }

  const rows = params.planEntries.map((entry): RoutePublicationAuditResultRow => {
    const route = entry.routeId ? routeById.get(entry.routeId) ?? null : null;
    const lineageTargetIds = lineageByKey.get(entry.sourceRecordKey) ?? [];
    return {
      sourceRecordKey: entry.sourceRecordKey,
      routeId: entry.routeId,
      decision: entry.decision,
      state: classifyEntry(entry, route, lineageTargetIds),
      route,
      lineageTargetIds,
    };
  });

  const count = (state: RoutePublicationAuditState) =>
    rows.filter((row) => row.state === state).length;
  const ready = params.planEntries.filter((entry) => entry.decision === "READY").length;

  return {
    summary: {
      expected: params.planEntries.length,
      ready,
      blocked: params.planEntries.length - ready,
      approvedPublic: count("APPROVED_PUBLIC"),
      approvedRecoveryCandidates: count("APPROVED_RECOVERY_CANDIDATE"),
      approvedStateDrift: count("APPROVED_STATE_DRIFT"),
      blockedBecamePublic: count("BLOCKED_BECAME_PUBLIC"),
      missingRoutes: count("ROUTE_NOT_FOUND") + count("ROUTE_ID_MISSING"),
      lineageProblems:
        count("LINEAGE_MISSING") +
        count("LINEAGE_DUPLICATE") +
        count("LINEAGE_TARGET_MISMATCH"),
    },
    routes: rows,
  };
}
