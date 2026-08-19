/**
 * Unified Content Lifecycle — public API surface.
 *
 * Architecture:
 * - lifecycleEffectiveState: normalize storage → effective state
 * - lifecycleStateMachine: declarative transition table
 * - lifecycleActionRegistry: action metadata (labels, dialogs)
 * - lifecycleActionResolver: action verb → HTTP request
 * - resolveLifecycleActions: context → available actions
 * - contentLifecycleViewModel: UI view-model adapter
 */

export * from "./lifecycleTypes";
export * from "./lifecycleEffectiveState";
export * from "./lifecycleStateMachine";
export * from "./lifecycleActionRegistry";
export * from "./lifecycleActionResolver";
export * from "./resolveLifecycleActions";
export * from "./contentLifecycleViewModel";
export * from "./contentLifecycleDialogCopy";
export * from "./buildAdminLifecycleViewModel";
