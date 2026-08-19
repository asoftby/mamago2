import type { CanonicalCtaObject } from "./types";

export type ExecutionStrategyKind =
  | "NO_RUNTIME"
  | "BOOKING_RUNTIME"
  | "EXTERNAL_RUNTIME";

export interface ExecutionStrategy {
  kind: ExecutionStrategyKind;
  runtime: "NONE" | "BOOKING" | "EXTERNAL";
  requiresUserInput: boolean;
}

export function resolveExecutionStrategy(
  cta: Pick<CanonicalCtaObject, "actionKind" | "executionKind" | "requestConfig">,
): ExecutionStrategy {
  if (cta.actionKind === "REQUEST") {
    return {
      kind: "BOOKING_RUNTIME",
      runtime: "BOOKING",
      requiresUserInput: cta.requestConfig?.selectionMode !== "NONE",
    };
  }

  if (cta.actionKind === "EXTERNAL") {
    return {
      kind: "EXTERNAL_RUNTIME",
      runtime: "EXTERNAL",
      requiresUserInput: false,
    };
  }

  return {
    kind: "NO_RUNTIME",
    runtime: "NONE",
    requiresUserInput: false,
  };
}
