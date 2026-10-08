import type {
  ProfileCompletionStepId,
  ProfileStatePayload,
} from "./types";

export type InitialProfileFlowAction =
  | { kind: "finish"; alreadyComplete: true }
  | { kind: "show"; step: ProfileCompletionStepId };

/** Decide once, from the initial server snapshot, whether to open the flow. */
export function resolveInitialProfileFlowAction(
  state: ProfileStatePayload,
): InitialProfileFlowAction {
  if (state.isProfileComplete) {
    return { kind: "finish", alreadyComplete: true };
  }

  return { kind: "show", step: state.resumeStep ?? "adult" };
}

/**
 * In-progress transitions are local UI decisions. A refreshed server snapshot
 * may already call the profile complete because adult role and interests are
 * optional, but it must not dismiss the remaining optional onboarding steps.
 */
export function nextStepAfterAdultSave(): ProfileCompletionStepId {
  return "child";
}

export function nextStepAfterChildSave(): ProfileCompletionStepId {
  return "child_interests";
}

export function nextStepAfterInterests(): ProfileCompletionStepId {
  return "add_more_children";
}
