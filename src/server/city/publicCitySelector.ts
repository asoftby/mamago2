import { listAdminCityRows } from "@/server/city/cityAdminData";

export type PublicCitySelectorOption = {
  id: string;
  slug: string;
  name: string;
};

export async function listPublicCitySelectorOptions(): Promise<PublicCitySelectorOption[]> {
  const rows = await listAdminCityRows();

  return rows
    .filter(
      (city) =>
        city.isActive &&
        city.isVisibleInCityFilter &&
        (city.eventsCount > 0 || city.placesCount > 0),
    )
    .map((city) => ({
      id: city.id,
      slug: city.slug,
      name: city.name,
      priority: city.priority,
    }))
    .sort((a, b) => {
    if (a.slug === "minsk") return -1;
    if (b.slug === "minsk") return 1;
    if (a.priority !== b.priority) return b.priority - a.priority;
    return a.name.localeCompare(b.name, "ru");
    })
    .map(({ id, slug, name }) => ({ id, slug, name }));
}
