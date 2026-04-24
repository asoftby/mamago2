"use client";

import { useEffect, useState } from "react";

/**
 * SSR-safe media query hook.
 *
 * Initialises with `false` (matches server render) so there's no hydration mismatch.
 * The real value is computed in the useState initializer and updated via subscription.
 * Callers that need to gate rendering should treat `false` as "not matching".
 */
export function useMediaQuery(query: string): boolean {
  // Always start from false to match SSR markup during hydration.
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    const syncCurrent = () => setMatches(media.matches);
    // Update state on media query change
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    const timer = window.setTimeout(syncCurrent, 0);
    media.addEventListener("change", listener);
    return () => {
      window.clearTimeout(timer);
      media.removeEventListener("change", listener);
    };
  }, [query]);

  return matches;
}
