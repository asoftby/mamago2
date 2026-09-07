"use client";

import { useEffect, useRef, useState } from "react";
import { BANNER } from "@/lib/cookies/consent-config";
import {
  acceptFromShell,
  ensureConsentModalShown,
  openCookiePreferences,
} from "@/lib/cookies/consent-manager";
import {
  CONSENT_COOKIE_NAME,
  hasValidConsentCookieValue,
} from "@/lib/cookies/consent-cookie-format";

function readOwnCookieValue(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${CONSENT_COOKIE_NAME}=([^;]*)`),
  );
  return match?.[1];
}

/**
 * First-paint consent shell. It is present in the initial HTML so a first
 * visit does not wait for the vanilla-cookieconsent dynamic import before
 * painting the consent copy.
 */
export function CookieConsentShell() {
  const [mounted, setMounted] = useState(true);
  const [pending, setPending] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hasValidConsentCookieValue(readOwnCookieValue())) {
      setMounted(false);
      return;
    }

    let active = true;
    const hideShell = () => {
      if (!active) return;
      if (rootRef.current) rootRef.current.style.display = "none";
      setMounted(false);
    };

    ensureConsentModalShown().then(hideShell, hideShell);

    return () => {
      active = false;
    };
  }, []);

  async function handleAccept(categories: "all" | []) {
    setPending(true);
    try {
      await acceptFromShell(categories);
    } finally {
      setPending(false);
    }
  }

  async function handleCustomize() {
    setPending(true);
    try {
      openCookiePreferences();
    } finally {
      setPending(false);
    }
  }

  if (!mounted) return null;

  return (
    <div
      id="mamago-cookie-shell"
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mamago-cookie-shell-title"
      aria-describedby="mamago-cookie-shell-desc"
      className="fixed inset-x-0 bottom-0 z-[10050] flex justify-center px-3 pb-3 sm:justify-start sm:px-4 sm:pb-4"
    >
      <div className="w-full max-w-md rounded-2xl border border-black/5 bg-white p-4 shadow-2xl sm:p-5">
        <h2
          id="mamago-cookie-shell-title"
          className="text-base font-semibold text-neutral-900"
        >
          {BANNER.title}
        </h2>
        <p
          id="mamago-cookie-shell-desc"
          className="mt-1.5 text-sm leading-relaxed text-neutral-700"
        >
          {BANNER.description}
        </p>
        <div className="mt-3 flex flex-col gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => handleAccept("all")}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[#EF8759] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#e0784a] disabled:opacity-60"
          >
            {BANNER.acceptAll}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => handleAccept([])}
              className="h-10 flex-1 rounded-lg bg-neutral-100 px-4 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-200 disabled:opacity-60"
            >
              {BANNER.necessaryOnly}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={handleCustomize}
              className="h-10 flex-1 rounded-lg border border-neutral-200 px-4 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-60"
            >
              {BANNER.customize}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
