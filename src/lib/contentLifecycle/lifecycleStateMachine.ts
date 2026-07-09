import type {
  LifecycleActionId,
  LifecycleActorRole,
  LifecycleContentType,
  LifecycleEffectiveState,
  LifecycleSurface,
} from "./lifecycleTypes";

export type LifecycleTransitionDef = {
  actionId: LifecycleActionId;
  /** Resulting effective state when transition succeeds (informational). */
  toState?: LifecycleEffectiveState;
  /** Roles allowed to see/trigger this action on this surface. Empty = any authenticated actor on surface. */
  roles?: LifecycleActorRole[];
  /** Backend must expose endpoint for this surface+type combo. */
  endpointImplemented: boolean;
};

type SurfaceTransitionMap = Partial<
  Record<LifecycleSurface, LifecycleTransitionDef[]>
>;

type ContentTypeTransitionMap = Record<
  LifecycleEffectiveState,
  SurfaceTransitionMap
>;

/**
 * Declarative transition table — the state machine contract.
 * UI, view-model and policy checks derive allowed actions from here.
 */
export const LIFECYCLE_TRANSITIONS: Record<
  LifecycleContentType,
  ContentTypeTransitionMap
> = {
  place: {
    draft: {
      admin: [
        { actionId: "deleteDraft", toState: "deleted", endpointImplemented: true },
      ],
      business: [
        {
          actionId: "submitForModeration",
          toState: "pending",
          endpointImplemented: true,
        },
        {
          actionId: "publish",
          toState: "published",
          roles: ["ADMIN", "MODERATOR"],
          endpointImplemented: true,
        },
        { actionId: "deleteDraft", toState: "deleted", endpointImplemented: true },
      ],
      moderation: [
        { actionId: "approve", toState: "published", endpointImplemented: true },
        { actionId: "reject", toState: "rejected", endpointImplemented: true },
        {
          actionId: "requestChanges",
          toState: "needsRevision",
          endpointImplemented: true,
        },
      ],
    },
    pending: {
      admin: [
        { actionId: "archive", toState: "archived", endpointImplemented: true },
      ],
      business: [
        {
          actionId: "withdrawFromModeration",
          toState: "draft",
          endpointImplemented: false,
        },
      ],
      moderation: [
        { actionId: "approve", toState: "published", endpointImplemented: true },
        { actionId: "reject", toState: "rejected", endpointImplemented: true },
        {
          actionId: "requestChanges",
          toState: "needsRevision",
          endpointImplemented: true,
        },
      ],
    },
    published: {
      admin: [
        { actionId: "archive", toState: "archived", endpointImplemented: true },
      ],
      business: [
        { actionId: "archive", toState: "archived", endpointImplemented: true },
      ],
    },
    rejected: {
      admin: [
        { actionId: "archive", toState: "archived", endpointImplemented: true },
      ],
      business: [
        {
          actionId: "submitForModeration",
          toState: "pending",
          endpointImplemented: true,
        },
        { actionId: "archive", toState: "archived", endpointImplemented: true },
      ],
    },
    needsRevision: {
      admin: [
        { actionId: "archive", toState: "archived", endpointImplemented: true },
      ],
      business: [
        {
          actionId: "submitForModeration",
          toState: "pending",
          endpointImplemented: true,
        },
        { actionId: "archive", toState: "archived", endpointImplemented: true },
      ],
    },
    scheduled: {
      admin: [
        { actionId: "archive", toState: "archived", endpointImplemented: true },
      ],
      business: [
        { actionId: "archive", toState: "archived", endpointImplemented: true },
      ],
    },
    archived: {
      admin: [
        { actionId: "restore", toState: "published", endpointImplemented: true },
        {
          actionId: "deleteArchived",
          toState: "deleted",
          roles: ["ADMIN"],
          endpointImplemented: true,
        },
      ],
      business: [
        { actionId: "restore", toState: "published", endpointImplemented: true },
      ],
    },
    deleted: {},
    unknown: {},
  },

  offer: {
    draft: {
      admin: [
        { actionId: "deleteDraft", toState: "deleted", endpointImplemented: true },
      ],
      business: [
        {
          actionId: "submitForModeration",
          toState: "pending",
          endpointImplemented: true,
        },
        {
          actionId: "publish",
          toState: "published",
          roles: ["ADMIN", "MODERATOR"],
          endpointImplemented: true,
        },
        { actionId: "deleteDraft", toState: "deleted", endpointImplemented: true },
      ],
      moderation: [
        { actionId: "approve", toState: "published", endpointImplemented: true },
        { actionId: "reject", toState: "rejected", endpointImplemented: true },
        {
          actionId: "requestChanges",
          toState: "needsRevision",
          endpointImplemented: true,
        },
      ],
    },
    pending: {
      admin: [
        { actionId: "archive", toState: "archived", endpointImplemented: true },
      ],
      business: [
        {
          actionId: "withdrawFromModeration",
          toState: "draft",
          endpointImplemented: false,
        },
      ],
      moderation: [
        { actionId: "approve", toState: "published", endpointImplemented: true },
        { actionId: "reject", toState: "rejected", endpointImplemented: true },
        {
          actionId: "requestChanges",
          toState: "needsRevision",
          endpointImplemented: true,
        },
      ],
    },
    published: {
      admin: [
        { actionId: "archive", toState: "archived", endpointImplemented: true },
      ],
      business: [
        { actionId: "archive", toState: "archived", endpointImplemented: true },
      ],
    },
    rejected: {
      admin: [
        { actionId: "archive", toState: "archived", endpointImplemented: true },
      ],
      business: [
        {
          actionId: "submitForModeration",
          toState: "pending",
          endpointImplemented: true,
        },
        { actionId: "archive", toState: "archived", endpointImplemented: true },
      ],
    },
    needsRevision: {
      admin: [
        { actionId: "archive", toState: "archived", endpointImplemented: true },
      ],
      business: [
        {
          actionId: "submitForModeration",
          toState: "pending",
          endpointImplemented: true,
        },
        { actionId: "archive", toState: "archived", endpointImplemented: true },
      ],
    },
    scheduled: {},
    archived: {
      admin: [
        { actionId: "restore", toState: "published", endpointImplemented: true },
        {
          actionId: "deleteArchived",
          toState: "deleted",
          roles: ["ADMIN"],
          endpointImplemented: true,
        },
      ],
      business: [
        { actionId: "restore", toState: "published", endpointImplemented: true },
      ],
    },
    deleted: {},
    unknown: {},
  },

  event: {
    draft: {
      admin: [
        { actionId: "deleteDraft", toState: "deleted", endpointImplemented: true },
      ],
      business: [
        {
          actionId: "submitForModeration",
          toState: "pending",
          endpointImplemented: true,
        },
        {
          actionId: "publish",
          toState: "published",
          roles: ["ADMIN", "MODERATOR"],
          endpointImplemented: true,
        },
        { actionId: "deleteDraft", toState: "deleted", endpointImplemented: true },
      ],
      moderation: [
        { actionId: "approve", toState: "published", endpointImplemented: true },
        { actionId: "reject", toState: "rejected", endpointImplemented: true },
        {
          actionId: "requestChanges",
          toState: "needsRevision",
          endpointImplemented: true,
        },
      ],
    },
    pending: {
      admin: [
        { actionId: "archive", toState: "archived", endpointImplemented: true },
      ],
      business: [
        {
          actionId: "withdrawFromModeration",
          toState: "draft",
          endpointImplemented: false,
        },
      ],
      moderation: [
        { actionId: "approve", toState: "published", endpointImplemented: true },
        { actionId: "reject", toState: "rejected", endpointImplemented: true },
        {
          actionId: "requestChanges",
          toState: "needsRevision",
          endpointImplemented: true,
        },
      ],
    },
    published: {
      admin: [
        { actionId: "archive", toState: "archived", endpointImplemented: true },
      ],
      business: [
        {
          actionId: "submitForModeration",
          toState: "pending",
          endpointImplemented: true,
        },
        { actionId: "archive", toState: "archived", endpointImplemented: true },
      ],
    },
    rejected: {
      admin: [
        { actionId: "archive", toState: "archived", endpointImplemented: true },
      ],
      business: [
        {
          actionId: "submitForModeration",
          toState: "pending",
          endpointImplemented: true,
        },
        { actionId: "archive", toState: "archived", endpointImplemented: true },
      ],
    },
    needsRevision: {
      admin: [
        { actionId: "archive", toState: "archived", endpointImplemented: true },
      ],
      business: [
        {
          actionId: "submitForModeration",
          toState: "pending",
          endpointImplemented: true,
        },
        { actionId: "archive", toState: "archived", endpointImplemented: true },
      ],
    },
    scheduled: {
      admin: [
        { actionId: "archive", toState: "archived", endpointImplemented: true },
      ],
      business: [
        { actionId: "archive", toState: "archived", endpointImplemented: true },
      ],
    },
    archived: {
      admin: [
        { actionId: "restore", toState: "draft", endpointImplemented: true },
        {
          actionId: "deleteArchived",
          toState: "deleted",
          roles: ["ADMIN"],
          endpointImplemented: true,
        },
      ],
      business: [
        { actionId: "restore", toState: "draft", endpointImplemented: true },
      ],
    },
    deleted: {},
    unknown: {},
  },

  article: {
    draft: {
      admin: [
        {
          actionId: "submitForModeration",
          toState: "pending",
          endpointImplemented: true,
        },
        {
          actionId: "publish",
          toState: "published",
          roles: ["ADMIN", "MODERATOR"],
          endpointImplemented: true,
        },
        { actionId: "deleteDraft", toState: "deleted", endpointImplemented: true },
      ],
    },
    pending: {
      admin: [
        { actionId: "archive", toState: "archived", endpointImplemented: true },
        { actionId: "approve", toState: "published", endpointImplemented: true },
        { actionId: "reject", toState: "rejected", endpointImplemented: true },
      ],
    },
    published: {
      admin: [
        { actionId: "archive", toState: "archived", endpointImplemented: true },
      ],
    },
    rejected: {
      admin: [
        { actionId: "archive", toState: "archived", endpointImplemented: true },
      ],
    },
    needsRevision: {
      admin: [
        { actionId: "archive", toState: "archived", endpointImplemented: true },
      ],
    },
    scheduled: {
      admin: [
        { actionId: "archive", toState: "archived", endpointImplemented: true },
      ],
    },
    archived: {
      admin: [
        {
          actionId: "restore",
          toState: "published",
          endpointImplemented: false,
        },
        {
          actionId: "deleteArchived",
          toState: "deleted",
          roles: ["ADMIN"],
          endpointImplemented: true,
        },
      ],
    },
    deleted: {},
    unknown: {},
  },

  route: {
    draft: {
      business: [
        { actionId: "publish", toState: "published", endpointImplemented: true },
        { actionId: "deleteDraft", toState: "deleted", endpointImplemented: true },
      ],
    },
    published: {
      business: [
        { actionId: "unpublish", toState: "draft", endpointImplemented: true },
        {
          actionId: "archive",
          toState: "archived",
          endpointImplemented: false,
        },
      ],
    },
    pending: {},
    rejected: {},
    needsRevision: {},
    scheduled: {},
    archived: {
      business: [
        {
          actionId: "restore",
          toState: "published",
          endpointImplemented: false,
        },
      ],
    },
    deleted: {},
    unknown: {},
  },
};

export function actorHasRequiredRole(
  actorRoles: LifecycleActorRole[] | undefined,
  requiredRoles: LifecycleActorRole[] | undefined,
): boolean {
  if (!requiredRoles || requiredRoles.length === 0) {
    return true;
  }
  if (!actorRoles || actorRoles.length === 0) {
    return false;
  }
  const normalized = new Set(actorRoles.map((role) => role.toUpperCase()));
  return requiredRoles.some((role) => normalized.has(role.toUpperCase()));
}

export function getLifecycleTransitionsForState(params: {
  contentType: LifecycleContentType;
  effectiveState: LifecycleEffectiveState;
  surface: LifecycleSurface;
  actorRoles?: LifecycleActorRole[];
}): LifecycleTransitionDef[] {
  const surfaceMap =
    LIFECYCLE_TRANSITIONS[params.contentType][params.effectiveState] ?? {};
  const transitions = surfaceMap[params.surface] ?? [];

  return transitions.filter((transition) => {
    if (!transition.endpointImplemented) {
      return false;
    }
    return actorHasRequiredRole(params.actorRoles, transition.roles);
  });
}

/** Forbidden transitions for policy tests — must never appear in resolved actions. */
export const LIFECYCLE_FORBIDDEN_TRANSITIONS: Array<{
  from: LifecycleEffectiveState;
  actionId: LifecycleActionId;
  note: string;
}> = [
  { from: "published", actionId: "deleteDraft", note: "Published cannot hard-delete as draft" },
  { from: "archived", actionId: "deleteDraft", note: "Archived cannot hard-delete as draft" },
  { from: "pending", actionId: "deleteDraft", note: "Pending cannot hard-delete as draft" },
  { from: "published", actionId: "deleteArchived", note: "Published cannot delete from archive" },
  { from: "draft", actionId: "deleteArchived", note: "Draft cannot delete from archive" },
  { from: "published", actionId: "publish", note: "Already published" },
  { from: "archived", actionId: "archive", note: "Already archived" },
];
