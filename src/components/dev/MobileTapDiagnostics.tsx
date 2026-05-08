"use client";

import { useEffect } from "react";

type PositionedElementInfo = {
  tag: string;
  id: string;
  className: string;
  position: string;
  zIndex: string;
  pointerEvents: string;
};

function isCookieConsentElement(element: Element | null): boolean {
  return Boolean(element?.closest?.("#cc-main"));
}

function toInfo(element: Element | null): PositionedElementInfo | null {
  if (!(element instanceof HTMLElement)) return null;
  const styles = window.getComputedStyle(element);
  return {
    tag: element.tagName,
    id: element.id,
    className: element.className,
    position: styles.position,
    zIndex: styles.zIndex,
    pointerEvents: styles.pointerEvents,
  };
}

function findOverlayAncestor(node: EventTarget | null): PositionedElementInfo | null {
  let current = node instanceof HTMLElement ? node : null;
  while (current) {
    const styles = window.getComputedStyle(current);
    if (
      ["fixed", "absolute", "sticky"].includes(styles.position) &&
      styles.pointerEvents !== "none" &&
      ((Number.parseInt(styles.zIndex || "0", 10) > 10) || styles.inset !== "auto")
    ) {
      return toInfo(current);
    }
    current = current.parentElement;
  }
  return null;
}

export function MobileTapDiagnostics() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (process.env.NEXT_PUBLIC_TAP_DIAGNOSTICS !== "true") return;

    const logEvent = (event: PointerEvent | MouseEvent) => {
      const x = "clientX" in event ? event.clientX : window.innerWidth / 2;
      const y = "clientY" in event ? event.clientY : window.innerHeight / 2;
      const underPointer = document.elementFromPoint(x, y);
      const target = event.target as Element | null;
      const cookieElement = target?.closest?.("#cc-main") ?? underPointer?.closest?.("#cc-main") ?? null;
      const payload = {
        type: event.type,
        x,
        y,
        target: toInfo(target),
        currentTarget: toInfo(event.currentTarget as Element | null),
        underPointer: toInfo(underPointer),
        overlayAncestor: findOverlayAncestor(event.target),
        cookieConsentAncestor: toInfo(cookieElement),
      };

      console.debug("[tap-diagnostics]", payload);

      if (isCookieConsentElement(target) || isCookieConsentElement(underPointer)) {
        console.warn("[tap-diagnostics][cookie-consent-hit]", payload);
      }
    };

    window.addEventListener("pointerdown", logEvent, true);
    window.addEventListener("click", logEvent, true);

    return () => {
      window.removeEventListener("pointerdown", logEvent, true);
      window.removeEventListener("click", logEvent, true);
    };
  }, []);

  return null;
}
