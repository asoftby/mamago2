export function assertArticleCategorySelectionShape(
  primaryCategoryId: string | null,
  additionalCategoryIds: string[],
): void {
  if (new Set(additionalCategoryIds).size !== additionalCategoryIds.length) {
    throw new Error("Дополнительные категории не должны повторяться");
  }
  if (primaryCategoryId && additionalCategoryIds.includes(primaryCategoryId)) {
    throw new Error("Основная категория не может быть дополнительной");
  }
}

