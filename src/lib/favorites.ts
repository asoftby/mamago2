const STORAGE_KEY = "mamago:favorites";

export function getFavorites(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error("Failed to parse favorites", e);
    return [];
  }
}

export function isFavorite(id: string): boolean {
  const favorites = getFavorites();
  return favorites.includes(id);
}

export function toggleFavorite(id: string): string[] {
  const favorites = getFavorites();
  const index = favorites.indexOf(id);
  
  let newFavorites;
  if (index === -1) {
    newFavorites = [...favorites, id];
  } else {
    newFavorites = favorites.filter(favId => favId !== id);
  }
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newFavorites));
  } catch (e) {
    console.error("Failed to save favorites", e);
  }
  
  // Dispatch a custom event so components can subscribe to changes if needed
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("favorites-updated"));
  }
  
  return newFavorites;
}
