/**
 * Категории cookies (совпадают с ключами в CookieConsent.categories).
 * Necessary не отключаются; analytics/marketing — opt-in.
 *
 * `analytics` = согласие на **внешние** инструменты веб-аналитики (скрипты), не на запись UserEvent в БД.
 */
export type CookieCategoryId = "necessary" | "analytics" | "marketing";

/** Снимок согласия для UI и хелперов (без прямого доступа к плагину). */
export type ConsentSnapshot = {
  /** Всегда true, если плагин инициализирован и категория существует */
  necessary: true;
  /** Сторонняя веб-аналитика (GA, PostHog, …), не продуктовая телеметрия mamaGo */
  analytics: boolean;
  /** Сторонние рекламные/маркетинговые скрипты */
  marketing: boolean;
  /** Пользователь выразил согласие (валидная запись плагина) */
  hasValidConsent: boolean;
};
