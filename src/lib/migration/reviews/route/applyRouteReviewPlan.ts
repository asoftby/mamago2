import type { PrismaClient } from "@prisma/client";

import type { RouteReviewApplyPlan, RouteReviewApplyPlanRoute } from "./routeEditorialReview";

export interface ApplyRouteReviewPlanOptions {
  apply: boolean;
  sourceRecordKey?: string;
}

export interface ApplyRouteReviewPlanRouteResult {
  sourceRecordKey: string;
  routeId: string | null;
  status: "DRY_RUN" | "APPLIED" | "SKIPPED" | "FAILED";
  reason?: string;
  changes: string[];
}

export interface ApplyRouteReviewPlanResult {
  applied: boolean;
  routes: ApplyRouteReviewPlanRouteResult[];
}

export interface ApplyRouteReviewPrismaClient {
  route: Pick<PrismaClient["route"], "findUnique" | "update">;
  routeStop: Pick<PrismaClient["routeStop"], "findMany" | "update">;
  $transaction: PrismaClient["$transaction"];
}

type RouteBefore = {
  id: string;
  status: string;
  visibility: string;
  authorId: string | null;
};

type RouteStopBefore = {
  id: string;
  note: string;
};

function filterRoutes(
  plan: RouteReviewApplyPlan,
  sourceRecordKey?: string,
): RouteReviewApplyPlanRoute[] {
  if (!sourceRecordKey) return [...plan.routes];
  return plan.routes.filter((route) => route.sourceRecordKey === sourceRecordKey);
}

function buildSkipped(route: RouteReviewApplyPlanRoute, reason: string): ApplyRouteReviewPlanRouteResult {
  return {
    sourceRecordKey: route.sourceRecordKey,
    routeId: route.routeId,
    status: "SKIPPED",
    reason,
    changes: [],
  };
}

function describeChanges(route: RouteReviewApplyPlanRoute): string[] {
  const changes = [
    "Route.status DRAFT -> PUBLISHED",
    "Route.visibility PRIVATE -> PUBLIC",
    "Route.authorId remains null",
  ];
  for (const change of route.stopNoteChanges) {
    changes.push(`RouteStop ${change.routeStopId} note update (${change.before.length} -> ${change.after.length} chars)`);
  }
  return changes;
}

function assertReadyRoute(route: RouteReviewApplyPlanRoute): string | null {
  if (!route.routeId) return "ROUTE_ID_MISSING";
  if (route.decision !== "READY") return `DECISION_${route.decision}`;
  if (route.blockers.length > 0) return "ROUTE_HAS_BLOCKERS";
  return null;
}

function assertRouteBefore(route: RouteReviewApplyPlanRoute, before: RouteBefore | null): string | null {
  if (!before) return "ROUTE_NOT_FOUND";
  if (before.status !== "DRAFT") return `ROUTE_STATUS_CHANGED:${before.status}`;
  if (before.visibility !== "PRIVATE") return `ROUTE_VISIBILITY_CHANGED:${before.visibility}`;
  if (before.authorId !== null) return "ROUTE_AUTHOR_CHANGED";
  return null;
}

function assertStopBefore(
  route: RouteReviewApplyPlanRoute,
  stops: readonly RouteStopBefore[],
): string | null {
  const beforeById = new Map(stops.map((stop) => [stop.id, stop.note]));
  for (const change of route.stopNoteChanges) {
    const before = beforeById.get(change.routeStopId);
    if (before === undefined) return `ROUTE_STOP_NOT_FOUND:${change.routeStopId}`;
    if (before !== change.before) return `ROUTE_STOP_NOTE_CHANGED:${change.routeStopId}`;
  }
  return null;
}

async function applyOneRoute(
  prisma: ApplyRouteReviewPrismaClient,
  route: RouteReviewApplyPlanRoute,
  apply: boolean,
): Promise<ApplyRouteReviewPlanRouteResult> {
  const readyError = assertReadyRoute(route);
  if (readyError) return buildSkipped(route, readyError);

  const routeId = route.routeId!;
  const routeBefore = (await prisma.route.findUnique({
    where: { id: routeId },
    select: { id: true, status: true, visibility: true, authorId: true },
  })) as RouteBefore | null;

  const routeBeforeError = assertRouteBefore(route, routeBefore);
  if (routeBeforeError) return buildSkipped(route, routeBeforeError);

  const stopIds = route.stopNoteChanges.map((change) => change.routeStopId);
  const stopBefore = stopIds.length
    ? ((await prisma.routeStop.findMany({
        where: { id: { in: stopIds }, routeId },
        select: { id: true, note: true },
      })) as RouteStopBefore[])
    : [];
  const stopBeforeError = assertStopBefore(route, stopBefore);
  if (stopBeforeError) return buildSkipped(route, stopBeforeError);

  const changes = describeChanges(route);
  if (!apply) {
    return {
      sourceRecordKey: route.sourceRecordKey,
      routeId,
      status: "DRY_RUN",
      changes,
    };
  }

  await prisma.$transaction(async (tx) => {
    const txRoute = (await tx.route.findUnique({
      where: { id: routeId },
      select: { id: true, status: true, visibility: true, authorId: true },
    })) as RouteBefore | null;
    const txRouteError = assertRouteBefore(route, txRoute);
    if (txRouteError) throw new Error(txRouteError);

    if (stopIds.length > 0) {
      const txStops = (await tx.routeStop.findMany({
        where: { id: { in: stopIds }, routeId },
        select: { id: true, note: true },
      })) as RouteStopBefore[];
      const txStopError = assertStopBefore(route, txStops);
      if (txStopError) throw new Error(txStopError);
    }

    for (const change of route.stopNoteChanges) {
      if (change.before !== change.after) {
        await tx.routeStop.update({
          where: { id: change.routeStopId },
          data: { note: change.after },
        });
      }
    }

    await tx.route.update({
      where: { id: routeId },
      data: {
        status: route.proposed.status,
        visibility: route.proposed.visibility,
        authorId: route.proposed.authorId,
      },
    });
  });

  return {
    sourceRecordKey: route.sourceRecordKey,
    routeId,
    status: "APPLIED",
    changes,
  };
}

export async function applyRouteReviewPlan(
  prisma: ApplyRouteReviewPrismaClient,
  plan: RouteReviewApplyPlan,
  options: ApplyRouteReviewPlanOptions,
): Promise<ApplyRouteReviewPlanResult> {
  const routes = filterRoutes(plan, options.sourceRecordKey);
  if (options.sourceRecordKey && routes.length === 0) {
    return {
      applied: options.apply,
      routes: [
        {
          sourceRecordKey: options.sourceRecordKey,
          routeId: null,
          status: "FAILED",
          reason: "SOURCE_RECORD_KEY_NOT_IN_PLAN",
          changes: [],
        },
      ],
    };
  }

  const results: ApplyRouteReviewPlanRouteResult[] = [];
  for (const route of routes) {
    results.push(await applyOneRoute(prisma, route, options.apply));
  }

  return { applied: options.apply, routes: results };
}
