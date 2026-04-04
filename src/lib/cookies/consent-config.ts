/**
 * Тексты баннера и модалки настроек — править здесь (RU).
 * Конфигурация категорий и GUI для vanilla-cookieconsent (Orest Bida).
 *
 * Архитектура согласия (см. docs/cookies-and-telemetry.md):
 * - Категория `analytics` здесь = только сторонние скрипты веб-аналитики (GA, GTM, PostHog и т.п.).
 *   Она НЕ управляет first-party продуктовой телеметрией (UserEvent в нашей БД).
 * - Категория `marketing` = только сторонние рекламные/маркетинговые пиксели.
 * - Продуктовые события на наших серверах — отдельный слой, не «analytics cookies» в смысле этого UI.
 */
type RunConfig = Parameters<typeof import("vanilla-cookieconsent").run>[0];

const BANNER = {
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
        "Управляет только подключением сторонних сервисов аналитики (например, Google Analytics, PostHog). Без согласия они не загружаются. Это не отключает учёт действий внутри mamaGo, который нужен для работы продукта (сохранения, план, улучшение сервиса на наших серверах).",
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
    revision: 0,
    autoShow: true,
    autoClearCookies: true,
    manageScriptTags: true,
    hideFromBots: true,
    disablePageInteraction: false,
    lazyHtmlGeneration: true,

    cookie: {
      name: "cc_cookie_mamago",
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
            { name: /^_ga/ },
            { name: /^_gid$/ },
            { name: "_gat" },
            { name: /^ph_/ },
            { name: /^gcl_/ },
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
