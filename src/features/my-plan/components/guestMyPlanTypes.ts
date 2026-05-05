export type MyPlanGuestPanelPhase = "empty" | "onboarding" | "generated" | "engaged";

export type MyPlanGuestUiState = MyPlanGuestPanelPhase | "auth_gate";

export function resolveGuestUiState(
  phase: MyPlanGuestPanelPhase,
  authGateVisible: boolean,
): MyPlanGuestUiState {
  if (authGateVisible) return "auth_gate";
  return phase;
}
