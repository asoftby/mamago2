import { prisma } from "@/lib/prisma";
import { ensureFamilyForUser } from "@/server/family/ensureFamily";
import type { TravelMode } from "@/features/my-plan/lib/dayScenario/types";

/**
 * The family's preferred way of getting around for the day scenario (BACKLOG-230, PR 3b-3): stored on the family
 * (Family.travelMode, 'walk' | 'car'), read as the default when a draft does not ask for a mode, written when the
 * user switches «Пешком / На машине». Default: car.
 */

export const TRAVEL_MODES = ["walk", "car"] as const;
export type StoredTravelMode = (typeof TRAVEL_MODES)[number];

export function isStoredTravelMode(value: unknown): value is StoredTravelMode {
  return value === "walk" || value === "car";
}

/** What the draft uses: the mode the request names, else the family's choice, else the car. */
export function resolveTravelMode(requested: TravelMode | undefined, preferred: string | null | undefined): TravelMode {
  if (requested) return requested;
  return isStoredTravelMode(preferred) ? preferred : "car";
}

type ReadDb = Pick<typeof prisma, "familyMembership">;

/** One indexed read: the active family's stored mode, null when the user has no family or never chose. */
export async function getFamilyTravelMode(userId: string, db: ReadDb = prisma): Promise<string | null> {
  const membership = await db.familyMembership.findFirst({ where: { userId, leftAt: null }, select: { family: { select: { travelMode: true } } } });
  return membership?.family.travelMode ?? null;
}

export async function setFamilyTravelMode(userId: string, mode: StoredTravelMode, db: Pick<typeof prisma, "family"> = prisma): Promise<void> {
  const familyId = await ensureFamilyForUser(prisma, userId);
  await db.family.update({ where: { id: familyId }, data: { travelMode: mode } });
}
