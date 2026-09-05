/**
 * Тексты баннера и модалки настроек — править здесь (RU).
 * Конфигурация категорий и GUI для vanilla-cookieconsent (Orest Bida).
 *
 * Архитектура согласия (см. docs/cookies-and-telemetry.md):
 * - Категория `analytics` здесь = только сторонние скрипты веб-аналитики (Google Analytics 4,
 *   Yandex Metrica). Она НЕ управляет first-party продуктовой телеметрией (UserEvent в нашей БД).
 * - Категория `marketing` = только сторонние рекламные/маркетинговые пиксели.
 * - Продуктовые события на наших серверах — отдельный слой, не «analytics cookies» в смысле этого UI.
 */
import { CONSENT_COOKIE_NAME } from "./consent-cookie-format";

type RunConfig = Parameters<typeof import("vanilla-cookieconsent").run>[0];

/**
 * Exported so `CookieConsentShell` (the fast, SSR-rendered first-paint
 * banner — see components/providers/CookieConsentShell.tsx) can reuse the
 * exact same copy instead of duplicating it.
 */
export const BANNER = {
  title: "Cookies и данные",
  description:
    "Для работы сайта нужны необходимые cookies и базовые данные сервиса. Сторонние инструменты веб-аналитики и рекламы мы подключаем только с вашего согласия.",
  acceptAll: "Принять все",
  necessaryOnly: "Только необходимые",
  customize: "Настроить",
} as const;

const PREFERENCES = {
  title: "Настройки cookies",
  acceptAll: "Принять все",
  necessaryOnly: "Только необходимые",
  save: "Сохранить выбор",
  close: "Закрыть",
  sections: {
    necessary: {
      title: "Необходимые cookies",
      description:
        "Нужны для работы сайта, сессии, безопасности, сохранения ваших настроек и основных функций сервиса (вход, план, избранное и т.д.). Отключить их нельзя.",
    },
    analytics: {
      title: "Внешняя веб-аналитика",
      description:
        "Управляет только подключением сторонних сервисов аналитики: Google Analytics 4 и Яндекс.Метрика. Без согласия они не загружаются. Это не отключает учёт действий внутри mamaGo, который нужен для работы продукта (сохранения, план, улучшение сервиса на наших серверах).",
    },
    marketing: {
      title: "Маркетинг и реклама",
      description:
        "Управляет только сторонними рекламными и маркетинговыми технологиями (например, пиксели Meta, TikTok). Без согласия они не подключаются.",
    },
  },
} as const;

/**
 * Собирает конфиг для CookieConsent.run.
 * Колбэки вызываются при любом обновлении согласия (в т.ч. после загрузки cookie).
 */
export function createCookieConsentRunConfig(
  onConsentUpdated: () => void,
): RunConfig {
  return {
    mode: "opt-in",
    // Bumped 0 -> 1: the external analytics provider set changed (Yandex Metrica
    // added). Existing consent must be re-collected rather than silently reused.
    // Keep in sync with CONSENT_REVISION in consent-cookie-format.ts (see that
    // file's comment for why it's a duplicated literal, not a shared import) —
    // externalAnalyticsContract.test.ts and consent-cookie-format.test.ts both
    // pin this exact `revision: <number>` shape.
    revision: 1,
    // false: showing the modal is driven explicitly by ensureConsentModalShown()
    // (consent-manager.ts) once init resolves, so it can hand off cleanly from
    // the fast SSR CookieConsentShell without a moment where both are visible.
    autoShow: false,
    autoClearCookies: true,
    manageScriptTags: true,
    hideFromBots: true,
    disablePageInteraction: false,
    lazyHtmlGeneration: true,

    cookie: {
      name: CONSENT_COOKIE_NAME,
      expiresAfterDays: 365,
      path: "/",
      sameSite: "Lax",
    },

    guiOptions: {
      consentModal: {
        layout: "box",
        position: "bottom center",
        flipButtons: false,
        equalWeightButtons: true,
      },
      preferencesModal: {
        layout: "box",
        position: "right",
        flipButtons: false,
        equalWeightButtons: true,
      },
    },

    categories: {
      necessary: {
        enabled: true,
        readOnly: true,
      },
      analytics: {
        enabled: false,
        autoClear: {
          cookies: [
            // Google Analytics 4 (first-party, our domain).
            { name: /^_ga/ },
            { name: /^_gid$/ },
            { name: "_gat" },
            { name: /^gcl_/ },
            // Yandex Metrica (first-party, our domain only — the plugin can't
            // reach cookies scoped to yandex.ru itself).
            { name: /^_ym_/ },
          ],
        },
      },
      marketing: {
        enabled: false,
        autoClear: {
          cookies: [
            { name: /^_fbp/ },
            { name: /^_fbc/ },
            { name: /^tt_/ },
            { name: "tt_pixel" },
          ],
        },
      },
    },

    language: {
      default: "ru",
      translations: {
        ru: {
          consentModal: {
            title: BANNER.title,
            description: BANNER.description,
            acceptAllBtn: BANNER.acceptAll,
            acceptNecessaryBtn: BANNER.necessaryOnly,
            showPreferencesBtn: BANNER.customize,
          },
          preferencesModal: {
            title: PREFERENCES.title,
            acceptAllBtn: PREFERENCES.acceptAll,
            acceptNecessaryBtn: PREFERENCES.necessaryOnly,
            savePreferencesBtn: PREFERENCES.save,
            closeIconLabel: PREFERENCES.close,
            sections: [
              {
                title: PREFERENCES.sections.necessary.title,
                description: PREFERENCES.sections.necessary.description,
                linkedCategory: "necessary",
              },
              {
                title: PREFERENCES.sections.analytics.title,
                description: PREFERENCES.sections.analytics.description,
                linkedCategory: "analytics",
              },
              {
                title: PREFERENCES.sections.marketing.title,
                description: PREFERENCES.sections.marketing.description,
                linkedCategory: "marketing",
              },
            ],
          },
        },
      },
    },

    onFirstConsent: () => {
      onConsentUpdated();
    },
    onConsent: () => {
      onConsentUpdated();
    },
    onChange: () => {
      onConsentUpdated();
    },
  };
}
