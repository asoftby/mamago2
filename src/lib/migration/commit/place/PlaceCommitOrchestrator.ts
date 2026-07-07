import { buildPlaceCreateDraft } from "./buildPlaceCreateDraft";
import type { CommitOperation } from "../types";
import type {
  NormalizedPlaceCandidate,
  PlaceCommitBlockReason,
  PlaceCommitWarning,
  PlaceCommitContext,
  PlaceCreateDraft,
} from "./types";

/**
 * The narrowest slice of `PlaceCommitWriter` this orchestrator needs — one
 * method — so its own tests can inject a fake writer without ever touching
 * `PlaceCommitWriterPrismaClient`/Prisma at all. The real `PlaceCommitWriter`
 * instance satisfies this structurally.
 */
export interface PlaceCommitWriterLike {
  createPlaceFromDraft(draft: PlaceCreateDraft): Promise<{ placeId: string; status: "CREATED" }>;
}

export interface ExecutePlaceCommitInput {
  operation: CommitOperation;
  candidate: NormalizedPlaceCandidate;
  context: PlaceCommitContext;
}

export interface ExecutePlaceCommitResult {
  ok: boolean;
  placeId?: string;
  draft?: PlaceCreateDraft;
  warnings?: readonly PlaceCommitWarning[];
  reasonCode?:
    | "UNSUPPORTED_TARGET_TYPE"
    | "UNSUPPORTED_OPERATION_ACTION"
    | "PLACE_CREATE_BLOCKED"
    | "PLACE_CREATE_FAILED";
  blockReasons?: PlaceCommitBlockReason[];
  error?: Error;
}

/**
 * Wires the already-existing pure/build/write pieces into one execution
 * flow for a single Place CREATE operation:
 * `buildPlaceCreateDraft()` -> `PlaceCommitWriter.createPlaceFromDraft()`.
 * No new decisions are made here — createdByUserId validation and
 * category-review warnings already happened in `buildPlaceCreateDraft`
 * (PR8.5), the actual write
 * already happened in `PlaceCommitWriter` (PR9). This class only sequences
 * them and turns every outcome (including a thrown error) into a typed
 * result, never a thrown exception — this is commit orchestration, not a
 * programmer error, and a later batch runner needs to keep going and
 * report on unsupported/blocked/failed operations rather than have one bad
 * operation crash the whole run.
 *
 * No MigrationRun/MigrationRecord/MigrationLineage/MigrationReviewTask/
 * MigrationMediaAsset/MigrationRedirect writes happen here — that's later
 * PRs (lineage writer, record status transitions, review queue).
 */
export class PlaceCommitOrchestrator {
  constructor(private readonly writer: PlaceCommitWriterLike) {}

  async execute(input: ExecutePlaceCommitInput): Promise<ExecutePlaceCommitResult> {
    if (input.operation.targetType !== "PLACE") {
      return { ok: false, reasonCode: "UNSUPPORTED_TARGET_TYPE" };
    }

    // Only CREATE is supported — there is no "update an existing Place"
    // writer yet, so UPDATE (and, defensively, anything else a looser
    // producer might hand us — SKIP_UNCHANGED/SKIP_POLICY/FAIL) must never
    // reach `buildPlaceCreateDraft`/the writer.
    if (input.operation.action !== "CREATE") {
      return { ok: false, reasonCode: "UNSUPPORTED_OPERATION_ACTION" };
    }

    const draftResult = buildPlaceCreateDraft({ candidate: input.candidate, context: input.context });
    if (!draftResult.ok) {
      return {
        ok: false,
        reasonCode: "PLACE_CREATE_BLOCKED",
        blockReasons: [...draftResult.reasons],
      };
    }

    try {
      const writeResult = await this.writer.createPlaceFromDraft(draftResult.draft);
      return { ok: true, placeId: writeResult.placeId, draft: draftResult.draft, warnings: draftResult.warnings };
    } catch (error) {
      return {
        ok: false,
        reasonCode: "PLACE_CREATE_FAILED",
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }
}
