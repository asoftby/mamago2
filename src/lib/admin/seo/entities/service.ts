import type { SeoEntityProvider, SeoEntityType, SeoEntityUpdateInput } from "./types";
import { getSeoEntityProvider, seoEntityProviders } from "./registry";

export async function listAllEntityRows() {
  const rowsNested = await Promise.all(seoEntityProviders.map((p) => p.listRows()));
  return rowsNested.flat();
}

export async function loadEntityEditorModel(type: SeoEntityType, id: string) {
  return getSeoEntityProvider(type).loadEditorModel(id);
}

export async function updateEntitySeo(type: SeoEntityType, id: string, input: SeoEntityUpdateInput) {
  return getSeoEntityProvider(type).updateSeo(id, input);
}

export async function toggleEntityIndexation(type: SeoEntityType, id: string) {
  return getSeoEntityProvider(type).toggleIndexation(id);
}

export async function loadEntityRedirects(type: SeoEntityType, id: string) {
  return getSeoEntityProvider(type).loadRedirects(id);
}

export async function buildEntitySchema(type: SeoEntityType, id: string) {
  return getSeoEntityProvider(type).buildSchema(id);
}

export function providerForApiRoute(route: "activity" | "place" | "offer" | "route" | "article"): SeoEntityProvider {
  if (route === "activity") return getSeoEntityProvider("event");
  if (route === "place") return getSeoEntityProvider("place");
  if (route === "offer") return getSeoEntityProvider("offer");
  if (route === "route") return getSeoEntityProvider("route");
  return getSeoEntityProvider("article");
}

