import type { ResolvedTerritory } from "@/server/territory/resolveTerritory";
import prisma from "@/lib/prisma";

/**
 * Exact geographic scope for an explicitly selected Territory.
 * Unlike a home city hub, a CITY never expands to the surrounding oblast.
 * REGION includes its descendant cities; COUNTRY includes all of its cities.
 *
 * During Territory migration Activity still references legacy City IDs.
 * Resolve them via TerritoryLegacyMap until the read-switch is complete.
 */
export async function resolveTerritoryCityIds(
  territory: Pick<ResolvedTerritory, "id" | "type">,
): Promise<string[]> {
  const descendantIds: string[] = [territory.id];
  if (territory.type === "REGION" || territory.type === "COUNTRY") {
    const children = await prisma.territory.findMany({
      where: {
        isActive: true,
        isLegacyNonCity: false,
        ...(territory.type === "REGION"
          ? { type: "CITY" as const, parentId: territory.id }
          : {
              type: "CITY" as const,
              OR: [
                { parentId: territory.id },
                { parent: { parentId: territory.id } },
              ],
            }),
      },
      select: { id: true },
    });
    descendantIds.push(...children.map((city) => city.id));
  }

  const legacy = await prisma.territoryLegacyMap.findMany({
    where: { legacyKind: "CITY", territoryId: { in: descendantIds } },
    select: { legacyId: true },
  });
  return Array.from(new Set(legacy.map((row) => row.legacyId)));
}
