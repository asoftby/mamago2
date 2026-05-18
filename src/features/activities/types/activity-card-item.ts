export type ActivityCardItemType = "event" | "offer";

export interface ActivityCardItem {
  id: string;
  type: ActivityCardItemType;
  title: string;
  href: string;
  imageUrl: string | null;
  badgeLabel: string | null;
  dateLabel: string | null;
  placeTitle: string | null;
  addressLabel: string | null;
  priceLabel: string | null;
  ageLabel: string | null;
  categoryLabel: string | null;
  isSaved: boolean;
  isPlanned: boolean;
  isPast: boolean;
  statusLabel: string | null;
}
