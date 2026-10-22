import { isLegacyEditorialRouteSlug } from "@/lib/routes/legacyEditorialRouteCutover";

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
    return null;
  }
  if (!target || !target.startsWith("/minsk/blog/") || target.includes("?") || target.includes("#")) {
    return null;
  }
  const location = new URL(target, request.origin);
  location.search = request.search;
  return location.toString();
}
