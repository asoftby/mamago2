import type { ReactNode } from "react";
import { ActivityTicketCard, type ActivityTicketSource } from "./ActivityTicketCard";

/** Shared publication context for the date and collection slides. */
export function SaveActivityHeader({ heading, ticket }: { heading: ReactNode; ticket: ActivityTicketSource }) {
  return (
    <>
      <div className="mb-1 flex h-10 -translate-y-1 items-center justify-start sm:translate-y-0">
        <span style={{
          fontFamily: "var(--font-mono, ui-monospace)", textTransform: "uppercase",
          fontSize: 10, letterSpacing: ".14em", color: "#C24E22", whiteSpace: "nowrap",
        }}>сохранить активность</span>
      </div>
      <h2 style={{
        margin: "0 0 8px", fontFamily: "var(--font-sans)",
        fontSize: 30, lineHeight: 1.02, letterSpacing: "-.02em", fontWeight: 400,
      }}>{heading}</h2>
      <div style={{ marginTop: 18, marginBottom: 18 }}>
        <ActivityTicketCard source={ticket} />
      </div>
    </>
  );
}
