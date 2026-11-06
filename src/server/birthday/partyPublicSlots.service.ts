import "server-only";
import prisma from "@/lib/prisma";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import { getPublicBirthdayOfferWhere } from "./birthdayOfferVisibility";
import { previewPartySlots } from "./partyPublicSlots";
import { loadPartyAvailability } from "./partyAvailabilityPreview.service";
import { constructorOfferSelect, toConstructorOffer } from "./constructorOffer";
import { isEligibleForConstructor } from "./constructorEligibility";
import { assessConstructorGeography } from "./constructorMatching";

/** Same public offer, admission, geography and resource reader as candidate matching. */
export async function getPublicPartySlotPreview(params: { citySlug: string; offerId: string; day: string; durationMinutes: number; guestCount: number }) {
  const city = await findCityBySlug(params.citySlug,{ select: { id: true }, isActive: true });
  if (!city) return null;
  const offer = await prisma.offer.findFirst({ where: { AND: [getPublicBirthdayOfferWhere(null),{ id: params.offerId }] }, select: constructorOfferSelect });
  if (!offer?.place?.ownerBusinessId || !isEligibleForConstructor(offer.place.ownerBusiness)) return null;
  const destination = await prisma.territoryLegacyMap.findUnique({ where: { legacyKind_legacyId: { legacyKind: "CITY", legacyId: city.id } }, select: { territoryId: true } });
  const dto = toConstructorOffer(offer);
  if (assessConstructorGeography(dto,destination ? { state: "KNOWN", value: { territoryId: destination.territoryId, placeId: null } } : { state: "UNKNOWN", reason: "NOT_PROVIDED" },"VENUE") === "MISMATCH") return null;
  const now = new Date();
  const evidence = await loadPartyAvailability(prisma,[{ id: offer.id, businessId: offer.place.ownerBusinessId }], {
    startAt: new Date(params.day+"T00:00:00+03:00").toISOString(), endAt: new Date(params.day+"T23:59:00+03:00").toISOString(),
  },params.guestCount,now);
  const units = evidence.get(offer.id)?.units ?? [];
  if (!units.length) return { mode: "REQUEST_ONLY" as const, slots: [] };
  return { mode: "SCHEDULED" as const, slots: previewPartySlots({ ...params, now, units }) };
}
