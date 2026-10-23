import { getLegacyEditorialRouteArticlePath, isLegacyEditorialRouteSlug } from "@/lib/routes/legacyEditorialRouteCutover";

/** Evaluate only the 13 approved legacy editorial routes before HTML streaming. */
export async function resolvePrestreamEditorialRouteLocation(
  request: { pathname: string; search: string; origin: string; method: string },
  readyArticlePath: (slug: string) => Promise<string | null>,
): Promise<string | null> {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const match = /^\/routes\/([^/]+)\/?$/.exec(request.pathname);
  if (!match) return null;
  const slug = match[1];
  if (!isLegacyEditorialRouteSlug(slug)) return null;

  // A redirect requires current, verified DB readiness; on error fail closed.
  let target: string | null;
  try {
    target = await readyArticlePath(slug);
  } catch {
    // Do not log the exception: database errors can contain connection details.
    console.error("[editorial-route-redirect] Readiness lookup failed; redirect skipped");
    return null;
  }
  if (!target || target !== getLegacyEditorialRouteArticlePath(slug)) {
    return null;
  }
  const location = new URL(target, request.origin);
  location.search = request.search;
  return location.toString();
}
