import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

import { emailFontStack, emailTheme } from "./email-theme";

export interface EmailLayoutProps {
  preview: string;
  children: React.ReactNode;
}

/**
 * Shared, email-client-safe shell. Layout and branding are controlled by
 * code; individual templates only supply content.
 */
export function EmailLayout({ preview, children }: EmailLayoutProps) {
  return (
    <Html lang="ru">
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <table role="presentation" width="100%" cellPadding="0" cellSpacing="0">
            <tbody>
              <tr>
                <td style={innerPadding}>
                  <Section style={header}>
                    <Text style={brandTitle}>
                      <span style={{ color: emailTheme.ink }}>mama</span>
                      <span style={{ color: emailTheme.accent }}>Go</span>
                    </Text>
                    <Text style={brandCaption}>Для моментов, которые хочется запомнить</Text>
                  </Section>
                  <Section style={content}>{children}</Section>
                </td>
              </tr>
            </tbody>
          </table>
        </Container>
        <Text style={outsideFooter}>mamaGo.by · Идеи и планы для вашей семьи</Text>
      </Body>
    </Html>
  );
}

const main: React.CSSProperties = {
  backgroundColor: emailTheme.canvas,
  fontFamily: emailFontStack,
  margin: 0,
  padding: "32px 0",
  color: emailTheme.ink,
};

const container: React.CSSProperties = {
  backgroundColor: emailTheme.paper,
  borderRadius: 20,
  margin: "0 auto",
  maxWidth: 600,
  width: "94%",
};

const innerPadding: React.CSSProperties = {
  padding: "32px 30px",
};

const header: React.CSSProperties = {
  margin: "0 0 28px",
  padding: "0 0 20px",
  borderBottom: `1px solid ${emailTheme.border}`,
};

const brandTitle: React.CSSProperties = {
  fontSize: 25,
  fontWeight: 750,
  letterSpacing: "-0.04em",
  lineHeight: "30px",
  margin: "0 0 5px",
};

const brandCaption: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.02em",
  lineHeight: "16px",
  color: emailTheme.mutedLight,
  margin: 0,
};

const content: React.CSSProperties = {
  color: emailTheme.text,
  fontSize: 16,
  lineHeight: 1.6,
};

const outsideFooter: React.CSSProperties = {
  color: emailTheme.mutedLight,
  fontSize: 12,
  lineHeight: "18px",
  textAlign: "center",
  margin: "20px 0 0",
};

export { emailTheme } from "./email-theme";
