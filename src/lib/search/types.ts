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
  metaLine: string;
};
