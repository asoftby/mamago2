"use client";

import { SiteHeaderShell } from "./SiteHeaderShell";
import { SiteHeaderMobile } from "./SiteHeader.mobile";

export function SiteHeader() {
  return (
    <>
      {/* Desktop Header (lg and up) - Stable architecture: fixed height + SearchSurface */}
      <div className="hidden lg:block">
        <SiteHeaderShell />
      </div>

      {/* Mobile Header (below lg, includes tablets) */}
      <div className="block lg:hidden sticky top-0 z-50">
        <SiteHeaderMobile />
      </div>
    </>
  );
}
