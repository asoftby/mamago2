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
  // Compute initial value in useState initializer (SSR-safe, no hydration mismatch)
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const media = window.matchMedia(query);
    // Update state on media query change
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query]);

  return matches;
}
