import type { ReactNode } from "react";

/** Capability pages have no discovery analytics, family contexts or streaming loading boundary. */
export default function PartyShareLayout({ children }: { children: ReactNode }) {
  return children;
}
