import type { ReactNode } from "react";

/** Event's surface and mobile sticky-action clearance; feature composition stays with the caller. */
export function PublicationPageLayout({ children }: { children: ReactNode }) {
  return (
    <div className="ep-surface min-h-screen pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0">
      {children}
    </div>
  );
}
