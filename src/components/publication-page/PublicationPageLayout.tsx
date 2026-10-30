import type { ReactNode } from "react";

export const PUBLICATION_PAGE_CLASS = "ep-surface min-h-screen pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0";

/** Event's surface and mobile sticky-action clearance; feature composition stays with the caller. */
export function PublicationPageLayout({ children }: { children: ReactNode }) {
  return (
    <div className={PUBLICATION_PAGE_CLASS}>
      {children}
    </div>
  );
}
