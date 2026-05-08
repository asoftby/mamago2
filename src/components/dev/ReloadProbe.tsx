"use client";

import { useEffect } from "react";

export function ReloadProbe() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    console.log("[RELOAD_PROBE_MOUNTED]", {
      href: window.location.href,
      origin: window.location.origin,
      publicAppUrl: process.env.NEXT_PUBLIC_APP_URL,
      time: Date.now(),
    });

    const handleBeforeUnload = () => {
      console.warn("[BEFOREUNLOAD]", window.location.href, Date.now());
      try {
        throw new Error("[BEFOREUNLOAD_TRACE]");
      } catch (e) {
        console.warn(e);
      }
    };

    const handlePageHide = (e: PageTransitionEvent) => {
      console.warn("[PAGEHIDE]", {
        href: window.location.href,
        persisted: e.persisted,
        time: Date.now(),
      });
    };

    const handleError = (e: ErrorEvent) => {
      console.error("[WINDOW_ERROR]", e.message, e.filename, e.lineno, e.colno);
    };

    const handleUnhandledRejection = (e: PromiseRejectionEvent) => {
      console.error("[UNHANDLED_REJECTION]", e.reason);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return null;
}
