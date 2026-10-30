import type { ReactNode } from "react";
import { Container } from "@/components/ui/Container";

/** Presentation only. Callers own media mapping, decision content, refs and actions. */
export function PublicationHeroLayout({ media, decision }: { media: ReactNode; decision: ReactNode }) {
  return (
    <section className="pt-4 pb-14 lg:pt-12">
      <Container>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[440px_1fr] lg:gap-14 lg:items-start">
          <div>{media}</div>
          {decision}
        </div>
      </Container>
    </section>
  );
}
