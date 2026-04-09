"use client";

import { useEffect, useState } from "react";

/**
 * SSR-safe media query hook.
 *
 * Initialises with `null` (unknown) on the server and during hydration,
 * then resolves to the real value synchronously in the first effect.
 * Callers that need to gate rendering should treat `null` as "not yet known"
 * and defer rendering until the value is resolved.
 */
export function useMediaQuery(query: string): boolean {
  // Start with false — matches the server render so there's no hydration mismatch.
  // The real value is set synchronously in the first effect (before paint).
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    // Sync immediately — no rAF delay — so the correct value is available
    // before the browser paints, preventing a visible flash / double-open.
    setMatches(media.matches);

    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return matches;
}
