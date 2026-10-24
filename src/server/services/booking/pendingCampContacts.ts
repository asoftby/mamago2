/**
 * Organizer contact details visible to the family after sending a camp
 * application, while it still awaits confirmation. Only published Offer
 * contacts and an explicitly inherited Place contact source may be used.
 * Business account phone and other fallback owners must never leak here.
 */
export function resolvePendingCampContacts(input: {
  contactSource: string | null;
  offerPhone: string | null;
  offerBookingPhone: string | null;
  offerWebsite: string | null;
  offerInstagram: string | null;
  placePhone: string | null;
  placeWebsite: string | null;
  placeInstagram: string | null;
}) {
  const fromPlace = input.contactSource === "place";
  return {
    phone: input.offerPhone ?? input.offerBookingPhone ??
      (fromPlace ? input.placePhone : null),
    website: input.offerWebsite ?? (fromPlace ? input.placeWebsite : null),
    instagram: input.offerInstagram || (fromPlace ? input.placeInstagram : null),
  };
}
