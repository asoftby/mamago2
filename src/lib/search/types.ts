export type SearchResultType =
  | "activity"
  | "offer"
  | "place"
  | "route"
  | "article";

export type SearchResultItem = {
  id: string;
  type: SearchResultType;
  title: string;
  url: string;
  imageUrl: string | null;
  /** Короткое описание для второй строки карточки; иначе клиент показывает тип. */
  summaryLine: string | null;
  metaLine: string;
};
