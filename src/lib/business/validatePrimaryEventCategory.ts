/**
 * Правило продукта: ровно одна основная категория (корень в scheduleJson + лист в eventCategoryId).
 * Не допускаем несколько корней в scheduleJson.categoryIds.
 */
export function assertBusinessEventPrimaryCategory(input: {
  eventCategoryId: string | null | undefined;
  scheduleJson: Record<string, unknown> | null | undefined;
}): void {
  const sj = input.scheduleJson ?? {};
  if (Array.isArray(sj.categoryIds)) {
    if (sj.categoryIds.length > 1) {
      throw new Error("Разрешена только одна основная категория");
    }
  }
  const root = typeof sj.categoryId === "string" ? sj.categoryId.trim() : "";
  const leaf =
    typeof input.eventCategoryId === "string" ? input.eventCategoryId.trim() : "";
  if (!root || !leaf) {
    throw new Error("Укажите основную категорию события");
  }
}
