const CITY_LABELS: Record<string, string> = {
  minsk: "Минск",
  brest: "Брест",
  gomel: "Гомель",
  grodno: "Гродно",
  mogilev: "Могилёв",
  vitebsk: "Витебск",
};

export function getCityDisplayName(slug: string): string {
  return CITY_LABELS[slug] ?? slug;
}
