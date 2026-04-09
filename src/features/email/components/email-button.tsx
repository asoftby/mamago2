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
        borderRadius: 8,
        color: "#ffffff",
        display: "inline-block",
        fontSize: 15,
        fontWeight: 600,
        lineHeight: "20px",
        padding: "12px 24px",
        textDecoration: "none",
      }}
    >
      {children}
    </Button>
  );
}
