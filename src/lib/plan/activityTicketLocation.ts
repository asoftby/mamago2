/** Ticket venue/address must match the public event page, including online events. */
type TicketPlace = {
  title: string;
  customAddress?: string | null;
  formattedAddr?: string | null;
  shortAddress?: string | null;
};

type TicketVenue = {
  kind: string;
  title?: string | null;
  addressLine?: string | null;
  place?: TicketPlace | null;
};

type TicketLocationInput = {
  format?: string | null;
  place?: TicketPlace | null;
  venue?: TicketVenue | null;
};

function placeAddress(place: TicketPlace | null | undefined): string | null {
  return place?.customAddress ?? place?.formattedAddr ?? place?.shortAddress ?? null;
}

export function resolveActivityTicketLocation(activity: TicketLocationInput): {
  venue: string | null;
  address: string | null;
} {
  if (activity.format === "ONLINE") return { venue: null, address: null };

  // Linked Place is the live source of truth; EventVenue.addressLine is an old snapshot.
  if (activity.venue?.kind === "PLACE" && activity.venue.place) {
    return { venue: activity.venue.place.title, address: placeAddress(activity.venue.place) };
  }

  // Manual venue: show its explicit address before the event's fallback Place.
  if (activity.venue?.title || activity.venue?.addressLine) {
    return {
      venue: activity.venue.title ?? activity.place?.title ?? null,
      address: activity.venue.addressLine ?? placeAddress(activity.place),
    };
  }

  return { venue: activity.place?.title ?? null, address: placeAddress(activity.place) };
}
