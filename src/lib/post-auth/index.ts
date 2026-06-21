export type {
  AuthAction,
  AuthEntryPoint,
  PostAuthContext,
  PendingPostAuthAction,
  PendingSaveIdeaAction,
  PendingSavePlanAction,
  PendingEntityType,
  ProfileCompletionStepId,
  ProfileMandatoryStepId,
  ProfileCompletionFlags,
  ProfileStatePayload,
} from "./types";
export {
  savePostAuthContext,
  getPostAuthContext,
  clearPostAuthAction,
  clearPostAuthContext,
} from "./storage";
export {
  computeProfileCompletionFlags,
  resolveResumeStep,
  hasAdultProfile,
  childHasBirthMonthYear,
  childHasInterests,
  getPrimaryChild,
  buildProfileStatePayload,
} from "./profileCompletion";
export { executePendingPostAuthAction } from "./executePendingAction";
export { applyPostAuthCompletionOutcome, trackAuthCompleted } from "./resolver";
export { trackPostAuthEvent } from "./analytics";
export { runPostAuthPipeline } from "./pipeline";
export type { PostAuthPipelineResult, RunPostAuthPipelineOptions } from "./pipeline";
export { mapOldEntryPointToPostAuth } from "./adapterFromOnboarding";
