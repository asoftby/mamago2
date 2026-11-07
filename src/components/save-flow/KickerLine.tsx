import * as React from "react";
import { C } from "./tokens";

export function KickerLine({ label, rightEl }: { label: string; rightEl?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
      <span style={{
        fontFamily: "var(--font-mono, ui-monospace)", textTransform: "uppercase",
        fontSize: 10, letterSpacing: ".14em", color: C.ink3, whiteSpace: "nowrap",
      }}>{label}</span>
      <span style={{ flex: 1, height: 1, background: C.line }} />
      {rightEl}
    </div>
  );
}
