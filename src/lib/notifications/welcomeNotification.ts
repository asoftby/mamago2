/**
 * Приветственное SYSTEM-уведомление для новых пользователей.
 * entityType / entityId — договорённость для UI (CTA), без миграций БД.
 */

export const WELCOME_NOTIFICATION_ENTITY_TYPE = "WELCOME";
export const WELCOME_CTA_ACTION_CONNECT_TELEGRAM = "connect_telegram";

export const WELCOME_NOTIFICATION_TITLE = "Добро пожаловать в mamaGo";

/** Убирает хвостовой 🎉 у старых записей в БД */
export function displayWelcomeNotificationTitle(storedTitle: string): string {
  return storedTitle.replace(/\s*🎉\s*$/u, "").trim();
}

export const WELCOME_NOTIFICATION_BODY = `Мы поможем вам находить лучшие события и идеи для детей и легко собирать план на день.

Сохраняйте интересные варианты, добавляйте их в план и собирайте готовые сценарии для семьи — без лишнего стресса и поисков.`;

/** Старые записи в БД могли содержать этот абзац — скрываем в UI */
export const WELCOME_DEPRECATED_TELEGRAM_PROMPT_LINE =
  "Чтобы ничего не пропустить, подключите уведомления 👇";

export const WELCOME_CTA_LABEL = "Подключить Telegram";
export const WELCOME_TELEGRAM_SETTINGS_HREF = "/me/settings/notifications";

export function isWelcomeTelegramCta(row: {
  type: string;
  ctaAction: string | null;
  entityType?: string | null;
  entityId?: string | null;
}): boolean {
  if (
    row.type === "WELCOME" &&
    row.ctaAction === WELCOME_CTA_ACTION_CONNECT_TELEGRAM
  ) {
    return true;
  }
  return (
    row.entityType === WELCOME_NOTIFICATION_ENTITY_TYPE &&
    row.entityId === WELCOME_CTA_ACTION_CONNECT_TELEGRAM
  );
}
