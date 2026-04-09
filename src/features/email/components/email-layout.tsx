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

const accent = "#EF8759";
const text = "#1a1a1a";
const muted = "#5c5c5c";
const bg = "#ffffff";

export interface EmailLayoutProps {
  preview: string;
  children: React.ReactNode;
}

export function EmailLayout({ preview, children }: EmailLayoutProps) {
  return (
    <Html lang="ru">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Text style={brandTitle}>mamaGo</Text>
          </Section>
          <Section style={content}>{children}</Section>
        </Container>
      </Body>
    </Html>
  );
}

const main: React.CSSProperties = {
  backgroundColor: "#f6f6f6",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  margin: 0,
  padding: "32px 16px",
};

const container: React.CSSProperties = {
  backgroundColor: bg,
  borderRadius: 12,
  margin: "0 auto",
  maxWidth: 520,
  overflow: "hidden",
  padding: "40px 36px",
};

const header: React.CSSProperties = {
  marginBottom: 28,
};

const brandTitle: React.CSSProperties = {
  color: accent,
  fontSize: 22,
  fontWeight: 600,
  letterSpacing: "-0.02em",
  lineHeight: 1.2,
  margin: 0,
};

const content: React.CSSProperties = {
  color: text,
  fontSize: 16,
  lineHeight: 1.55,
};

export const emailTheme = { accent, text, muted, bg };
