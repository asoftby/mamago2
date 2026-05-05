/**
 * Event Category and Genre Validation
 * 
 * Валидация категорий и жанров для Event.
 * 
 * Правила:
 * 1. Категория (eventCategoryId):
 *    - обязательная
 *    - должна существовать
 *    - должна иметь publicationType = EVENT
 *    - должна быть корневой (parentId = null)
 * 
 * 2. Жанры (genreSlugs):
 *    - необязательные
 *    - максимум 3
 *    - все должны существовать
 *    - все должны принадлежать выбранной категории
 */

import { prisma } from "@/lib/prisma";

export interface EventCategoryValidationInput {
  eventCategoryId: string | null | undefined;
  genreSlugs?: string[];
}

export interface EventCategoryValidationResult {
  valid: boolean;
  error?: string;
  details?: {
    category?: string;
    genres?: string;
  };
}

export async function validateEventCategory(
  input: EventCategoryValidationInput
): Promise<EventCategoryValidationResult> {
  const { eventCategoryId, genreSlugs = [] } = input;

  // 1. Проверка категории
  if (!eventCategoryId) {
    return {
      valid: false,
      error: "Категория события обязательна",
      details: { category: "Выберите категорию события" },
    };
  }

  const category = await prisma.eventCategory.findUnique({
    where: { id: eventCategoryId },
    select: {
      id: true,
      publicationType: true,
      parentId: true,
      nameRu: true,
    },
  });

  if (!category) {
    return {
      valid: false,
      error: "Категория не найдена",
      details: { category: "Выбранная категория не существует" },
    };
  }

  if (category.publicationType !== "EVENT") {
    return {
      valid: false,
      error: "Неверный тип категории",
      details: { category: "Выбранная категория не является категорией события" },
    };
  }

  if (category.parentId !== null) {
    return {
      valid: false,
      error: "Неверная категория",
      details: { category: "Категория события должна быть корневой" },
    };
  }

  // 2. Проверка жанров (необязательны)
  if (genreSlugs.length > 0) {
    if (genreSlugs.length > 3) {
      return {
        valid: false,
        error: "Слишком много жанров",
        details: { genres: "Максимум 3 жанра" },
      };
    }

    // Проверяем все жанры
    const genres = await prisma.genre.findMany({
      where: {
        categoryId: eventCategoryId,
        slug: { in: genreSlugs },
      },
      select: {
        id: true,
        slug: true,
        name: true,
        categoryId: true,
      },
    });

    if (genres.length !== genreSlugs.length) {
      return {
        valid: false,
        error: "Некоторые жанры не найдены",
        details: { genres: "Один или несколько жанров не существуют" },
      };
    }

    // Проверяем, что все жанры принадлежат выбранной категории
    const wrongCategory = genres.find((genre) => genre.categoryId !== eventCategoryId);
    if (wrongCategory) {
      return {
        valid: false,
        error: "Неверный жанр",
        details: {
          genres: `"${wrongCategory.name}" не относится к категории "${category.nameRu}"`,
        },
      };
    }
  }

  return { valid: true };
}

/**
 * Валидация для черновиков (DRAFT) - более мягкая
 */
export async function validateEventCategoryDraft(
  input: EventCategoryValidationInput
): Promise<EventCategoryValidationResult> {
  const { eventCategoryId, genreSlugs = [] } = input;

  // Для черновика категория необязательна
  if (!eventCategoryId) {
    return { valid: true };
  }

  // Если категория указана, проверяем её корректность
  const category = await prisma.eventCategory.findUnique({
    where: { id: eventCategoryId },
    select: {
      id: true,
      publicationType: true,
      parentId: true,
      nameRu: true,
    },
  });

  if (!category) {
    return {
      valid: false,
      error: "Категория не найдена",
      details: { category: "Выбранная категория не существует" },
    };
  }

  if (category.publicationType !== "EVENT") {
    return {
      valid: false,
      error: "Неверный тип категории",
      details: { category: "Выбранная категория не является категорией события" },
    };
  }

  if (category.parentId !== null) {
    return {
      valid: false,
      error: "Неверная категория",
      details: { category: "Категория события должна быть корневой" },
    };
  }

  // Если жанры указаны, проверяем их
  if (genreSlugs.length > 0) {
    if (genreSlugs.length > 3) {
      return {
        valid: false,
        error: "Слишком много жанров",
        details: { genres: "Максимум 3 жанра" },
      };
    }

    const genres = await prisma.genre.findMany({
      where: {
        categoryId: eventCategoryId,
        slug: { in: genreSlugs },
      },
      select: {
        id: true,
        slug: true,
        name: true,
        categoryId: true,
      },
    });

    if (genres.length !== genreSlugs.length) {
      return {
        valid: false,
        error: "Некоторые жанры не найдены",
        details: { genres: "Один или несколько жанров не существуют" },
      };
    }

    const wrongCategory = genres.find((genre) => genre.categoryId !== eventCategoryId);
    if (wrongCategory) {
      return {
        valid: false,
        error: "Неверный жанр",
        details: {
          genres: `"${wrongCategory.name}" не относится к категории "${category.nameRu}"`,
        },
      };
    }
  }

  return { valid: true };
}
