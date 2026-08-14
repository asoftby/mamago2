import type {
  PhoenixExpectedRecord,
  PhoenixPhaseAdapter,
  PhoenixPhaseReport,
  PhoenixRecordResult,
  PhoenixReleasePhase,
} from "./types";
import { exactExecutableKeys } from "./manifest";
import type { PhoenixExecuteOptions } from "./adapters/rerunIdempotency";

export interface ExactRecordExecutor {
  execute(
    sourceRecordKey: string,
    expectedAction: PhoenixExpectedRecord["action"],
    options?: PhoenixExecuteOptions,
  ): Promise<PhoenixRecordResult>;
  reconcile?(phase: PhoenixReleasePhase, results: readonly PhoenixRecordResult[]): Promise<Partial<PhoenixPhaseReport>>;
}

export class SequentialEntityPhaseAdapter implements PhoenixPhaseAdapter {
  /**
   * `alreadyCompleted`, when supplied, must already be a live-DB-verified
   * set (see `continuation.ts`) — records in it are skipped without ever
   * calling `executor.execute()`, so a partially-applied phase can resume
   * exactly where it stopped without re-deriving (and re-failing) a plan
   * for records already proven complete. Every other record still goes
   * through the unmodified fail-closed comparison below.
   */
  constructor(
    private readonly executor: ExactRecordExecutor,
    private readonly alreadyCompleted?: ReadonlySet<string>,
  ) {}

  plan = async (phase: PhoenixReleasePhase): Promise<PhoenixRecordResult[]> =>
    phase.records
      .filter((record) => exactExecutableKeys(phase).includes(record.sourceRecordKey))
      .map((record) => ({
        sourceRecordKey: record.sourceRecordKey,
        action: record.action,
        outcome: record.action === "UPDATE_CONFLICT" ? "PROTECTED_CONFLICT" : "SKIPPED",
      }));

  apply = async (phase: PhoenixReleasePhase): Promise<PhoenixRecordResult[]> => this.runSequential(phase, "APPLY");

  rerun = async (phase: PhoenixReleasePhase): Promise<PhoenixRecordResult[]> => this.runSequential(phase, "RERUN");

  reconcile = async (
    phase: PhoenixReleasePhase,
    results: readonly PhoenixRecordResult[],
  ): Promise<Partial<PhoenixPhaseReport>> => this.executor.reconcile?.(phase, results) ?? {};

  private async runSequential(
    phase: PhoenixReleasePhase,
    mode: NonNullable<PhoenixExecuteOptions["mode"]>,
  ): Promise<PhoenixRecordResult[]> {
    const allowed = new Set(exactExecutableKeys(phase));
    const results: PhoenixRecordResult[] = [];
    for (const record of phase.records) {
      if (!allowed.has(record.sourceRecordKey)) continue;
      if (this.alreadyCompleted?.has(record.sourceRecordKey)) {
        results.push({ sourceRecordKey: record.sourceRecordKey, action: record.action, outcome: "SKIPPED" });
        continue;
      }
      const result = await this.executor.execute(record.sourceRecordKey, record.action, { mode });
      results.push(result);
      if (result.outcome === "FAILED") break;
    }
    return results;
  }
}
