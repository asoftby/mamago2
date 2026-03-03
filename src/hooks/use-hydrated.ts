"use client";

import * as React from "react";

/**
 * Hook that returns true after the component has hydrated on the client.
 * Useful for preventing hydration mismatches when rendering different
 * content on server vs client (e.g., mobile vs desktop variants).
 * 
 * @returns false during SSR and first render, true after hydration
 */
export function useHydrated() {
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    setHydrated(true);
  }, []);

  return hydrated;
}
