import { buildRouteCreateDraft } from "./buildRouteCreateDraft";
import type { CommitOperation } from "../types";
import type {
  RouteCommitBlockReason,
  RouteCommitContext,
  RouteCreateDraft,
  NormalizedRouteCandidate,
} from "./buildRouteCreateDraft";
import type { MigrationWarning } from "../../types";

export interface RouteCommitWriterLike {
  createRouteFromDraft(draft: RouteCreateDraft): Promise<{ routeId: string; status: "CREATED" | "UPDATED"; slug: string }>;
  updateRouteFromDraft(routeId: string, draft: RouteCreateDraft): Promise<{ routeId: string; status: "UPDATED"; slug: string }>;
}

export interface ExecuteRouteCommitInput {
  operation: CommitOperation;
  candidate: NormalizedRouteCandidate;
  context: RouteCommitContext;
  targetRouteId?: string | null;
}

export interface ExecuteRouteCommitResult {
  ok: boolean;
  routeId?: string;
  draft?: RouteCreateDraft;
  warnings?: readonly MigrationWarning[];
  reasonCode?:
    | "UNSUPPORTED_TARGET_TYPE"
    | "UNSUPPORTED_OPERATION_ACTION"
    | "ROUTE_CREATE_BLOCKED"
    | "ROUTE_CREATE_FAILED"
    | "ROUTE_UPDATE_TARGET_MISSING";
  blockReasons?: RouteCommitBlockReason[];
  error?: Error;
}

/**
 * Route commit sequencing: builder -> writer. Business decisions stay in
 * the builder; DB details stay in the writer; lineage and record status
 * stay in RouteCommitRunner.
 */
export class RouteCommitOrchestrator {
  constructor(private readonly writer: RouteCommitWriterLike) {}

  async execute(input: ExecuteRouteCommitInput): Promise<ExecuteRouteCommitResult> {
    if (input.operation.targetType !== "ROUTE") {
      return { ok: false, reasonCode: "UNSUPPORTED_TARGET_TYPE" };
    }
    const action = input.operation.action;
    if (action !== "CREATE" && action !== "UPDATE") {
      return { ok: false, reasonCode: "UNSUPPORTED_OPERATION_ACTION" };
    }
    if (action === "UPDATE" && !input.targetRouteId?.trim()) {
      return {
        ok: false,
        reasonCode: "ROUTE_UPDATE_TARGET_MISSING",
        error: new Error("Route UPDATE requires an existing targetRouteId from MigrationLineage."),
      };
    }

    const draftResult = buildRouteCreateDraft({
      candidate: input.candidate,
      context: input.context,
      sourceRecordKey: input.operation.sourceRecordKey,
    });
    if (!draftResult.ok) {
      return { ok: false, reasonCode: "ROUTE_CREATE_BLOCKED", blockReasons: [...draftResult.reasons] };
    }

    try {
      const writeResult =
        action === "UPDATE"
          ? await this.writer.updateRouteFromDraft(input.targetRouteId!, draftResult.draft)
          : await this.writer.createRouteFromDraft(draftResult.draft);
      return {
        ok: true,
        routeId: writeResult.routeId,
        draft: draftResult.draft,
        warnings: draftResult.warnings,
      };
    } catch (error) {
      return {
        ok: false,
        reasonCode: "ROUTE_CREATE_FAILED",
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }
}
