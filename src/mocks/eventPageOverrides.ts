import type { EventPageData } from "@/lib/event/eventPageTypes";

/**
 * Per-activity overrides for rich event page demo / staging.
 * Merge on top of ActivityMock → EventPageData builder.
 */
export type EventPageOverride = Partial<
  Pick<
    EventPageData,
    | "factChips"
    | "importantFacts"
    | "whyGo"
    | "goodFit"
    | "about"
    | "bookingNotes"
    | "organizerNote"
    | "venue"
    | "media"
    | "sessions"
    | "planDayLinks"
    | "cta"
  >
>;

export const EVENT_PAGE_OVERRIDES: Record<string, EventPageOverride> = {
  "1": {
    sessions: [
      { id: "s1", startsAt: new Date(Date.now() + 86400000).toISOString() },
      {
        id: "s2",
        startsAt: new Date(Date.now() + 86400000 + 3 * 3600000).toISOString(),
      },
      {
        id: "s3",
        startsAt: new Date(Date.now() + 2 * 86400000 + 2 * 3600000).toISOString(),
      },
    ],
    media: {
      posterUrl:
        "https://images.unsplash.com/photo-1503095392213-2d6d34b949c6?q=80&w=900",
      posterAlt: "Афиша спектакля «Маленький принц»",
      reel: {
        label: "Атмосфера события",
        // YouTube Shorts work as inline embed; swap for Instagram reel embed URL in production.
        iframeSrc: "https://www.youtube.com/embed/0nJCS7CcpBQ",
      },
      trailerYoutubeId: "aqz-KE-bpKQ",
      trailerLabel: "Официальный трейлер",
    },
    venue: {
      name: "Белорусский государственный театр кукол",
      address: "ул. Энгельса, 12",
      district: "Центральный район",
      metro: "Немига",
      landmark: "5 минут от метро",
      mapUrl: "https://maps.google.com/?q=%D1%82%D0%B5%D0%B0%D1%82%D1%80+%D0%BA%D1%83%D0%BA%D0%BE%D0%BB+%D0%9C%D0%B8%D0%BD%D1%81%D0%BA",
      routeUrl: "https://maps.google.com/?q=%D1%82%D0%B5%D0%B0%D1%82%D1%80+%D0%BA%D1%83%D0%BA%D0%BE%D0%BB+%D0%9C%D0%B8%D0%BD%D1%81%D0%BA",
    },
    factChips: [
      { id: "age", label: "6–12 лет" },
      { id: "dur", label: "1 ч 20 мин" },
      { id: "fmt", label: "Спектакль" },
      { id: "in", label: "В помещении" },
      { id: "fam", label: "Семейный" },
      { id: "lang", label: "Русский" },
    ],
    importantFacts: [
      { id: "age", label: "Возраст", value: "6–12 лет (рекомендуем)" },
      { id: "dur", label: "Длительность", value: "1 ч 20 мин, антракт нет" },
      { id: "fmt", label: "Формат", value: "Интерактивный спектакль" },
      { id: "lang", label: "Язык", value: "Русский" },
      { id: "seat", label: "Билеты", value: "Есть свободные места" },
      { id: "reg", label: "Регистрация", value: "Не требуется" },
    ],
    whyGo: [
      "Нежная история о дружбе — понятная детям и трогательная для взрослых.",
      "Кукольная сценография и свет: спокойный, не перегружающий зрительный ряд.",
      "Короткий формат без антракта — удобно для первого похода в театр.",
      "Центральная локация рядом с метро — легко вписать в день.",
    ],
    goodFit: [
      "Если вы ищете первый театр для школьника.",
      "Если нужен спокойный сценарий на вечер без беготни.",
      "Если хотите обсудить спектакль после — сюжет задаёт темы.",
    ],
    about: {
      summary:
        "Классика в бережной режиссуре: Маленький принц встречает Лиса, Розу и путешествует между планетами. Спектакль про дружбу и ответственность — без пугающих сцен.",
      full:
        "Постановка рассчитана на семейный просмотр. Рекомендуем приехать за 15–20 минут, чтобы спокойно занять места и привыкнуть к залу. В фойе можно оставить коляску в специальной зоне.\n\nПосле спектакля дети часто задают вопросы про героев — это хороший повод продолжить разговор дома.",
      highlights: [
        "Интерактивные эпизоды с мягким вовлечением зрителей.",
        "Адаптированный текст без резких сцен.",
        "Памятка для родителей в программке.",
      ],
    },
    bookingNotes: "Билеты проверяются при входе — можно показать с телефона.",
    organizerNote:
      "mamaGo отмечает: у театра удобные семейные места в партере — при бронировании уточняйте ряд у кассы.",
    planDayLinks: {
      nearbyHref: "/minsk/kuda",
    },
    cta: {
      planLabel: "В план",
      buyLabel: "Купить билет",
      saveLabel: "В идеи",
    },
  },
};
