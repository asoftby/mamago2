/**
 * Email Footer Block Component
 * 
 * Reusable footer component for all email templates.
 * Single source of truth for brand footer rendering.
 */

import * as React from "react";
import { Section, Text } from "@react-email/components";

export type EmailFooterBlockProps = {
  /**
   * Home page URL (for mamaGo brand link)
   */
  homeUrl: string;

  /**
   * Unsubscribe URL (optional, shown only if provided)
   */
  unsubscribeUrl?: string | null;

  /**
   * Support email (optional, shown if provided)
   */
  supportEmail?: string | null;
};

const FOOTER_TEXT_STYLE = {
  margin: "0",
  fontSize: "13px",
  lineHeight: "20px",
  color: "#9ca3af",
} as const;

const FOOTER_LINK_STYLE = {
  color: "#6b7280",
  textDecoration: "underline",
} as const;

const BRAND_LINK_STYLE = {
  color: "#6b7280",
  textDecoration: "underline",
  fontWeight: "500",
} as const;

const META_TEXT_STYLE = {
  margin: "12px 0 0",
  fontSize: "12px",
  lineHeight: "18px",
  color: "#9ca3af",
} as const;

/**
 * Email Footer Block
 * 
 * Renders branded footer with:
 * - mamaGo brand link and tagline
 * - Support email (if provided)
 * - Unsubscribe link (if provided)
 */
export function EmailFooterBlock({
  homeUrl,
  unsubscribeUrl,
  supportEmail,
}: EmailFooterBlockProps) {
  return (
    <Section style={{ margin: "32px 0 0" }}>
      {/* Brand and tagline */}
      <Text style={FOOTER_TEXT_STYLE}>
        <a href={homeUrl} style={BRAND_LINK_STYLE}>
          mamaGo
        </a>
        {" — "}
        амбассадор фамилинга.
        <br />
        Персональный помощник в организации семейного отдыха и развития.
      </Text>

      {/* Support email */}
      {supportEmail ? (
        <Text style={META_TEXT_STYLE}>
          Поддержка:{" "}
          <a href={`mailto:${supportEmail}`} style={FOOTER_LINK_STYLE}>
            {supportEmail}
          </a>
        </Text>
      ) : null}

      {/* Unsubscribe link */}
      {unsubscribeUrl ? (
        <Text style={META_TEXT_STYLE}>
          <a href={unsubscribeUrl} style={FOOTER_LINK_STYLE}>
            Отписаться от рассылки
          </a>
        </Text>
      ) : null}
    </Section>
  );
}
