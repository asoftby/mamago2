export function getEventPreviewPath(id: string): string {
  return `/me/events/${id}/preview`;
}

export function getPlacePreviewPath(id: string): string {
  return `/me/places/${id}/preview`;
}

export function getOfferPreviewPath(id: string): string {
  return `/me/offers/${id}/preview`;
}
