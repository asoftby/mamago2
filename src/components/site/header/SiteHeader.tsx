"use client";

import { DesktopHeader } from "./DesktopHeader";
import { MobileHeader } from "./MobileHeader";

/**
 * Два независимых хедера по breakpoint `lg` (без общего `landing` на mobile).
 * @see DesktopHeader — посадочные страницы без поисковой строки
 * @see MobileHeader — всегда discovery-UX (поиск + фильтры)
 */
export function SiteHeader() {
  return (
    <>
      <div className="m-0 hidden p-0 lg:contents">
        <DesktopHeader />
      </div>
      <div className="contents lg:hidden">
        <MobileHeader />
      </div>
    </>
  );
}
