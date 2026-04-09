/** Initial ranking boosts for global search (SearchDocument.boost). */
export const SEARCH_BOOST = {
  activity: 1.25,
  offer: 1.15,
  place: 1.1,
  route: 1.0,
  article: 0.85,
} as const;
