import type { ReactNode } from "react";
import { Container } from "@/components/ui/Container";

/** No content policy: the caller decides whether and where a populated section appears. */
export function PublicationSection({ children, className }: { children: ReactNode; className: string }) {
  return (
    <section className={className}>
      <Container>{children}</Container>
    </section>
  );
}
