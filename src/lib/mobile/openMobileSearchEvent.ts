/** Событие для открытия `MobileSearchSheet` из любого клиентского компонента (напр. главная города). */
export const OPEN_MOBILE_SEARCH_EVENT = "mamago:openMobileSearch";

export function dispatchOpenMobileSearch(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_MOBILE_SEARCH_EVENT));
}
