import { buildEventCreateDraft } from "./buildEventCreateDraft";
import type { CommitOperation } from "../types";
import type {
  EventCommitBlockReason,
  EventCommitContext,
  EventCreateDraft,
  NormalizedEventCandidate,
} from "./types";

export interface EventCommitWriterLike {
  createEventFromDraft(draft: EventCreateDraft): Promise<{ activityId: string; status: "CREATED" }>;
}

export interface ExecuteEventCommitInput {
  operation: CommitOperation;
  candidate: NormalizedEventCandidate;
  context: EventCommitContext;
}

export interface ExecuteEventCommitResult {
  ok: boolean;
  activityId?: string;
  draft?: EventCreateDraft;
  reasonCode?:
    | "UNSUPPORTED_TARGET_TYPE"
    | "UNSUPPORTED_OPERATION_ACTION"
    | "EVENT_CREATE_BLOCKED"
    | "EVENT_CREATE_FAILED";
  blockReasons?: EventCommitBlockReason[];
  error?: Error;
}

/**
 * Sequences PR17/PR18 into the first working Event commit step:
 * `buildEventCreateDraft()` -> `EventCommitWriter.createEventFromDraft()`.
 * Only `targetType: "ACTIVITY"` + `action: "CREATE"` are supported —
 * `UPDATE`/`SKIP_UNCHANGED`/`SKIP_POLICY`/`FAIL` are all unsupported for
 * now, exactly like `PlaceCommitOrchestrator` (PR10) before it. No
 * lineage, no `MigrationRecord`, no rollback — that's PR20.
 */
export class EventCommitOrchestrator {
  constructor(private readonly writer: EventCommitWriterLike) {}

  async execute(input: ExecuteEventCommitInput): Promise<ExecuteEventCommitResult> {
    if (input.operation.targetType !== "ACTIVITY") {
      return { ok: false, reasonCode: "UNSUPPORTED_TARGET_TYPE" };
    }
    if (input.operation.action !== "CREATE") {
      return { ok: false, reasonCode: "UNSUPPORTED_OPERATION_ACTION" };
    }

    const draftResult = buildEventCreateDraft({ candidate: input.candidate, context: input.context });
    if (!draftResult.ok) {
      return { ok: false, reasonCode: "EVENT_CREATE_BLOCKED", blockReasons: [...draftResult.reasons] };
    }

    try {
      const writeResult = await this.writer.createEventFromDraft(draftResult.draft);
      return { ok: true, activityId: writeResult.activityId, draft: draftResult.draft };
    } catch (error) {
      return {
        ok: false,
        reasonCode: "EVENT_CREATE_FAILED",
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }
}
