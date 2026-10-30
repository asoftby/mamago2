import type { ReactNode } from "react";

export function PublicationSectionHeading({
  kicker,
  title,
}: {
  kicker: string;
  title: ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center gap-3.5">
        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted">
          {kicker}
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <h2 className="text-[30px] font-normal leading-[1.3] tracking-[-0.02em] text-text-main">
        {title}
      </h2>
    </div>
  );
}
