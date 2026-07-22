import type { MigrationRecord } from "@prisma/client";

import type { MigrationExecutionCandidate } from "../../core/orchestrator";
import type { MigrationPlanItem } from "../../types";
import type { CommitOperation } from "../types";
import type { NormalizedArticleCandidate } from "../article/buildArticleCreateDraft";
import type {
  ExecuteArticleCommitRunInput,
  ExecuteArticleCommitRunResult,
} from "../article/ArticleCommitRunner";
import type { ArticleCommitContext } from "../article/buildArticleCreateDraft";
import type { NormalizedEventCandidate } from "../event/types";
import type { ExecuteEventCommitRunInput, ExecuteEventCommitRunResult } from "../event/EventCommitRunner";
import type { EventCommitContext } from "../event/types";
import type { NormalizedPlaceCandidate } from "../place/types";
import type { ExecutePlaceCommitRunInput, ExecutePlaceCommitRunResult } from "../place/PlaceCommitRunner";
import type { PlaceCommitContext } from "../place/types";
import type { NormalizedRouteCandidate, RouteCommitContext } from "../route/buildRouteCreateDraft";
import type { ExecuteRouteCommitRunInput, ExecuteRouteCommitRunResult } from "../route/RouteCommitRunner";
import type { NormalizedOfferCandidate } from "../../adapters/wordpress-db/normalizeOffer";
import type { OfferCommitContext } from "../offer/types";
import type { ExecuteOfferCommitRunInput, ExecuteOfferCommitRunResult } from "../offer/OfferCommitRunner";

/** Narrow enough that the real `PlaceCommitRunner` (PR12) satisfies this unchanged. */
export interface PlaceCommitRunnerLike {
  execute(input: ExecutePlaceCommitRunInput): Promise<ExecutePlaceCommitRunResult>;
}

/** Narrow enough that the real `EventCommitRunner` (PR20) satisfies this unchanged. */
export interface EventCommitRunnerLike {
  execute(input: ExecuteEventCommitRunInput): Promise<ExecuteEventCommitRunResult>;
}

/** Narrow enough that the real `ArticleCommitRunner` (PR24) satisfies this unchanged. */
export interface ArticleCommitRunnerLike {
  execute(input: ExecuteArticleCommitRunInput): Promise<ExecuteArticleCommitRunResult>;
}

/** Narrow enough that the real `RouteCommitRunner` satisfies this unchanged. */
export interface RouteCommitRunnerLike {
  execute(input: ExecuteRouteCommitRunInput): Promise<ExecuteRouteCommitRunResult>;
}
export interface OfferCommitRunnerLike { execute(input: ExecuteOfferCommitRunInput): Promise<ExecuteOfferCommitRunResult> }

export type CommitDispatchTargetType = "PLACE" | "ACTIVITY" | "ARTICLE" | "ROUTE" | "OFFER";

export interface DispatchCommitRunnerInput {
  executionCandidate: MigrationExecutionCandidate;
  /**
   * The already-resolved context for this candidate's targetType (e.g.
   * `resolveCommitContextForExecutionCandidate()`'s `ok:true` `.context`,
   * unwrapped by the caller) — never the wrapped `ResolveCommitContextResult`
   * union. Keeping this as a plain context object means `targetType` has
   * exactly one source of truth (`executionCandidate.planItem.targetType`),
   * not two values that could disagree; this dispatcher never calls the
   * PR26 resolver itself.
   */
  resolvedContext: PlaceCommitContext | EventCommitContext | ArticleCommitContext | RouteCommitContext | OfferCommitContext;
  migrationRecord: MigrationRecord;
  runners: {
    place?: PlaceCommitRunnerLike;
    event?: EventCommitRunnerLike;
    article?: ArticleCommitRunnerLike;
    route?: RouteCommitRunnerLike;
    offer?: OfferCommitRunnerLike;
  };
}

export type CommitDispatchResult =
  | { ok: true; targetType: CommitDispatchTargetType; targetId: string; lineageId?: string; status: "LINKED" }
  | {
      ok: false;
      targetType?: CommitDispatchTargetType;
      status: "FAILED";
      errorCode: string;
      errorMessage: string;
    };

/**
 * `CommitOperation` requires `recordId`/`order`/`dependsOn`/`rollbackSteps`
 * — none of which exist on `MigrationPlanItem` (verified against
 * `commit/types.ts` and `types/index.ts` before writing this file; the
 * PR27 prompt's sketch mentioned `sourceEntityType`/`sourceStableKey`/
 * `sourceId`/`sourceHash` as `CommitOperation` fields, but none of those
 * exist on the real type either — `CommitOperation` only has `recordId`,
 * `sourceRecordKey`, `targetType`, `action`, `order`, `dependsOn`,
 * `rollbackSteps`). This dispatcher builds a single-record operation, not
 * a full batch execution plan (that's PR8's `buildCommitExecutionPlan`),
 * so `recordId` comes from the real `migrationRecord.id`, and
 * `order`/`dependsOn`/`rollbackSteps` are minimal, single-operation
 * defaults (`0`/`[]`/`[]`) — not invented business data, just the only
 * sensible values for an operation that isn't part of a larger batch.
 *
 * `planItem.action`'s real type is the full `MigrationPlanAction` union
 * (including `SKIP_UNCHANGED`/`SKIP_POLICY`/`FAIL`/etc.), narrower than
 * `CommitOperation.action`'s `"CREATE" | "UPDATE"`. A genuinely invalid
 * action reaching a runner is already rejected by that runner's own
 * orchestrator layer (`UNSUPPORTED_OPERATION_ACTION`, tested in PR10/19)
 * — this dispatcher doesn't re-implement that check, it just passes the
 * value through and lets the existing, already-tested guard do its job.
 */
function buildCommitOperation(planItem: MigrationPlanItem, migrationRecord: MigrationRecord): CommitOperation {
  return {
    recordId: migrationRecord.id,
    sourceRecordKey: planItem.sourceRecordKey,
    targetType: planItem.targetType as CommitOperation["targetType"],
    action: planItem.action as CommitOperation["action"],
    order: 0,
    dependsOn: [],
    rollbackSteps: [],
  };
}

function missingRunnerResult(targetType: CommitDispatchTargetType): CommitDispatchResult {
  return {
    ok: false,
    targetType,
    status: "FAILED",
    errorCode: "MISSING_COMMIT_RUNNER",
    errorMessage: `No runner was provided for targetType "${targetType}".`,
  };
}

/**
 * Normalizes a `PlaceCommitRunner`/`EventCommitRunner` result (which uses
 * `reasonCode?: string` + `error?: Error`, and a `"LINKED"|"FAILED"|"BLOCKED"`
 * status) into `CommitDispatchResult`. The PR27 prompt referred to this
 * field as `result.errorCode` — the real field on both runners' results is
 * `reasonCode`, used here instead. `BLOCKED` and `FAILED` both collapse
 * into the normalized `"FAILED"` status — the dispatcher's job is to give
 * every entity type one shape, not to preserve a distinction only Place/
 * Event's runners make.
 */
function normalizePlaceOrEventResult(
  targetType: "PLACE" | "ACTIVITY",
  result: { ok: boolean; targetId: string | undefined; lineageId?: string; status: string; reasonCode?: string; error?: Error },
): CommitDispatchResult {
  if (result.ok) {
    return {
      ok: true,
      targetType,
      targetId: result.targetId as string,
      lineageId: result.lineageId,
      status: "LINKED",
    };
  }

  const errorCode = result.reasonCode ?? `${targetType}_COMMIT_${result.status}`;
  const errorMessage = result.error
    ? result.error.message
    : `${targetType} commit ${result.status.toLowerCase()}${result.reasonCode ? ` (${result.reasonCode})` : ""}.`;

  return { ok: false, targetType, status: "FAILED", errorCode, errorMessage };
}

function normalizeArticleResult(result: ExecuteArticleCommitRunResult): CommitDispatchResult {
  if (result.ok) {
    return {
      ok: true,
      targetType: "ARTICLE",
      targetId: result.articleId as string,
      lineageId: result.lineageId,
      status: "LINKED",
    };
  }

  return {
    ok: false,
    targetType: "ARTICLE",
    status: "FAILED",
    errorCode: result.errorCode ?? "ARTICLE_COMMIT_FAILED",
    errorMessage: result.errorMessage ?? "Article commit failed for an unknown reason.",
  };
}

function normalizeRouteResult(result: ExecuteRouteCommitRunResult): CommitDispatchResult {
  if (result.ok) {
    return {
      ok: true,
      targetType: "ROUTE",
      targetId: result.routeId as string,
      lineageId: result.lineageId,
      status: "LINKED",
    };
  }

  return {
    ok: false,
    targetType: "ROUTE",
    status: "FAILED",
    errorCode: result.reasonCode ?? "ROUTE_COMMIT_FAILED",
    errorMessage: result.error?.message ?? "Route commit failed for an unknown reason.",
  };
}

/**
 * Picks the runner matching `executionCandidate.planItem.targetType`
 * (PLACE -> `PlaceCommitRunner`, ACTIVITY -> `EventCommitRunner`, ARTICLE
 * -> `ArticleCommitRunner`), calls it with the shape it actually expects
 * (Place/Event: `{operation, record, candidate, context}`; Article:
 * `{operation, candidate, context, migrationRecord}`),
 * and normalizes whichever result comes back into one
 * `CommitDispatchResult` shape.
 *
 * Never calls `resolveCommitContextForExecutionCandidate()`, never reads a
 * config, never creates a `MigrationRecord`, never calls `persistPlan()`,
 * no DB orchestration beyond whatever the injected runner itself does, no
 * CLI. Runner classes and their public signatures are untouched — this
 * file only imports their types.
 */
export async function dispatchCommitRunner(input: DispatchCommitRunnerInput): Promise<CommitDispatchResult> {
  const { executionCandidate, resolvedContext, migrationRecord, runners } = input;
  const targetType = executionCandidate.planItem.targetType;

  if (targetType === "PLACE") {
    if (!runners.place) return missingRunnerResult("PLACE");
    const result = await runners.place.execute({
      operation: buildCommitOperation(executionCandidate.planItem, migrationRecord),
      record: migrationRecord,
      candidate: executionCandidate.candidate as NormalizedPlaceCandidate,
      context: resolvedContext as PlaceCommitContext,
    });
    return normalizePlaceOrEventResult("PLACE", { ...result, targetId: result.placeId });
  }

  if (targetType === "ACTIVITY") {
    if (!runners.event) return missingRunnerResult("ACTIVITY");
    const result = await runners.event.execute({
      operation: buildCommitOperation(executionCandidate.planItem, migrationRecord),
      record: migrationRecord,
      candidate: executionCandidate.candidate as NormalizedEventCandidate,
      context: resolvedContext as EventCommitContext,
    });
    return normalizePlaceOrEventResult("ACTIVITY", { ...result, targetId: result.activityId });
  }

  if (targetType === "ARTICLE") {
    if (!runners.article) return missingRunnerResult("ARTICLE");
    const result = await runners.article.execute({
      operation: buildCommitOperation(executionCandidate.planItem, migrationRecord),
      candidate: executionCandidate.candidate as NormalizedArticleCandidate,
      context: resolvedContext as ArticleCommitContext,
      migrationRecord,
    });
    return normalizeArticleResult(result);
  }

  if (targetType === "ROUTE") {
    if (!runners.route) return missingRunnerResult("ROUTE");
    const result = await runners.route.execute({
      operation: buildCommitOperation(executionCandidate.planItem, migrationRecord),
      record: migrationRecord,
      candidate: executionCandidate.candidate as NormalizedRouteCandidate,
      context: resolvedContext as RouteCommitContext,
    });
    return normalizeRouteResult(result);
  }

  if (targetType === "OFFER") {
    if (!runners.offer) return missingRunnerResult("OFFER");
    const result = await runners.offer.execute({ operation: buildCommitOperation(executionCandidate.planItem, migrationRecord), candidate: executionCandidate.candidate as NormalizedOfferCandidate, context: resolvedContext as OfferCommitContext, migrationRecord });
    if (result.ok) return { ok: true, targetType: "OFFER", targetId: result.offerId, lineageId: result.lineageId, status: "LINKED" };
    return { ok: false, targetType: "OFFER", status: "FAILED", errorCode: result.errorCode, errorMessage: result.errorMessage };
  }

  return {
    ok: false,
    status: "FAILED",
    errorCode: "UNKNOWN_TARGET_TYPE",
    errorMessage: `No commit runner dispatch is defined for targetType "${targetType ?? "(none)"}".`,
  };
}
