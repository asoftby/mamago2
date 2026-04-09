import { Hr, Text } from "@react-email/components";
import * as React from "react";

import { emailTheme } from "./email-layout";

export interface EmailFooterProps {
  reason: string;
}

export function EmailFooter({ reason }: EmailFooterProps) {
  return (
    <>
      <Hr
        style={{
          borderColor: "#eeeeee",
          borderStyle: "solid",
          borderWidth: "1px 0 0 0",
          margin: "28px 0 20px",
        }}
      />
      <Text
        style={{
          color: emailTheme.muted,
          fontSize: 13,
          lineHeight: 1.5,
          margin: 0,
        }}
      >
        {reason}
      </Text>
    </>
  );
}
