/**
 * Показ pinned Telegram banner:
 * - Telegram не подключён
 * - welcome уже прочитано
 *
 * Нет cooldown — плашка показывается при каждом открытии уведомлений
 * пока пользователь не подключит Telegram.
 */
export function shouldShowTelegramPrompt(user: {
  telegramConnected: boolean;
  welcomeIsRead?: boolean;
}): boolean {
  if (user.telegramConnected) return false;
  if (user.welcomeIsRead === false) return false;
  return true;
}
