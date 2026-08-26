import { buildArticlePublicPath } from "@/lib/routing/cityPaths";
import type { Role } from "@prisma/client";
import {
  BUSINESS_PUBLICATIONS_EVENTS_HREF,
  BUSINESS_PUBLICATIONS_OFFERS_HREF,
  BUSINESS_PUBLICATIONS_PLACES_HREF,
} from "@/lib/business/navigation";
import {
  editorEventEditHref,
  editorOfferEditHref,
  editorPlaceEditHref,
} from "@/lib/content-editor/types";
import { getAbsolutePlacePublicUrl } from "@/lib/placePublicUrl";
import { getOfferPublicUrl } from "@/lib/offers/offerPublicUrl";
import {
  publicActivityPath,
  toAbsolutePublicUrl,
} from "@/lib/business/eventPublicLink";
import { getCanonicalPublicAppUrl } from "@/lib/config/publicAppUrl";
import { surfaceFromPathname } from "@/lib/routing/surface";
import {
  getEventPreviewPath,
  getOfferPreviewPath,
  getPlacePreviewPath,
} from "@/lib/content-preview/paths";
import type {
  ContentSuccessKind,
  ContentSuccessPayload,
  ResolvedContentLinks,
  ResolvedContentSuccessState,
} from "./types";

function isInternalReturnTo(value: string | null | undefined): value is string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//");
}

function resolveBrowserReturnTo(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const value = new URLSearchParams(window.location.search).get("returnTo");
    return isInternalReturnTo(value) ? value : null;
  } catch {
    return null;
  }
}

function resolveEffectiveReturnTo(payload: ContentSuccessPayload): string | null {
  if (isInternalReturnTo(payload.returnTo)) {
    return payload.returnTo;
  }
  return resolveBrowserReturnTo();
}

function isPrivilegedContentRole(role: Role | null | undefined): boolean {
  return role === "ADMIN" || role === "MODERATOR";
}

function isOnboardingPath(path: string): boolean {
  const pathname = path.split("?")[0] ?? path;
  return pathname === "/onboarding" || pathname.startsWith("/onboarding/");
}

function defaultListHref(
  kind: ContentSuccessKind,
  surface: "admin" | "business" | "onboarding",
): string {
  if (surface === "business" || surface === "onboarding") {
    if (kind === "event") return BUSINESS_PUBLICATIONS_EVENTS_HREF;
    if (kind === "offer") return BUSINESS_PUBLICATIONS_OFFERS_HREF;
    if (kind === "place") return BUSINESS_PUBLICATIONS_PLACES_HREF;
  }

  if (kind === "event") return "/admin/content/events";
  if (kind === "offer") return "/admin/content/offers";
  if (kind === "place") return "/admin/content/places";
  return "/admin/content/publications";
}

function resolveReturnToSurface(
  returnTo: string,
): "admin" | "business" | "onboarding" | "public" {
  const baseSurface = surfaceFromPathname(returnTo);
  if (
    baseSurface === "business" &&
    isOnboardingPath(returnTo.slice("/business".length) || "/")
  ) {
    return "onboarding";
  }
  return baseSurface;
}

function canUseReturnTo(payload: ContentSuccessPayload, returnTo: string): boolean {
  const returnToSurface = resolveReturnToSurface(returnTo);

  if (returnToSurface === "public") {
    return false;
  }

  if (returnToSurface === "onboarding") {
    return payload.surface === "onboarding" || payload.role === "BUSINESS_OWNER";
  }

  if (returnToSurface === payload.surface) {
    return true;
  }

  if (isPrivilegedContentRole(payload.role) && returnToSurface === "admin") {
    return true;
  }

  return false;
}

function guardListHrefForRole(payload: ContentSuccessPayload, href: string): string {
  if (isPrivilegedContentRole(payload.role) && href.includes("/onboarding")) {
    return defaultListHref(payload.kind, "admin");
  }
  return href;
}

export function resolveContentListHref(payload: ContentSuccessPayload): string {
  const returnTo = resolveEffectiveReturnTo(payload);
  if (returnTo && canUseReturnTo(payload, returnTo)) {
    return guardListHrefForRole(payload, returnTo);
  }
  return guardListHrefForRole(payload, defaultListHref(payload.kind, payload.surface));
}

function appendReturnTo(href: string, returnTo: string | null): string {
  if (!returnTo) return href;
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}returnTo=${encodeURIComponent(returnTo)}`;
}

function resolveBaseEditHref(payload: ContentSuccessPayload): string | null {
  if (payload.kind === "event") return editorEventEditHref(payload.id);
  if (payload.kind === "offer") return editorOfferEditHref(payload.id);
  if (payload.kind === "place") return editorPlaceEditHref(payload.id);
  if (payload.kind === "article") return `/admin/content/articles/${payload.id}/edit`;
  if (payload.kind === "breaking-news") {
    return `/admin/content/publications/new?type=news&id=${encodeURIComponent(payload.id)}`;
  }
  return null;
}

function resolveEditHref(payload: ContentSuccessPayload): string | null {
  const href = resolveBaseEditHref(payload);
  if (!href) return null;
  return appendReturnTo(href, resolveEffectiveReturnTo(payload));
}

function resolvePreviewHref(payload: ContentSuccessPayload): string | null {
  if (payload.kind === "event") return getEventPreviewPath(payload.id);
  if (payload.kind === "place") return getPlacePreviewPath(payload.id);
  if (payload.kind === "offer") return getOfferPreviewPath(payload.id);
  if (payload.kind === "article" || payload.kind === "breaking-news") {
    return `/preview/articles/${payload.id}`;
  }
  return null;
}

function resolvePublicHref(payload: ContentSuccessPayload): string | null {
  if (payload.publicPath) {
    return toAbsolutePublicUrl(payload.publicPath);
  }

  if (payload.kind === "event") {
    return toAbsolutePublicUrl(
      publicActivityPath(payload.id, payload.cityField ?? payload.citySlug ?? null, payload.slug),
    );
  }

  if (payload.kind === "place") {
    return getAbsolutePlacePublicUrl({
      slug: payload.slug,
      id: payload.id,
    });
  }

  if (
    payload.kind === "offer" &&
    payload.slug &&
    payload.citySlug &&
    payload.offerKind
  ) {
    return getOfferPublicUrl({ slug: payload.slug }, payload.citySlug);
  }

  if (
    (payload.kind === "article" || payload.kind === "breaking-news") &&
    payload.slug
  ) {
    const path = buildArticlePublicPath({
      slug: payload.slug,
      geoScope: payload.geoScope ?? undefined,
      citySlug: payload.citySlug ?? undefined,
    });
    return `${getCanonicalPublicAppUrl()}${path}`;
  }

  return null;
}

export function resolveContentLinks(payload: ContentSuccessPayload): ResolvedContentLinks {
  return {
    publicUrl: resolvePublicHref(payload),
    previewUrl: resolvePreviewHref(payload),
    editUrl: resolveEditHref(payload),
    listUrl: resolveContentListHref(payload),
  };
}

function resolvePublicOriginReturnTo(payload: ContentSuccessPayload): string | null {
  const returnTo = resolveEffectiveReturnTo(payload);
  if (!returnTo) return null;
  return resolveReturnToSurface(returnTo) === "public"
    ? toAbsolutePublicUrl(returnTo)
    : null;
}

function resolveDraftSavedTitle(payload: ContentSuccessPayload): string {
  void payload;
  return "Черновик сохранен";
}

function resolveOpenAction(
  payload: ContentSuccessPayload,
  links: ResolvedContentLinks,
  publicOriginReturnTo: string | null,
) {
  if (payload.outcome === "draft_saved") {
    if (!publicOriginReturnTo) return null;
    return {
      label: "Вернуться к публикации",
      href: publicOriginReturnTo,
      target: "_self" as const,
    };
  }

  if (payload.outcome === "submitted") {
    if (!links.previewUrl) {
      return null;
    }

    return {
      label: "Открыть предпросмотр",
      href: links.previewUrl,
      target: "_blank" as const,
    };
  }

  const publishedHref = links.publicUrl ?? publicOriginReturnTo;
  if (publishedHref) {
    return {
      label: "Смотреть публикацию",
      href: publishedHref,
      target: publicOriginReturnTo ? ("_self" as const) : ("_blank" as const),
    };
  }

  if (links.previewUrl) {
    return {
      label: "Открыть предпросмотр",
      href: links.previewUrl,
      target: "_blank" as const,
    };
  }

  return null;
}

function resolveDescription(
  payload: ContentSuccessPayload,
  hasOpenAction: boolean,
  fromPublicPage: boolean,
): string {
  if (payload.outcome === "draft_saved") {
    return fromPublicPage
      ? "Черновик сохранен. Можно вернуться к публикации или продолжить редактирование."
      : "Черновик сохранен. Можно продолжить редактирование или вернуться к списку.";
  }

  if (payload.outcome === "submitted") {
    if (fromPublicPage) {
      return hasOpenAction
        ? "Публикация отправлена на модерацию. Можно открыть предпросмотр или продолжить редактирование."
        : "Публикация отправлена на модерацию. Можно продолжить редактирование.";
    }
    return hasOpenAction
      ? "Публикация отправлена на модерацию. Можно открыть предпросмотр, продолжить редактирование или вернуться к списку."
      : "Публикация отправлена на модерацию. Можно продолжить редактирование или вернуться к списку.";
  }

  if (payload.outcome === "changes_published") {
    if (fromPublicPage) {
      return hasOpenAction
        ? "Изменения доступны пользователям. Можно смотреть публикацию или продолжить редактирование."
        : "Изменения доступны пользователям. Можно продолжить редактирование.";
    }
    return hasOpenAction
      ? "Изменения доступны пользователям. Можно смотреть публикацию, продолжить редактирование или вернуться к списку."
      : "Изменения доступны пользователям. Можно продолжить редактирование или вернуться к списку.";
  }

  if (fromPublicPage) {
    return hasOpenAction
      ? "Публикация доступна пользователям. Можно смотреть публикацию или продолжить редактирование."
      : "Публикация доступна пользователям. Можно продолжить редактирование.";
  }

  return hasOpenAction
    ? "Публикация доступна пользователям. Можно смотреть публикацию, продолжить редактирование или вернуться к списку."
    : "Публикация доступна пользователям. Можно продолжить редактирование или вернуться к списку.";
}

export function resolveContentSuccessState(
  payload: ContentSuccessPayload,
): ResolvedContentSuccessState | null {
  const links = resolveContentLinks(payload);
  const publicOriginReturnTo = resolvePublicOriginReturnTo(payload);
  const fromPublicPage = publicOriginReturnTo != null;
  const openAction = resolveOpenAction(payload, links, publicOriginReturnTo);
  const continueEditingAction = links.editUrl
    ? {
        label: "Продолжить редактирование",
        href: links.editUrl,
      }
    : null;
  const listAction = fromPublicPage
    ? null
    : {
        label: "Вернуться к списку",
        href: links.listUrl,
      };

  if (payload.outcome === "draft_saved") {
    return {
      title: resolveDraftSavedTitle(payload),
      description: resolveDescription(payload, openAction != null, fromPublicPage),
      openAction,
      continueEditingAction,
      listAction,
    };
  }

  if (payload.outcome === "submitted") {
    return {
      title: "Отправлено на модерацию",
      description: resolveDescription(payload, openAction != null, fromPublicPage),
      openAction,
      continueEditingAction,
      listAction,
    };
  }

  return {
    title:
      payload.outcome === "changes_published"
        ? "Публикация обновлена"
        : "Опубликовано",
    description: resolveDescription(payload, openAction != null, fromPublicPage),
    openAction,
    continueEditingAction,
    listAction,
  };
}
