import type {
  LifecycleActionId,
  LifecycleActionRequest,
  LifecycleContentType,
  LifecycleSurface,
} from "./lifecycleTypes";

type ResolveParams = {
  surface: LifecycleSurface;
  contentType: LifecycleContentType;
  contentId: string;
  actionId: LifecycleActionId;
};

function adminArchivePath(contentType: LifecycleContentType, contentId: string) {
  switch (contentType) {
    case "place":
      return `/api/admin/places/${contentId}/archive`;
    case "offer":
      return `/api/admin/offers/${contentId}/archive`;
    case "event":
      return `/api/business/events/${contentId}/archive`;
    case "article":
      return `/api/admin/articles/${contentId}/archive`;
    default:
      return null;
  }
}

function businessArchivePath(contentType: LifecycleContentType, contentId: string) {
  switch (contentType) {
    case "place":
      return `/api/business/places/${contentId}/archive`;
    case "offer":
      return `/api/business/offers/${contentId}/archive`;
    case "event":
      return `/api/business/events/${contentId}/archive`;
    default:
      return null;
  }
}

function deletePath(
  surface: LifecycleSurface,
  contentType: LifecycleContentType,
  contentId: string,
): string | null {
  if (surface === "admin") {
    switch (contentType) {
      case "place":
        return `/api/admin/places/${contentId}`;
      case "offer":
        return `/api/business/offers/${contentId}`;
      case "event":
        return `/api/admin/moderation/events/${contentId}`;
      case "article":
        return `/api/admin/articles/${contentId}`;
      default:
        return null;
    }
  }

  switch (contentType) {
    case "place":
      return `/api/business/places/${contentId}/delete`;
    case "offer":
      return `/api/business/offers/${contentId}`;
    case "event":
      return `/api/business/events/${contentId}`;
    case "route":
      return `/api/routes/${contentId}`;
    default:
      return null;
  }
}

function submitPath(contentType: LifecycleContentType, contentId: string) {
  switch (contentType) {
    case "place":
      return `/api/business/places/${contentId}/submit`;
    case "offer":
      return `/api/business/offers/${contentId}`;
    case "event":
      return `/api/business/events/${contentId}/submit`;
    case "article":
      return `/api/admin/articles/${contentId}/submit`;
    default:
      return null;
  }
}

/**
 * Maps a lifecycle verb to a concrete HTTP request.
 * UI calls `archive()`, not `/api/admin/places/:id/archive`.
 */
export function resolveLifecycleActionRequest(
  params: ResolveParams,
): LifecycleActionRequest | null {
  const { surface, contentType, contentId, actionId } = params;

  switch (actionId) {
    case "edit":
    case "preview":
    case "review":
      return null;

    case "archive": {
      const url =
        surface === "admin"
          ? adminArchivePath(contentType, contentId)
          : businessArchivePath(contentType, contentId);
      return url ? { url, method: "POST" } : null;
    }

    case "restore": {
      const url =
        surface === "admin"
          ? adminArchivePath(contentType, contentId)
          : businessArchivePath(contentType, contentId);
      return url ? { url, method: "DELETE" } : null;
    }

    case "deleteDraft":
    case "deleteArchived": {
      const url = deletePath(surface, contentType, contentId);
      return url ? { url, method: "DELETE" } : null;
    }

    case "submitForModeration": {
      const url = submitPath(contentType, contentId);
      if (!url) return null;
      if (contentType === "offer") {
        return { url, method: "PATCH", body: { status: "PENDING" } };
      }
      return { url, method: "POST" };
    }

    case "publish": {
      switch (contentType) {
        case "place":
          return {
            url: `/api/admin/places/${contentId}/approve`,
            method: "POST",
          };
        case "offer":
          return {
            url: `/api/business/offers/${contentId}`,
            method: "PATCH",
            body: { status: "PUBLISHED" },
          };
        case "event":
          return {
            url: `/api/business/events/${contentId}/submit`,
            method: "POST",
          };
        case "article":
          return {
            url: `/api/admin/articles/${contentId}/moderate`,
            method: "POST",
            body: { decision: "publish" },
          };
        case "route":
          return {
            url: `/api/routes/${contentId}`,
            method: "PATCH",
            body: { publish: true },
          };
        default:
          return null;
      }
    }

    case "unpublish":
      return contentType === "route"
        ? {
            url: `/api/routes/${contentId}`,
            method: "PATCH",
            body: { publish: false },
          }
        : null;

    case "approve": {
      if (surface === "moderation" || surface === "admin") {
        switch (contentType) {
          case "place":
            return {
              url: `/api/admin/moderation/places/${contentId}`,
              method: "POST",
              body: { decision: "approve" },
            };
          case "offer":
            return {
              url: `/api/admin/moderation/offers/${contentId}`,
              method: "POST",
              body: { decision: "approve" },
            };
          case "event":
            return {
              url: `/api/admin/moderation/events/${contentId}`,
              method: "POST",
              body: { decision: "approve" },
            };
          case "article":
            return {
              url: `/api/admin/articles/${contentId}/moderate`,
              method: "POST",
              body: { decision: "publish" },
            };
          default:
            return null;
        }
      }
      return null;
    }

    case "reject": {
      switch (contentType) {
        case "article":
          return {
            url: `/api/admin/articles/${contentId}/moderate`,
            method: "POST",
            body: { decision: "reject" },
          };
        case "place":
          return {
            url: `/api/admin/moderation/places/${contentId}`,
            method: "POST",
            body: { decision: "reject" },
          };
        case "offer":
          return {
            url: `/api/admin/moderation/offers/${contentId}`,
            method: "POST",
            body: { decision: "reject" },
          };
        case "event":
          return {
            url: `/api/admin/moderation/events/${contentId}`,
            method: "POST",
            body: { decision: "reject" },
          };
        default:
          return null;
      }
    }

    case "requestChanges": {
      switch (contentType) {
        case "place":
          return {
            url: `/api/admin/moderation/places/${contentId}`,
            method: "POST",
            body: { decision: "needs_revision" },
          };
        case "offer":
          return {
            url: `/api/admin/moderation/offers/${contentId}`,
            method: "POST",
            body: { decision: "needs_revision" },
          };
        case "event":
          return {
            url: `/api/admin/moderation/events/${contentId}`,
            method: "POST",
            body: { decision: "needs_revision" },
          };
        default:
          return null;
      }
    }

    case "withdrawFromModeration":
      return null;

    default:
      return null;
  }
}

export function contentTypeSuccessMessage(
  contentType: LifecycleContentType,
  actionId: LifecycleActionId,
): string | undefined {
  const typeLabel: Record<LifecycleContentType, string> = {
    place: "Место",
    offer: "Предложение",
    event: "Событие",
    article: "Публикация",
    route: "Маршрут",
  };

  switch (actionId) {
    case "archive":
      return `${typeLabel[contentType]} перемещено в архив`;
    case "restore":
      return `${typeLabel[contentType]} восстановлено`;
    case "deleteDraft":
      return `Черновик удалён`;
    case "deleteArchived":
      return `${typeLabel[contentType]} удалено из архива`;
    default:
      return undefined;
  }
}
