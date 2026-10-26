"use client";

/**
 * One-shot public Back destination for the workflow:
 * public detail -> privileged editor -> saved public detail -> Back.
 * Only activated by clicking an editor link on a public detail page;
 * ordinary readers keep browser Back behavior.
 */
const PREFIX = "mamago.publicEditBack.v1:";
const MAX_AGE_MS = 30 * 60 * 1000;

export function safePublicBackPath(path: string | null | undefined): string | null {
  if (!path || !path.startsWith("/") || path.startsWith("//") || /[\\\r\n\u0000]/.test(path)) return null;
  if (/^\/(admin|business|editor)(\/|\?|#|$)/.test(path)) return null;
  return path;
}

export function resolveEditedPublicBack(
  pathname: string,
  source: string | null,
  fallbackHref: string,
): string {
  const safeSource = safePublicBackPath(source);
  if (safeSource && safeSource.split(/[?#]/)[0] !== pathname) return safeSource;

  // A direct article visit before editing has no previous list to restore.
  // Return to the journal, not the editor or the city home.
  const cityJournal = pathname.match(/^\/([^/]+)\/blog\/[^/]+\/?$/);
  if (cityJournal) return `/${cityJournal[1]}/blog`;
  if (/^\/blog\/[^/]+\/?$/.test(pathname)) return "/blog";
  return safePublicBackPath(fallbackHref) ?? "/";
}

type EditMarker = { origin: string | null; createdAt: number };

function originForCurrentPage(): string | null {
  const current = window.location.pathname;
  const state = window.history.state as { __mamagoPreviousPath?: unknown } | null;
  const prior = state?.__mamagoPreviousPath;
  let origin = safePublicBackPath(typeof prior === "string" ? prior : null);
  if (!origin && document.referrer) {
    try {
      const ref = new URL(document.referrer);
      if (ref.origin === window.location.origin) {
        origin = safePublicBackPath(ref.pathname + ref.search);
      }
    } catch { /* Invalid referrer. */ }
  }
  return origin && origin.split(/[?#]/)[0] !== current ? origin : null;
}

export function capturePublicEditOrigin(): () => void {
  if (typeof window === "undefined") return () => {};

  const onClick = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest("a[href]");
    if (!(anchor instanceof HTMLAnchorElement)) return;
    let url: URL;
    try { url = new URL(anchor.href); } catch { return; }
    if (url.origin !== window.location.origin) return;
    // Only privileged editing routes trigger the one-time special Back.
    if (!/^\/(admin|business|editor)(\/|$)/.test(url.pathname)) return;
    const pathname = window.location.pathname;
    if (/^\/(admin|business|editor)(\/|$)/.test(pathname)) return;
    const marker: EditMarker = { origin: originForCurrentPage(), createdAt: Date.now() };
    try {
      window.sessionStorage.setItem(PREFIX + pathname, JSON.stringify(marker));
    } catch { /* Storage may be disabled. */ }
  };

  document.addEventListener("click", onClick, true);
  return () => document.removeEventListener("click", onClick, true);
}

/** Consume once. Returns null if this page wasn't visited from an editor. */
export function getPublicBackAfterEdit(fallbackHref: string): string | null {
  if (typeof window === "undefined") return null;
  const pathname = window.location.pathname;
  let raw: string | null;
  try {
    raw = window.sessionStorage.getItem(PREFIX + pathname);
    if (!raw) return null;
    window.sessionStorage.removeItem(PREFIX + pathname);
    const marker = JSON.parse(raw) as Partial<EditMarker>;
    if (typeof marker.createdAt !== "number" ||
        Date.now() - marker.createdAt > MAX_AGE_MS ||
        marker.createdAt > Date.now()) return null;
    return resolveEditedPublicBack(
      pathname,
      typeof marker.origin === "string" ? marker.origin : null,
      fallbackHref,
    );
  } catch {
    return null;
  }
}
