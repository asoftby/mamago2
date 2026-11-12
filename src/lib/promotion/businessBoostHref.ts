/** Single Boost entry point for business-owned Event and Offer publications. */
export function buildBusinessBoostHref(type: "EVENT" | "OFFER", id: string): string {
  return `/business/boost?publicationType=${type}&publicationId=${encodeURIComponent(id)}`;
}
