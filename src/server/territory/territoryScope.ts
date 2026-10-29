import type { Prisma, TerritoryType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { resolveTerritoryBySlug } from "@/server/territory/resolveTerritory";

/**
 * The set of territories whose content belongs to a public listing: the territory itself plus all its
 * descendants (`/minsk` = region Minsk -> Minsk, Marina Gorka, Kopishche, ...; `/kopishche` = that city only).
 */
export type TerritoryScope = {
  territoryId: string;
  type: TerritoryType;
  slug: string;
  territoryIds: string[];
  /** The city territory the page is "about": itself, or the centre city (same slug) of a region. */
  cityTerritoryId: string | null;
  /** The REGION above (or equal to) the territory, with all its descendants. */
  regionTerritoryId: string | null;
  regionScopeIds: string[];
};

type ScopeDb = Pick<typeof prisma, "territory">;

type ScopeRow = { id: string; parentId: string | null; type: TerritoryType; slug: string };

export function collectDescendantIds(
  rows: ReadonlyArray<{ id: string; parentId: string | null }>,
  rootId: string,
): string[] {
  const children = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.parentId) continue;
    const list = children.get(row.parentId) ?? [];
    list.push(row.id);
    children.set(row.parentId, list);
  }
  const out = [rootId];
  const seen = new Set(out);
  for (let i = 0; i < out.length; i += 1) {
    for (const child of children.get(out[i]!) ?? []) {
      if (!seen.has(child)) {
        seen.add(child);
        out.push(child);
      }
    }
  }
  return out;
}

const SCOPE_TTL_MS = 5 * 60 * 1000;
const scopeCache = new Map<string, { at: number; value: TerritoryScope | null }>();

export function invalidateTerritoryScopeCache(): void {
  scopeCache.clear();
}

/** Active territory by public slug (COUNTRY > REGION > CITY) with its descendants; null when unknown. */
export async function resolveTerritoryScope(
  slug: string,
  opts?: { db?: ScopeDb; now?: number },
): Promise<TerritoryScope | null> {
  const db = opts?.db;
  const now = opts?.now ?? Date.now();
  const key = slug.trim().toLowerCase();
  if (!db) {
    const hit = scopeCache.get(key);
    if (hit && now - hit.at < SCOPE_TTL_MS) return hit.value;
  }
  const territory = await resolveTerritoryBySlug(key, db ? { db } : undefined);
  let value: TerritoryScope | null = null;
  if (territory) {
    const all: ScopeRow[] = await (db ?? prisma).territory.findMany({
      where: { isActive: true, isLegacyNonCity: false },
      select: { id: true, parentId: true, type: true, slug: true },
    });
    const byId = new Map(all.map((row) => [row.id, row]));
    let region: ScopeRow | null = null;
    for (let cursor: ScopeRow | undefined = byId.get(territory.id); cursor; cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined) {
      if (cursor.type === "REGION") {
        region = cursor;
        break;
      }
    }
    const cityTerritoryId =
      territory.type === "CITY"
        ? territory.id
        : territory.type === "REGION"
          ? (all.find((row) => row.parentId === territory.id && row.type === "CITY" && row.slug === territory.slug)?.id ?? null)
          : null;
    value = {
      territoryId: territory.id,
      type: territory.type,
      slug: territory.slug,
      territoryIds: collectDescendantIds(all, territory.id),
      cityTerritoryId,
      regionTerritoryId: region?.id ?? null,
      regionScopeIds: region ? collectDescendantIds(all, region.id) : [],
    };
  }
  if (!db) scopeCache.set(key, { at: now, value });
  return value;
}

/** Event belongs to the scope through its own territory, its place or its venue (kuda feed shape). */
export function activityInTerritoryScopeWhere(territoryIds: readonly string[]): Prisma.ActivityWhereInput {
  const ids = { in: [...territoryIds] };
  return { OR: [{ territoryId: ids }, { place: { territoryId: ids } }, { venue: { territoryId: ids } }] };
}

/** Offer is located in the scope through its place (classes / birthday feed shape). */
export function placeInTerritoryScopeWhere(territoryIds: readonly string[]): Prisma.PlaceWhereInput {
  return { territoryId: { in: [...territoryIds] } };
}

/** Explicit selection follows the displayed location: venue, then place, then activity. */
export function activityInExactTerritoryScopeWhere(territoryIds: readonly string[]): Prisma.ActivityWhereInput {
  const ids = { in: [...territoryIds] };
  return {
    OR: [
      { venue: { territoryId: ids } },
      { AND: [
        { OR: [{ venue: null }, { venue: { territoryId: null } }] },
        { place: { territoryId: ids } },
      ] },
      { AND: [
        { OR: [{ venue: null }, { venue: { territoryId: null } }] },
        { OR: [{ placeId: null }, { place: { territoryId: null } }] },
        { territoryId: ids },
      ] },
    ],
  };
}
