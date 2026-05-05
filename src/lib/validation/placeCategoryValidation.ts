/**
 * Place Category Validation
 * 
 * Валидация категорий и подкатегорий для Place.
 * 
 * Правила:
 * 1. Основная категория (primaryCategoryId):
 *    - обязательная
 *    - должна существовать
 *    - должна иметь entityType = PLACE
 *    - должна быть корневой (parentId = null)
 * 
 * 2. Подкатегории (subcategoryIds):
 *    - обязательные
 *    - минимум 1, максимум 3
 *    - все должны существовать
 *    - все должны иметь entityType = PLACE
 *    - все должны быть детьми выбранной primaryCategoryId
 */

import { prisma } from "@/lib/prisma";

export interface PlaceCategoryValidationInput {
  primaryCategoryId: string | null | undefined;
  subcategoryIds?: string[];
}

export interface PlaceCategoryValidationResult {
  valid: boolean;
  error?: string;
  details?: {
    primaryCategory?: string;
    subcategories?: string;
  };
}

export async function validatePlaceCategories(
  input: PlaceCategoryValidationInput
): Promise<PlaceCategoryValidationResult> {
  const { primaryCategoryId, subcategoryIds = [] } = input;

  // 1. Проверка основной категории
  if (!primaryCategoryId) {
    return {
      valid: false,
      error: "Основная категория обязательна",
      details: { primaryCategory: "Выберите основную категорию" },
    };
  }

  const primaryCategory = await prisma.eventCategory.findUnique({
    where: { id: primaryCategoryId },
    select: {
      id: true,
      publicationType: true,
      parentId: true,
      nameRu: true,
    },
  });

  if (!primaryCategory) {
    return {
      valid: false,
      error: "Основная категория не найдена",
      details: { primaryCategory: "Выбранная категория не существует" },
    };
  }

  if (primaryCategory.publicationType !== "PLACE") {
    return {
      valid: false,
      error: "Неверный тип категории",
      details: { primaryCategory: "Выбранная категория не является категорией места" },
    };
  }

  if (primaryCategory.parentId !== null) {
    return {
      valid: false,
      error: "Неверная категория",
      details: { primaryCategory: "Основная категория должна быть корневой" },
    };
  }

  // 2. Проверка подкатегорий
  if (!subcategoryIds || subcategoryIds.length === 0) {
    return {
      valid: false,
      error: "Подкатегории обязательны",
      details: { subcategories: "Выберите хотя бы одну подкатегорию" },
    };
  }

  if (subcategoryIds.length > 3) {
    return {
      valid: false,
      error: "Слишком много подкатегорий",
      details: { subcategories: "Максимум 3 подкатегории" },
    };
  }

  // Проверяем все подкатегории
  const subcategories = await prisma.eventCategory.findMany({
    where: {
      id: { in: subcategoryIds },
    },
    select: {
      id: true,
      publicationType: true,
      parentId: true,
      nameRu: true,
    },
  });

  if (subcategories.length !== subcategoryIds.length) {
    return {
      valid: false,
      error: "Некоторые подкатегории не найдены",
      details: { subcategories: "Одна или несколько подкатегорий не существуют" },
    };
  }

  // Проверяем тип всех подкатегорий
  const wrongType = subcategories.find((sub) => sub.publicationType !== "PLACE");
  if (wrongType) {
    return {
      valid: false,
      error: "Неверный тип подкатегории",
      details: { subcategories: `"${wrongType.nameRu}" не является подкатегорией места` },
    };
  }

  // Проверяем, что все подкатегории являются детьми основной категории
  const wrongParent = subcategories.find((sub) => sub.parentId !== primaryCategoryId);
  if (wrongParent) {
    return {
      valid: false,
      error: "Неверная подкатегория",
      details: {
        subcategories: `"${wrongParent.nameRu}" не относится к категории "${primaryCategory.nameRu}"`,
      },
    };
  }

  return { valid: true };
}

/**
 * Валидация для черновиков (DRAFT) - более мягкая
 */
export async function validatePlaceCategoriesDraft(
  input: PlaceCategoryValidationInput
): Promise<PlaceCategoryValidationResult> {
  const { primaryCategoryId, subcategoryIds = [] } = input;

  // Для черновика категории необязательны
  if (!primaryCategoryId) {
    return { valid: true };
  }

  // Если категория указана, проверяем её корректность
  const primaryCategory = await prisma.eventCategory.findUnique({
    where: { id: primaryCategoryId },
    select: {
      id: true,
      publicationType: true,
      parentId: true,
      nameRu: true,
    },
  });

  if (!primaryCategory) {
    return {
      valid: false,
      error: "Основная категория не найдена",
      details: { primaryCategory: "Выбранная категория не существует" },
    };
  }

  if (primaryCategory.publicationType !== "PLACE") {
    return {
      valid: false,
      error: "Неверный тип категории",
      details: { primaryCategory: "Выбранная категория не является категорией места" },
    };
  }

  if (primaryCategory.parentId !== null) {
    return {
      valid: false,
      error: "Неверная категория",
      details: { primaryCategory: "Основная категория должна быть корневой" },
    };
  }

  // Если подкатегории указаны, проверяем их
  if (subcategoryIds.length > 0) {
    if (subcategoryIds.length > 3) {
      return {
        valid: false,
        error: "Слишком много подкатегорий",
        details: { subcategories: "Максимум 3 подкатегории" },
      };
    }

    const subcategories = await prisma.eventCategory.findMany({
      where: {
        id: { in: subcategoryIds },
      },
      select: {
        id: true,
        publicationType: true,
        parentId: true,
        nameRu: true,
      },
    });

    if (subcategories.length !== subcategoryIds.length) {
      return {
        valid: false,
        error: "Некоторые подкатегории не найдены",
        details: { subcategories: "Одна или несколько подкатегорий не существуют" },
      };
    }

    const wrongType = subcategories.find((sub) => sub.publicationType !== "PLACE");
    if (wrongType) {
      return {
        valid: false,
        error: "Неверный тип подкатегории",
        details: { subcategories: `"${wrongType.nameRu}" не является подкатегорией места` },
      };
    }

    const wrongParent = subcategories.find((sub) => sub.parentId !== primaryCategoryId);
    if (wrongParent) {
      return {
        valid: false,
        error: "Неверная подкатегория",
        details: {
          subcategories: `"${wrongParent.nameRu}" не относится к категории "${primaryCategory.nameRu}"`,
        },
      };
    }
  }

  return { valid: true };
}
