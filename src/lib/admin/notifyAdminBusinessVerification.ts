/**
 * Уведомление администратора о новой заявке на верификацию бизнеса.
 * Работает только при настроенных переменных окружения (см. ниже).
 *
 * Опционально:
 * - TELEGRAM_ADMIN_BOT_TOKEN + TELEGRAM_ADMIN_CHAT_ID — сообщение в Telegram
 * - ADMIN_NOTIFY_WEBHOOK_URL — POST JSON с полем type и данными заявки
 * - RESEND_API_KEY + RESEND_FROM_EMAIL + ADMIN_NOTIFICATION_EMAIL — письмо через Resend
 */

export type BusinessVerificationNotifyPayload = {
  businessId: string;
  name: string;
  legalName: string | null;
  unp: string | null;
  ownerEmail: string | null;
};

function adminPanelUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  return base ? `${base}/admin/b2b/requests?status=PENDING` : "";
}

function buildMessage(p: BusinessVerificationNotifyPayload): string {
  const lines = [
    "Новая заявка на верификацию бизнеса",
    `Название: ${p.name}`,
    p.legalName ? `Юридическое название: ${p.legalName}` : null,
    p.unp ? `УНП: ${p.unp}` : null,
    p.ownerEmail ? `Владелец: ${p.ownerEmail}` : null,
    `ID: ${p.businessId}`,
  ];
  const url = adminPanelUrl();
  if (url) lines.push(`Админка: ${url}`);
  return lines.filter(Boolean).join("\n");
}

async function sendTelegram(text: string): Promise<void> {
  const token = process.env.TELEGRAM_ADMIN_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) return;

  const res = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    console.error("[notifyAdminBusinessVerification] Telegram error:", res.status, body);
  }
}

async function sendWebhook(
  payload: BusinessVerificationNotifyPayload
): Promise<void> {
  const url = process.env.ADMIN_NOTIFY_WEBHOOK_URL;
  if (!url) return;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "business_verification_pending",
      ...payload,
      adminPanelUrl: adminPanelUrl() || undefined,
    }),
  });
  if (!res.ok) {
    console.error(
      "[notifyAdminBusinessVerification] Webhook error:",
      res.status,
      await res.text()
    );
  }
}

async function sendResendEmail(text: string, subject: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const toRaw = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (!apiKey || !from || !toRaw) return;

  const to = toRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (to.length === 0) return;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      text,
    }),
  });
  if (!res.ok) {
    console.error(
      "[notifyAdminBusinessVerification] Resend error:",
      res.status,
      await res.text()
    );
  }
}

/**
 * Не бросает исключения наружу — логирует сбои в консоль.
 * Вызывать после успешного перевода заявки в PENDING.
 */
export function notifyAdminBusinessVerificationPending(
  payload: BusinessVerificationNotifyPayload
): void {
  const text = buildMessage(payload);
  const subject = `mamaGo: заявка на верификацию — ${payload.name}`;

  const configured =
    (process.env.TELEGRAM_ADMIN_BOT_TOKEN && process.env.TELEGRAM_ADMIN_CHAT_ID) ||
    process.env.ADMIN_NOTIFY_WEBHOOK_URL ||
    (process.env.RESEND_API_KEY &&
      process.env.RESEND_FROM_EMAIL &&
      process.env.ADMIN_NOTIFICATION_EMAIL);

  if (!configured) {
    console.info(
      "[notifyAdminBusinessVerification] Заявка отправлена (уведомление админу не настроено: задайте TELEGRAM_* или ADMIN_NOTIFY_WEBHOOK_URL или Resend + ADMIN_NOTIFICATION_EMAIL)",
      payload.businessId
    );
  }

  void Promise.all([
    sendTelegram(text).catch((e) =>
      console.error("[notifyAdminBusinessVerification] Telegram", e)
    ),
    sendWebhook(payload).catch((e) =>
      console.error("[notifyAdminBusinessVerification] Webhook", e)
    ),
    sendResendEmail(text, subject).catch((e) =>
      console.error("[notifyAdminBusinessVerification] Resend", e)
    ),
  ]);
}
