import type { ReactNode } from "react";
import { PublicationSection } from "./PublicationSection";

/** Event's unchanged editorial description layout. */
export function PublicationAboutSection({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <PublicationSection className="py-16 md:py-20">
      <div className="mb-4 flex items-center gap-3.5">
        <span
          className="text-[10px] font-medium uppercase tracking-[0.14em] text-[rgba(20,18,16,0.55)]"
          style={{ fontFamily: "Menlo, monospace" }}
        >
          {kicker}
        </span>
        <span className="h-px flex-1 bg-[rgba(20,18,16,0.10)]" />
      </div>
      <div className="grid grid-cols-1 gap-10 md:grid-cols-[320px_1fr] md:gap-14">
        <div>
          <h2
            style={{
              fontSize: 30,
              fontWeight: 400,
              lineHeight: 1.3,
              letterSpacing: "-0.02em",
              color: "#141210",
            }}
          >
            {title}
          </h2>
        </div>

        <div>{children}</div>
      </div>
    </PublicationSection>
  );
}
