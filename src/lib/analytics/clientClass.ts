/**
 * Классификация клиента продуктовой телеметрии по User-Agent (ТЗ «Аналитика
 * админки», A2). Единственное место, где UA превращается в класс; сам UA
 * никуда не сохраняется.
 *
 * Бот определяется поддерживаемой библиотекой `isbot` (поисковые роботы,
 * превью мессенджеров: Telegram/WhatsApp/Viber/Facebook, headless-браузеры).
 * Пустой/отсутствующий UA — `unknown` (не бот: такие запросы не отбрасываются
 * только из-за UA, но всё равно проходят проверку идентичности).
 */
import { isbot } from "isbot";
import type { UserEventClientClass } from "@prisma/client";

export function classifyUserAgent(userAgent: string | null | undefined): UserEventClientClass {
  const ua = typeof userAgent === "string" ? userAgent.trim() : "";
  if (!ua) return "unknown";
  return isbot(ua) ? "bot" : "browser";
}

export type IngestionDecision =
  | { accept: true; clientClass: UserEventClientClass }
  | { accept: false; reason: "bot" | "no_identity" };

/**
 * Решение по входящему клиентскому событию `/api/analytics/events`:
 *   - бот по UA → не пишем (204);
 *   - аноним (нет userId) без sessionId → не пишем (204): такое событие нельзя
 *     отнести ни к визитору, ни к устройству.
 * Порядок важен: бот отсекается первым, чтобы доля ботов не занижалась.
 */
export function decideClientIngestion(input: {
  userAgent: string | null | undefined;
  userId: string | null | undefined;
  sessionId: string | null | undefined;
}): IngestionDecision {
  const clientClass = classifyUserAgent(input.userAgent);
  if (clientClass === "bot") return { accept: false, reason: "bot" };
  const hasUser = Boolean(input.userId);
  const hasSession = Boolean(input.sessionId?.trim());
  if (!hasUser && !hasSession) return { accept: false, reason: "no_identity" };
  return { accept: true, clientClass };
}
