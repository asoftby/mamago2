import type { PrismaClient } from "@prisma/client";

import type { NormalizedPlaceCandidate } from "../commit/place/types";

/**
 * The narrowest slice this linker needs — one method, exact match only.
 * Deliberately not the old `src/server/modules/import/publish/city-lookup.ts`
 * imported directly: that file exists, and its exact-match/no-fuzzy-match
 * behavior is exactly what this linker relies on, but importing it would
 * couple Phoenix to the old import module's internals. Constructor DI
 * instead, so tests inject a fake and the real wiring (a later PR/call
 * site) can point at whatever concrete lookup it wants — including that
 * same file's logic — without this class knowing.
 */
export interface PlaceCityLookupLike {
  findCityIdByName(name: string): Promise<string | null>;
}

/** `place.update` only — no `create`, no `findUnique`, nothing else. */
export interface PlaceScalarLinkerPrismaClient {
  place: Pick<PrismaClient["place"], "update">;
}

export interface LinkPlaceScalarsInput {
  placeId: string;
  candidate: NormalizedPlaceCandidate;
  context?: {
    /** If provided, wins over any `cityRaw` lookup — no lookup call is made at all. */
    cityId?: string | null;
  };
}

export interface LinkPlaceScalarsResult {
  updated: boolean;
  updatedFields: string[];
}
