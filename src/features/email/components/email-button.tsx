import { Button } from "@react-email/components";
import * as React from "react";

import { emailTheme } from "./email-layout";

export interface EmailButtonProps {
  href: string;
  children: React.ReactNode;
}

export function EmailButton({ href, children }: EmailButtonProps) {
  return (
    <Button
      href={href}
      style={{
        backgroundColor: emailTheme.accent,
        borderRadius: 12,
        color: "#ffffff",
        display: "inline-block",
        fontSize: 15,
        fontWeight: 700,
        lineHeight: "20px",
        padding: "15px 26px",
        textDecoration: "none",
      }}
    >
      {children}
    </Button>
  );
}
