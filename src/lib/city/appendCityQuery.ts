/**
 * Ensures `city` query param is set on relative paths for continuity into section pages.
 */
export function appendCityQuery(pathOrUrl: string, citySlug: string): string {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }
  const [path, qs] = pathOrUrl.split("?");
  const params = new URLSearchParams(qs || "");
  params.set("city", citySlug);
  const q = params.toString();
  return q ? `${path}?${q}` : path;
}
