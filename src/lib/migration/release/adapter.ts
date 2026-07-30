import type {
  PhoenixExpectedRecord,
  PhoenixPhaseAdapter,
  PhoenixPhaseReport,
  PhoenixRecordResult,
  PhoenixReleasePhase,
} from "./types";
import { exactExecutableKeys } from "./manifest";

export interface ExactRecordExecutor {
  execute(sourceRecordKey: string, expectedAction: PhoenixExpectedRecord["action"]): Promise<PhoenixRecordResult>;
  reconcile?(phase: PhoenixReleasePhase, results: readonly PhoenixRecordResult[]): Promise<Partial<PhoenixPhaseReport>>;
}

export class SequentialEntityPhaseAdapter implements PhoenixPhaseAdapter {
  constructor(private readonly executor: ExactRecordExecutor) {}

  plan = async (phase: PhoenixReleasePhase): Promise<PhoenixRecordResult[]> =>
    phase.records
      .filter((record) => exactExecutableKeys(phase).includes(record.sourceRecordKey))
      .map((record) => ({
        sourceRecordKey: record.sourceRecordKey,
        action: record.action,
        outcome: record.action === "UPDATE_CONFLICT" ? "PROTECTED_CONFLICT" : "SKIPPED",
      }));

  apply = async (phase: PhoenixReleasePhase): Promise<PhoenixRecordResult[]> => this.runSequential(phase);

  rerun = async (phase: PhoenixReleasePhase): Promise<PhoenixRecordResult[]> => this.runSequential(phase);

  reconcile = async (
    phase: PhoenixReleasePhase,
    results: readonly PhoenixRecordResult[],
  ): Promise<Partial<PhoenixPhaseReport>> => this.executor.reconcile?.(phase, results) ?? {};

  private async runSequential(phase: PhoenixReleasePhase): Promise<PhoenixRecordResult[]> {
    const allowed = new Set(exactExecutableKeys(phase));
    const results: PhoenixRecordResult[] = [];
    for (const record of phase.records) {
      if (!allowed.has(record.sourceRecordKey)) continue;
      const result = await this.executor.execute(record.sourceRecordKey, record.action);
      results.push(result);
      if (result.outcome === "FAILED") break;
    }
    return results;
  }
}
