import { cookies } from "next/headers";
import { normalizeTerritorySlug, TERRITORY_COOKIE_NAME } from "@/lib/territory/territoryCookie";

/** Selected territory slug from the `mg_territory` cookie (server components / route handlers). */
export async function readTerritorySlugFromRequest(): Promise<string | null> {
  const store = await cookies();
  return normalizeTerritorySlug(store.get(TERRITORY_COOKIE_NAME)?.value);
}
