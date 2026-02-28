const STORAGE_KEY = "mamago_favorites";

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

export function toggleFavorite(id: string): string[] {
  if (typeof window === "undefined") return [];
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
  return newFavorites;
}
