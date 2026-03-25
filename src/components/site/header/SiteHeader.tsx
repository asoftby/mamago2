"use client";

import { SiteHeaderShell } from "./SiteHeaderShell";
import { SiteHeaderMobile } from "./SiteHeader.mobile";

export function SiteHeader() {
  return (
    <>
      {/* Desktop Header (lg and up) - Stable architecture: fixed height + SearchSurface */}
      <div className="m-0 hidden p-0 lg:block">
        <SiteHeaderShell />
      </div>

      {/* Mobile Header (below lg) — glass + inline backdrop (см. SiteHeader.mobile) */}
      <div className="block lg:hidden">
        <SiteHeaderMobile />
      </div>
    </>
  );
}
