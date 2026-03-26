import type { SeoEntityProvider, SeoEntityType } from "./types";
import { eventProvider } from "./providers/event";
import { placeProvider } from "./providers/place";
import { offerProvider } from "./providers/offer";
import { routeProvider } from "./providers/route";
import { articleProvider } from "./providers/article";

export const seoEntityProviders = [
  eventProvider,
  placeProvider,
  offerProvider,
  routeProvider,
  articleProvider,
] as const satisfies ReadonlyArray<SeoEntityProvider>;

export function getSeoEntityProvider(type: SeoEntityType): SeoEntityProvider {
  const p = seoEntityProviders.find((x) => x.entityType === type);
  if (!p) {
    // Exhaustive guard for runtime
    throw new Error(`Unknown seo entity provider: ${type}`);
  }
  return p;
}

