import type {
  RunCommitExecutionPlanCandidateResult,
  RunCommitExecutionPlanSummary,
} from "../src/lib/migration/commit/harness/runCommitExecutionPlan";

export function formatCommitResultDetail(
  result: Pick<RunCommitExecutionPlanCandidateResult, "outcome" | "errorCode" | "errorMessage">,
): string {
  if (result.outcome !== "FAILED") return "";

  if (result.errorMessage) {
    return result.errorCode
      ? ` — ${result.errorCode}: ${result.errorMessage}`
      : ` — ${result.errorMessage}`;
  }

  if (result.errorCode) {
    return ` — ${result.errorCode}`;
  }

  return "";
}

export function formatCommitResultLine(
  result: RunCommitExecutionPlanCandidateResult,
  extras?: { targetId?: boolean; lineageId?: boolean },
): string {
  const target = extras?.targetId && result.targetId ? ` targetId=${result.targetId}` : "";
  const lineage = extras?.lineageId && result.lineageId ? ` lineageId=${result.lineageId}` : "";
  const detail = formatCommitResultDetail(result);
  return `- ${result.sourceRecordKey}: ${result.outcome}${target}${lineage}${detail}`;
}

export function printCommitExecutionCounters(summary: RunCommitExecutionPlanSummary): void {
  console.log(`Total: ${summary.total}`);
  console.log(`Linked: ${summary.linked}`);
  console.log(`Failed: ${summary.failed}`);
  console.log(`Skipped: ${summary.skipped}`);
}
