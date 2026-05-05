/**
 * Event Signal Mapping
 * 
 * Mapping между Event categories/genres и Discovery/Profile signals.
 * Используется для автоматического предложения signals при выборе категории/жанров.
 * 
 * Правила:
 * - Category/genre остаются основной taxonomy
 * - Signals используются для рекомендаций и фильтров
 * - Автоматически предложенные signals можно редактировать
 * - Recommendation signals (energy/tempo) не показываются в UI
 */

export interface EventSignalSuggestion {
  activitySignalSlugs: string[];
  formatSignalSlugs: string[];
  intentionSignalSlugs: string[];
  interestSignalSlugs: string[];
}

/**
 * Mapping категорий на signals
 */
const CATEGORY_SIGNAL_MAP: Record<string, EventSignalSuggestion> = {
  // Спектакли
  theatre: {
    activitySignalSlugs: ["activity-entertainment", "activity-calm", "activity-creative"],
    formatSignalSlugs: ["format-indoor"],
    intentionSignalSlugs: [],
    interestSignalSlugs: [],
  },

  // Мастер-классы
  workshops: {
    activitySignalSlugs: ["activity-creative", "activity-educational", "activity-social"],
    formatSignalSlugs: ["format-indoor"],
    intentionSignalSlugs: [],
    interestSignalSlugs: [],
  },

  // Праздники и фестивали
  festivals: {
    activitySignalSlugs: ["activity-entertainment", "activity-social"],
    formatSignalSlugs: ["format-outdoor"],
    intentionSignalSlugs: [],
    interestSignalSlugs: [],
  },

  // Концерты и шоу
  shows: {
    activitySignalSlugs: ["activity-entertainment", "activity-calm"],
    formatSignalSlugs: ["format-indoor"],
    intentionSignalSlugs: [],
    interestSignalSlugs: [],
  },

  // Экскурсии и программы
  excursions: {
    activitySignalSlugs: ["activity-educational", "activity-calm"],
    formatSignalSlugs: ["format-outdoor"],
    intentionSignalSlugs: [],
    interestSignalSlugs: [],
  },

  // Спортивные события
  "sports-events": {
    activitySignalSlugs: ["activity-active"],
    formatSignalSlugs: ["format-outdoor"],
    intentionSignalSlugs: [],
    interestSignalSlugs: ["sport"],
  },

  // Выставки и экспозиции
  exhibitions: {
    activitySignalSlugs: ["activity-calm", "activity-educational"],
    formatSignalSlugs: ["format-indoor"],
    intentionSignalSlugs: [],
    interestSignalSlugs: [],
  },

  // Игровые программы
  "play-programs": {
    activitySignalSlugs: ["activity-entertainment", "activity-active", "activity-social"],
    formatSignalSlugs: ["format-indoor"],
    intentionSignalSlugs: [],
    interestSignalSlugs: [],
  },

  // Образовательные занятия
  classes: {
    activitySignalSlugs: ["activity-educational"],
    formatSignalSlugs: ["format-indoor"],
    intentionSignalSlugs: [],
    interestSignalSlugs: [],
  },

  // Киберспорт и игры
  esports: {
    activitySignalSlugs: ["activity-entertainment", "activity-educational", "activity-social"],
    formatSignalSlugs: ["format-indoor"],
    intentionSignalSlugs: [],
    interestSignalSlugs: ["technology"],
  },
};

/**
 * Mapping жанров на дополнительные signals
 */
const GENRE_SIGNAL_MAP: Record<string, Partial<EventSignalSuggestion>> = {
  // Спектакли
  puppet: {
    interestSignalSlugs: ["creativity"],
  },
  musical: {
    interestSignalSlugs: ["music"],
  },
  interactive: {
    activitySignalSlugs: ["activity-social", "activity-entertainment"],
  },
  immersive: {
    intentionSignalSlugs: [],
  },
  "shadow-theatre": {
    interestSignalSlugs: ["creativity"],
  },

  // Мастер-классы
  creative: {
    activitySignalSlugs: ["activity-creative"],
  },
  cooking: {
    activitySignalSlugs: ["activity-food", "activity-creative"],
  },
  science: {
    activitySignalSlugs: ["activity-educational"],
    interestSignalSlugs: ["science"],
  },
  craft: {
    activitySignalSlugs: ["activity-creative"],
  },
  "it-tech": {
    activitySignalSlugs: ["activity-educational"],
    interestSignalSlugs: ["technology"],
  },

  // Праздники и фестивали
  "city-festival": {
    formatSignalSlugs: ["format-outdoor"],
  },
  "family-festival": {
    intentionSignalSlugs: [],
  },
  seasonal: {
    formatSignalSlugs: ["format-outdoor"],
  },
  fair: {
    activitySignalSlugs: ["activity-food"],
    formatSignalSlugs: ["format-outdoor"],
  },
  "themed-party": {
    activitySignalSlugs: ["activity-entertainment", "activity-social"],
  },

  // Концерты и шоу
  "kids-concert": {
    interestSignalSlugs: ["music"],
  },
  "music-show": {
    interestSignalSlugs: ["music"],
  },
  "circus-show": {
    activitySignalSlugs: ["activity-entertainment", "activity-active"],
  },
  "science-show": {
    activitySignalSlugs: ["activity-educational"],
    interestSignalSlugs: ["science"],
  },
  "ice-show": {
    activitySignalSlugs: ["activity-entertainment"],
    interestSignalSlugs: ["sport"],
  },

  // Экскурсии и программы
  "museum-program": {
    activitySignalSlugs: ["activity-educational"],
    formatSignalSlugs: ["format-indoor"],
  },
  "city-tour": {
    formatSignalSlugs: ["format-outdoor"],
  },
  "nature-tour": {
    formatSignalSlugs: ["format-outdoor"],
    interestSignalSlugs: ["nature"],
  },
  "educational-program": {
    activitySignalSlugs: ["activity-educational"],
  },
  "quest-tour": {
    activitySignalSlugs: ["activity-entertainment", "activity-educational", "activity-active"],
  },

  // Спортивные события
  competition: {
    activitySignalSlugs: ["activity-active"],
  },
  tournament: {
    activitySignalSlugs: ["activity-active"],
  },
  "open-training": {
    activitySignalSlugs: ["activity-active", "activity-educational"],
  },
  race: {
    activitySignalSlugs: ["activity-active"],
    formatSignalSlugs: ["format-outdoor"],
  },
  "family-sport": {
    activitySignalSlugs: ["activity-active"],
  },

  // Выставки и экспозиции
  "interactive-exhibition": {
    activitySignalSlugs: ["activity-educational", "activity-social"],
  },
  "art-exhibition": {
    interestSignalSlugs: ["creativity"],
  },
  "science-exhibition": {
    interestSignalSlugs: ["science"],
  },
  "history-exhibition": {
    activitySignalSlugs: ["activity-educational"],
  },
  "kids-exhibition": {
    intentionSignalSlugs: [],
  },

  // Игровые программы
  quest: {
    activitySignalSlugs: ["activity-entertainment", "activity-educational"],
  },
  animation: {
    activitySignalSlugs: ["activity-entertainment", "activity-social"],
  },
  "board-games": {
    activitySignalSlugs: ["activity-calm", "activity-social"],
  },
  "active-games": {
    activitySignalSlugs: ["activity-active"],
  },
  "role-play": {
    activitySignalSlugs: ["activity-creative", "activity-social"],
  },

  // Образовательные занятия
  "development-class": {
    activitySignalSlugs: ["activity-educational"],
  },
  "language-class": {
    activitySignalSlugs: ["activity-educational"],
  },
  "preschool-prep": {
    activitySignalSlugs: ["activity-educational"],
  },
  "kids-lecture": {
    activitySignalSlugs: ["activity-educational", "activity-calm"],
  },
  "practical-class": {
    activitySignalSlugs: ["activity-educational", "activity-creative"],
  },

  // Киберспорт и игры
  "esports-tournament": {
    interestSignalSlugs: ["technology"],
  },
  "gaming-event": {
    interestSignalSlugs: ["technology"],
  },
  lan: {
    interestSignalSlugs: ["technology"],
    activitySignalSlugs: ["activity-social"],
  },
  "console-gaming": {
    interestSignalSlugs: ["technology"],
    activitySignalSlugs: ["activity-entertainment"],
  },
  "vr-gaming": {
    interestSignalSlugs: ["technology"],
  },
};

/**
 * Получить suggested signals для события на основе категории и жанров
 */
export function getSuggestedEventSignals(
  categorySlug: string | null,
  genreSlugs: string[] = []
): EventSignalSuggestion {
  const result: EventSignalSuggestion = {
    activitySignalSlugs: [],
    formatSignalSlugs: [],
    intentionSignalSlugs: [],
    interestSignalSlugs: [],
  };

  // Если нет категории, возвращаем пустой результат
  if (!categorySlug) {
    return result;
  }

  // Получаем signals из категории
  const categorySignals = CATEGORY_SIGNAL_MAP[categorySlug];
  if (categorySignals) {
    result.activitySignalSlugs.push(...categorySignals.activitySignalSlugs);
    result.formatSignalSlugs.push(...categorySignals.formatSignalSlugs);
    result.intentionSignalSlugs.push(...categorySignals.intentionSignalSlugs);
    result.interestSignalSlugs.push(...categorySignals.interestSignalSlugs);
  }

  // Добавляем signals из жанров
  for (const genreSlug of genreSlugs) {
    const genreSignals = GENRE_SIGNAL_MAP[genreSlug];
    if (genreSignals) {
      if (genreSignals.activitySignalSlugs) {
        result.activitySignalSlugs.push(...genreSignals.activitySignalSlugs);
      }
      if (genreSignals.formatSignalSlugs) {
        result.formatSignalSlugs.push(...genreSignals.formatSignalSlugs);
      }
      if (genreSignals.intentionSignalSlugs) {
        result.intentionSignalSlugs.push(...genreSignals.intentionSignalSlugs);
      }
      if (genreSignals.interestSignalSlugs) {
        result.interestSignalSlugs.push(...genreSignals.interestSignalSlugs);
      }
    }
  }

  // Удаляем дубликаты
  result.activitySignalSlugs = [...new Set(result.activitySignalSlugs)];
  result.formatSignalSlugs = [...new Set(result.formatSignalSlugs)];
  result.intentionSignalSlugs = [...new Set(result.intentionSignalSlugs)];
  result.interestSignalSlugs = [...new Set(result.interestSignalSlugs)];

  return result;
}

/**
 * Преобразовать signal slugs в IDs
 */
export async function resolveSignalSlugsToIds(
  slugs: string[],
  prisma: any
): Promise<string[]> {
  if (slugs.length === 0) return [];

  const signals = await prisma.signalDefinition.findMany({
    where: {
      slug: { in: slugs },
      isActive: true,
      status: "ACTIVE",
    },
    select: {
      id: true,
    },
  });

  return signals.map((s: { id: string }) => s.id);
}

/**
 * Получить все suggested signal IDs для события
 */
export async function getSuggestedEventSignalIds(
  categorySlug: string | null,
  genreSlugs: string[] = [],
  prisma: any
): Promise<string[]> {
  const suggested = getSuggestedEventSignals(categorySlug, genreSlugs);

  const allSlugs = [
    ...suggested.activitySignalSlugs,
    ...suggested.formatSignalSlugs,
    ...suggested.intentionSignalSlugs,
    ...suggested.interestSignalSlugs,
  ];

  return resolveSignalSlugsToIds(allSlugs, prisma);
}

/**
 * Валидация Event signals
 */
export async function validateEventSignals(
  signalIds: string[],
  prisma: any
): Promise<{ valid: boolean; error?: string }> {
  if (signalIds.length === 0) {
    return { valid: true };
  }

  const signals = await prisma.signalDefinition.findMany({
    where: {
      id: { in: signalIds },
    },
    select: {
      id: true,
      slug: true,
      status: true,
      domain: true,
      entityTypes: true,
    },
  });

  // Проверяем, что все signals найдены
  if (signals.length !== signalIds.length) {
    return {
      valid: false,
      error: "Некоторые signals не найдены",
    };
  }

  // Проверяем статус
  const inactiveSignals = signals.filter((s: any) => s.status !== "ACTIVE");
  if (inactiveSignals.length > 0) {
    return {
      valid: false,
      error: `Signals не активны: ${inactiveSignals.map((s: any) => s.slug).join(", ")}`,
    };
  }

  // Проверяем domain и entityTypes
  for (const signal of signals) {
    if (signal.domain === "DISCOVERY") {
      // Discovery signals должны поддерживать EVENT
      if (!signal.entityTypes.includes("EVENT")) {
        return {
          valid: false,
          error: `Signal ${signal.slug} не поддерживает EVENT`,
        };
      }
    } else if (signal.domain === "PROFILE") {
      // Profile signals должны поддерживать USER
      if (!signal.entityTypes.includes("USER")) {
        return {
          valid: false,
          error: `Signal ${signal.slug} не поддерживает USER`,
        };
      }
    } else if (signal.domain === "RECOMMENDATION") {
      // Recommendation signals не должны сохраняться вручную
      return {
        valid: false,
        error: `Signal ${signal.slug} является recommendation signal и не может быть сохранен вручную`,
      };
    }
  }

  return { valid: true };
}
