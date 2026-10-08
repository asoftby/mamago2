import type {
  PendingEntityType,
  PendingPostAuthAction,
  PostAuthContext,
} from "./types";

export type SaveFlowPostAuthAction =
  | { action: "ideas" }
  | { action: "plan"; dateISO: string; timeSlotId?: string | null };

export function buildSavePostAuthContext(input: {
  result: SaveFlowPostAuthAction;
  returnTo: string;
  entityId?: string;
  entityType: PendingEntityType;
  title?: string;
  coverImageUrl?: string | null;
}): Omit<PostAuthContext, "createdAt"> {
  const { result, returnTo, entityId, entityType, title, coverImageUrl } = input;
  const source = result.action === "ideas" ? "save_idea" : "save_plan";
  let pendingAction: PendingPostAuthAction = null;

  if (entityId) {
    pendingAction =
      result.action === "ideas"
        ? {
            kind: "save_idea",
            entityType,
            entityId,
            title,
            coverImageUrl,
          }
        : {
            kind: "save_plan",
            entityType,
            entityId,
            plannedDate: result.dateISO,
            timeSlotId: result.timeSlotId,
            title,
            coverImageUrl,
          };
  }

  return {
    source,
    authAction: null,
    pendingAction,
    returnTo,
  };
}
