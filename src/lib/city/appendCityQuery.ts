/**
 * Добавляет `?city=` только если город не задан первым сегментом пути (`/{city}/events` — без дубля в query).
 */
export function appendCityQuery(pathOrUrl: string, citySlug: string): string {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }
  const [path, qs] = pathOrUrl.split("?");
  const params = new URLSearchParams(qs || "");
  const segments = path.split("/").filter(Boolean);
  const pathStartsWithCity = segments[0] === citySlug;

  if (pathStartsWithCity) {
    params.delete("city");
    const q = params.toString();
    return q ? `${path}?${q}` : path;
  }

  params.set("city", citySlug);
  const q = params.toString();
  return q ? `${path}?${q}` : path;
}
