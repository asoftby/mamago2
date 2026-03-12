"use client";

import { SiteHeaderDesktop } from "./SiteHeader.desktop";
import { SiteHeaderMobile } from "./SiteHeader.mobile";

export function SiteHeader() {
  return (
    <>
      {/* Desktop Header (md and up) */}
      <SiteHeaderDesktop />

      {/* Mobile Header (below md) */}
      <div className="block md:hidden">
        <SiteHeaderMobile />
      </div>
    </>
  );
}
