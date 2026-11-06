/** Заголовок блока оценки под материалом: у подборки свой вопрос, у остальных статей прежний. */
export function articleRatingTitle(publicationType?: "ARTICLE" | "COLLECTION" | "BREAKING_NEWS" | null): string {
  return publicationType === "COLLECTION" ? "Как вам подборка?" : "Была полезна статья?";
}
