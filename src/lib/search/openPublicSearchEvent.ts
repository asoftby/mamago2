export const OPEN_PUBLIC_SEARCH_EVENT = "mamago:openPublicSearch";

/**
 * Единая точка входа для открытия публичного поиска.
 * Desktop-хедер открывает SearchOverlay, mobile-хедер — MobileSearchSheet.
 */
export function dispatchOpenPublicSearch(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_PUBLIC_SEARCH_EVENT));
}
