import type {
  SeoEntityListingRow,
  SeoEntityProvider,
  SeoEntityType,
  SeoEntityUpdateInput,
} from "./types";
import { getSeoEntityProvider, seoEntityProviders } from "./registry";
import type { SeoEntityListFilters } from "./listFilters";
import { planProviderPageWindows } from "./listFilters";
import type { SeoPageType } from "@/lib/admin/seo/domain/types";

export async function listAllEntityRows() {
  const rowsNested = await Promise.all(seoEntityProviders.map((p) => p.listRows()));
  return rowsNested.flat();
}

function resolveProviders(type: SeoPageType | "all"): SeoEntityProvider[] {
  if (
    type === "event" ||
    type === "place" ||
    type === "offer" ||
    type === "route" ||
    type === "article"
  ) {
    return [getSeoEntityProvider(type)];
  }
  return [...seoEntityProviders];
}

export async function countEntityRows(input: {
  filters: SeoEntityListFilters;
  type: SeoPageType | "all";
}): Promise<{
  total: number;
  counts: number[];
  providers: SeoEntityProvider[];
}> {
  const providers = resolveProviders(input.type);
  const counts = await Promise.all(
    providers.map((p) => p.countRows(input.filters)),
  );
  const total = counts.reduce((sum, n) => sum + n, 0);
  return { total, counts, providers };
}

/**
 * Bounded cross-provider listing preserving registry concat order:
 * event → place → offer → route → article (each updatedAt desc).
 *
 * Pass precomputed `counts`/`providers` from countEntityRows to avoid a
 * second round of COUNT queries when clamping pagination.
 */
export async function listEntityRowsPage(input: {
  filters: SeoEntityListFilters;
  type: SeoPageType | "all";
  skip: number;
  take: number;
  counts?: number[];
  providers?: SeoEntityProvider[];
}): Promise<{ rows: SeoEntityListingRow[]; total: number }> {
  const counted =
    input.counts && input.providers
      ? {
          total: input.counts.reduce((sum, n) => sum + n, 0),
          counts: input.counts,
          providers: input.providers,
        }
      : await countEntityRows({
          filters: input.filters,
          type: input.type,
        });

  if (input.take <= 0) {
    return { rows: [], total: counted.total };
  }

  const windows = planProviderPageWindows(
    counted.counts,
    input.skip,
    input.take,
  );

  const chunks = await Promise.all(
    windows.map((w) =>
      counted.providers[w.providerIndex]!.listRowsPage(input.filters, {
        skip: w.skip,
        take: w.take,
      }),
    ),
  );

  return { rows: chunks.flat(), total: counted.total };
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
