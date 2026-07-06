import type { LinkPlaceScalarsInput, LinkPlaceScalarsResult, PlaceCityLookupLike, PlaceScalarLinkerPrismaClient } from "./types";

function assertPlaceIdIsUsable(placeId: string): void {
  if (!placeId?.trim()) {
    throw new Error("LinkPlaceScalarsInput.placeId is required.");
  }
}

/**
 * Writes only the handful of `Place` scalar fields that can be carried
 * over from a `NormalizedPlaceCandidate` without any parsing or guessing:
 * `lat`/`lng` (already-structured coordinates), `phone` (the raw string,
 * verbatim — never split into phone2/phone3), `customAddress` (raw
 * `locationRaw` text — never `formattedAddr`, which implies geocoded
 * data this doesn't have), and `cityId` (only via an exact-match lookup,
 * never a guess).
 *
 * Everything else on the candidate is deliberately never read:
 * `workHoursRaw` (would require parsing free text into `OpeningHours`
 * relational rows — a later, separate concern), `email` (`Place` has no
 * such column), `sourceTerms`/`media`/`rawMeta` (owned by other linkers or
 * not applicable here).
 *
 * If nothing safe to write was found, `prisma.place.update()` is never
 * called at all — an empty patch is a no-op, not a wasted round-trip.
 */
export class PlaceScalarLinker {
  constructor(
    private readonly deps: {
      prisma: PlaceScalarLinkerPrismaClient;
      cityLookup?: PlaceCityLookupLike;
    },
  ) {}

  async linkScalars(input: LinkPlaceScalarsInput): Promise<LinkPlaceScalarsResult> {
    assertPlaceIdIsUsable(input.placeId);

    const data: Record<string, unknown> = {};

    if (input.candidate.coordinates) {
      data.lat = input.candidate.coordinates.lat;
      data.lng = input.candidate.coordinates.lng;
    }

    if (input.candidate.phone) {
      data.phone = input.candidate.phone;
    }

    if (input.candidate.locationRaw) {
      data.customAddress = input.candidate.locationRaw;
    }

    const cityId = await this.resolveCityId(input);
    if (cityId) {
      data.cityId = cityId;
    }

    const updatedFields = Object.keys(data);
    if (updatedFields.length === 0) {
      return { updated: false, updatedFields: [] };
    }

    await this.deps.prisma.place.update({
      where: { id: input.placeId },
      data,
    });

    return { updated: true, updatedFields };
  }

  /**
   * `context.cityId` always wins and skips the lookup entirely — an
   * explicitly supplied city is never second-guessed. Falls back to an
   * exact-match `cityLookup.findCityIdByName(cityRaw)` only if both a
   * `cityRaw` and a lookup dependency are present. A lookup miss (`null`)
   * or a missing dependency both mean "no `cityId`" — never a fuzzy guess.
   */
  private async resolveCityId(input: LinkPlaceScalarsInput): Promise<string | null> {
    if (input.context?.cityId) {
      return input.context.cityId;
    }
    if (input.candidate.cityRaw && this.deps.cityLookup) {
      return this.deps.cityLookup.findCityIdByName(input.candidate.cityRaw);
    }
    return null;
  }
}
