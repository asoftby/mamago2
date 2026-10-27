"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { postProductTelemetryEvent } from "@/lib/analytics/client";
import { isPublicPageViewPath, pageViewCitySlug, shouldEmitPageView } from "@/lib/analytics/pageViewObserver";
import { useOptionalCity } from "@/contexts/CityContext";

/**
 * Emits one PAGE_VIEW per initial public page load or client-side
 * navigation to a different pathname. usePathname() excludes the query
 * string, so search-param-only changes never re-trigger this. Mount once,
 * only inside the public shell — never on admin/business surfaces.
 *
 * `isPublicPageViewPath` guards a real leak: client-side navigation out of
 * the public shell into another top-level layout (e.g. `/admin/...`) can
 * leave `usePathname()` reporting the new path for one render tick before
 * this component unmounts — without the guard that tick emits a PAGE_VIEW
 * for a surface never meant to be tracked here.
 */
export function PageViewTracker() {
  const pathname = usePathname();
  const city = useOptionalCity();
  const citySlug = pageViewCitySlug(city);
  const lastPathnameRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    if (!isPublicPageViewPath(pathname)) return;
    if (!shouldEmitPageView(lastPathnameRef.current, pathname)) return;
    lastPathnameRef.current = pathname;
    void postProductTelemetryEvent({
      eventType: "PAGE_VIEW",
      citySlug,
      meta: { path: pathname },
    });
    // citySlug is read at emit time; a city change without navigation is not a new page view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return null;
}
