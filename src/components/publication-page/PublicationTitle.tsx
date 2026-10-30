import type { ReactNode } from "react";

/** Event's unchanged display title, shared by public publication types. */
export function PublicationTitle({ children }: { children: ReactNode }) {
  return (
    <h1
      style={{
        margin: 0,
        fontFamily: "var(--font-sans)",
        fontSize: 40,
        fontWeight: 600,
        lineHeight: 1.1,
        letterSpacing: "-0.025em",
        color: "#141210",
      }}
    >
      {children}
    </h1>
  );
}
