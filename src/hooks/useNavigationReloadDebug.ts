"use client";

import { useEffect } from "react";

const NAV_DEBUG = process.env.NEXT_PUBLIC_NAV_DEBUG === "true";

function stackTrace(): string {
  try {
    return new Error().stack ?? "(no stack)";
  } catch {
    return "(stack unavailable)";
  }
}

export function useNavigationReloadDebug(enabled: boolean) {
  useEffect(() => {
    if (!NAV_DEBUG) return;
    if (!enabled || typeof window === "undefined") return;

    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);

    window.history.pushState = function (...args) {
      console.warn("[nav-debug] history.pushState", { args, stack: stackTrace() });
      return originalPushState(...args);
    };

    window.history.replaceState = function (...args) {
      console.warn("[nav-debug] history.replaceState", { args, stack: stackTrace() });
      return originalReplaceState(...args);
    };

    const onBeforeUnload = () => {
      console.warn("[nav-debug] beforeunload", { href: window.location.href, stack: stackTrace() });
    };

    const onPageHide = (ev: PageTransitionEvent) => {
      console.warn("[nav-debug] pagehide", {
        persisted: ev.persisted,
        href: window.location.href,
      });
    };

    const onPopState = () => {
      console.warn("[nav-debug] popstate", { href: window.location.href, stack: stackTrace() });
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("popstate", onPopState);

    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("popstate", onPopState);
    };
  }, [enabled]);
}
