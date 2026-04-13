/**
 * Email templates for notification delivery.
 * Returns { subject, text, html } for each NotificationType.
 * Keep templates simple — plain text is always the fallback.
 */

import type { NotificationType } from "@prisma/client";

interface EmailTemplate {
  subject: string;
  text: string;
  html?: string;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://mamago.by";

export function buildNotificationEmailTemplate(
  type: NotificationType,
  title: string,
  body: string,
  entityId?: string | null,
): EmailTemplate {
  const ctaUrl = buildCtaUrl(type, entityId);
  const ctaLine = ctaUrl ? `\n\nОткрыть: ${ctaUrl}` : "";

  const text = `${title}\n\n${body}${ctaLine}\n\n---\nmamaGo — семейный помощник`;
  const html = buildHtml(title, body, ctaUrl);

  return { subject: title, text, html };
}

function buildCtaUrl(type: NotificationType, entityId?: string | null): string | null {
  // USER types — link to notification settings or plan
  if (type === "WELCOME" || type === "RECOMMENDATION") {
    return `${APP_URL}/me/settings/notifications`;
  }
  if (type === "REMINDER") return `${APP_URL}/me/plan`;
  if (type === "SYSTEM") return `${APP_URL}/me/settings/notifications`;
  if (type === "NEWS" || type === "ANNOUNCEMENT") return null;

  if (!entityId) return `${APP_URL}/business/dashboard`;

  if (type.startsWith("PLACE_")) return `${APP_URL}/editor/place/${entityId}/edit`;
  if (type.startsWith("ACTIVITY_")) return `${APP_URL}/editor/event/${entityId}/edit`;
  if (type.startsWith("OFFER_")) return `${APP_URL}/editor/offer/${entityId}/edit`;
  if (type.startsWith("BUSINESS_")) return `${APP_URL}/business/verification`;

  return `${APP_URL}/business/dashboard`;
}

function buildHtml(title: string, body: string, ctaUrl: string | null): string {
  const btn = ctaUrl
    ? `<p><a href="${ctaUrl}" style="background:#EF8759;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Открыть</a></p>`
    : "";

  return `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1F1F1F;">
  <h2 style="margin-bottom:8px;">${title}</h2>
  <p style="color:#555;line-height:1.6;">${body}</p>
  ${btn}
  <hr style="margin-top:32px;border:none;border-top:1px solid #eee;"/>
  <p style="font-size:12px;color:#aaa;">mamaGo — семейный помощник</p>
</body>
</html>`.trim();
}
