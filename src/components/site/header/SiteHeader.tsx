"use client";

import { SiteHeaderDesktop } from "./SiteHeader.desktop";
import { SiteHeaderMobile } from "./SiteHeader.mobile";

export function SiteHeader() {
  return (
    <>
      {/* Desktop Header (lg and up) */}
      <div className="hidden lg:block sticky top-0 z-[100]">
        <SiteHeaderDesktop />
      </div>

      {/* Mobile Header (below lg, includes tablets) */}
      <div className="block lg:hidden sticky top-0 z-50">
        <SiteHeaderMobile />
      </div>
    </>
  );
}
