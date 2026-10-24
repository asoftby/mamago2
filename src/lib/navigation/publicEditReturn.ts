"use client";

const PREFIX = "__mamagoPublicEditReturn:";
const EDITED = "__mamagoPublicEdited:";

function safePath(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value)) return null;
  if (/^\/(admin|business|editor)(\/|$)/.test(value)) return null;
  return value;
}

export function capturePublicEditOrigin(): () => void {
  if (typeof window === "undefined") return () => {};
  const pathname = window.location.pathname;
  const key = PREFIX + pathname;
  const fromState = window.history.state?.__mamagoPreviousPath;
  let origin = safePath(typeof fromState === "string" ? fromState : null);
  if (!origin && document.referrer) {
    try {
      const ref = new URL(document.referrer);
      if (ref.origin === window.location.origin) origin = safePath(ref.pathname + ref.search);
    } catch { /* Invalid referrer. */ }
  }
  if (origin === pathname) origin = null;

  const onClick = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest("a[href]");
    if (!(anchor instanceof HTMLAnchorElement)) return;
    const url = new URL(anchor.href);
    if (url.origin !== window.location.origin || !/^\/(admin|business|editor)(\/|$)/.test(url.pathname)) return;
    try {
      window.sessionStorage.setItem(key, origin || "");
      window.sessionStorage.setItem(EDITED + pathname, "1");
    } catch { /* Storage can be unavailable. */ }
  };
  document.addEventListener("click", onClick, true);
  return () => document.removeEventListener("click", onClick, true);
}

export function getPublicBackAfterEdit(): string | null {
  if (typeof window === "undefined") return null;
  const pathname = window.location.pathname;
  try {
    if (window.sessionStorage.getItem(EDITED + pathname) !== "1") return null;
    window.sessionStorage.removeItem(EDITED + pathname);
    return safePath(window.sessionStorage.getItem(PREFIX + pathname)) || null;
  } catch {
    return null;
  }
}
