/**
 * Email templates for notification delivery.
 * Returns { subject, text, html } for each NotificationType.
 * Keep templates simple — plain text is always the fallback.
 */

import type { NotificationType } from "@prisma/client";
import { resolveNotificationHref } from "@/lib/notifications/notificationRegistry";
import { getCanonicalPublicAppUrl } from "@/lib/config/publicAppUrl";

interface EmailTemplate {
  subject: string;
  text: string;
  html?: string;
}

export function buildNotificationEmailTemplate(
  type: NotificationType,
  title: string,
  body: string,
  entityId?: string | null,
  ctaAction?: string | null,
  /** Санитизированный HTML из шаблонного рендера; text-часть всегда строится из plain body */
  bodyHtml?: string | null,
): EmailTemplate {
  const ctaUrl = buildCtaUrl(type, entityId, ctaAction);
  const ctaLine = ctaUrl ? `\n\nОткрыть: ${ctaUrl}` : "";

  const text = `${title}\n\n${body}${ctaLine}\n\n---\nmamaGo — семейный помощник`;
  const html = buildHtml(title, bodyHtml ?? body, ctaUrl);

  return { subject: title, text, html };
}

function buildCtaUrl(
  type: NotificationType,
  entityId?: string | null,
  ctaAction?: string | null,
): string | null {
  const appUrl = getCanonicalPublicAppUrl();
  const href = resolveNotificationHref(type, {
    entityId: entityId ?? undefined,
    entityType: undefined,
    ctaAction: ctaAction ?? undefined,
  });

  if (href) {
    return href.startsWith("http") ? href : `${appUrl}${href}`;
  }

  if (type === "WELCOME" || type === "RECOMMENDATION") {
    return `${appUrl}/me/settings/notifications`;
  }
  if (type === "REMINDER" || type === "PLAN_TOMORROW_DIGEST") return `${appUrl}/me/plan`;
  if (type === "SYSTEM") return `${appUrl}/settings`;
  if (type === "NEWS" || type === "ANNOUNCEMENT") return null;

  return `${appUrl}/business/dashboard`;
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
