import type { Prisma, TerritoryType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { isReservedTopLevelSegment } from "@/lib/city/resolveCityContext";
import { normalizeTerritorySlug } from "@/lib/territory/territoryCookie";
import { DEFAULT_COUNTRY_ISO } from "@/server/geo/geoConstants";

export type ResolvedTerritory = {
  id: string;
  type: TerritoryType;
  slug: string;
  name: string;
  nameIn: string | null;
  parentId: string | null;
  isActive: boolean;
  isIndexable: boolean;
};

/** A slug may exist at several levels (region `minsk` contains city `minsk`): the widest wins. */
const TYPE_PRECEDENCE: readonly TerritoryType[] = ["COUNTRY", "REGION", "CITY"];

export function pickTerritoryByPrecedence<T extends { type: TerritoryType }>(rows: readonly T[]): T | null {
  for (const type of TYPE_PRECEDENCE) {
    const row = rows.find((candidate) => candidate.type === type);
    if (row) return row;
  }
  return null;
}

const SELECT = {
  id: true,
  type: true,
  slug: true,
  name: true,
  nameIn: true,
  parentId: true,
  isActive: true,
  isIndexable: true,
} satisfies Prisma.TerritorySelect;

/** Scope to the default country: country itself, its regions, and cities directly or via a region. */
function defaultCountryScope(): Prisma.TerritoryWhereInput {
  const inCountry = { isoCode: DEFAULT_COUNTRY_ISO };
  return {
    OR: [
      { type: "COUNTRY", ...inCountry },
      { type: "REGION", parent: inCountry },
      { type: "CITY", isLegacyNonCity: false, OR: [{ parent: inCountry }, { parent: { parent: inCountry } }] },
    ],
  };
}

export async function resolveTerritoryBySlug(
  rawSlug: string | null | undefined,
  opts?: { includeInactive?: boolean; db?: Pick<typeof prisma, "territory"> },
): Promise<ResolvedTerritory | null> {
  const slug = normalizeTerritorySlug(rawSlug);
  if (!slug) return null;
  const rows = await (opts?.db ?? prisma).territory.findMany({
    where: { slug, ...(opts?.includeInactive ? {} : { isActive: true }), AND: [defaultCountryScope()] },
    select: SELECT,
  });
  return pickTerritoryByPrecedence(rows);
}

/** `/belarus/...` -> COUNTRY, `/minsk/...` -> REGION, `/kopishche/...` -> CITY; reserved segments never resolve. */
export async function resolveTerritoryFromPathname(
  pathname: string | null | undefined,
  opts?: Parameters<typeof resolveTerritoryBySlug>[1],
): Promise<ResolvedTerritory | null> {
  const first = pathname?.split("/").filter(Boolean)[0];
  if (!first || isReservedTopLevelSegment(first)) return null;
  return resolveTerritoryBySlug(first, opts);
}
