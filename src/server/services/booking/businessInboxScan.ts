import { compareBookingDecisions, type BookingBucket, type BookingBucketDecision } from "./bookingBucket";

export type InboxScanKind = "all" | "standard" | "party";
export interface RankedInboxRow<T> {
  row: T;
  createdAt: Date;
  decision: BookingBucketDecision;
  serviceEndsAt: Date | null;
}
type Counts = Record<BookingBucket, number>;
const emptyCounts = (): Counts => ({ ACTION_REQUIRED: 0, UPCOMING: 0, AWAITING_CUSTOMER: 0, ARCHIVE: 0 });

/** Retain the first K entries according to the canonical comparator, without collecting the full history. */
function insertTopK<T>(items: RankedInboxRow<T>[], item: RankedInboxRow<T>, cap: number): void {
  if (cap === 0) return;
  let lo = 0;
  let hi = items.length;
  // Equal-ranking entries retain their original database traversal order (stable sort).
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (compareBookingDecisions(items[mid], item) <= 0) lo = mid + 1;
    else hi = mid;
  }
  if (lo >= cap) return;
  items.splice(lo, 0, item);
  if (items.length > cap) items.pop();
}

export async function scanBusinessInboxPages<T extends { id: string; kind: "STANDARD" | "PARTY"; createdAt: Date }>(input: {
  fetchPage: (cursor?: string) => Promise<readonly T[]>;
  classify: (row: T) => RankedInboxRow<T>;
  bucket: BookingBucket;
  kind: InboxScanKind;
  limit: number;
}) {
  const maxItems = Math.min(100, Math.max(1, input.limit));
  const items: RankedInboxRow<T>[] = [];
  const nearestUpcoming: RankedInboxRow<T>[] = [];
  const totals = emptyCounts();
  const counts = emptyCounts();
  let customerWaiting = 0;
  let housekeeping = 0;
  let filteredCustomerWaiting = 0;
  let filteredHousekeeping = 0;
  let cursor: string | undefined;
  while (true) {
    const page = await input.fetchPage(cursor);
    if (page.length === 0) break;
    for (const row of page) {
      const entry = input.classify(row);
      const { decision } = entry;
      const matchesKind = input.kind === "all" ||
        row.kind === (input.kind === "party" ? "PARTY" : "STANDARD");
      totals[decision.bucket]++;
      if (decision.urgency === "CUSTOMER_WAITING") customerWaiting++;
      if (decision.urgency === "HOUSEKEEPING") housekeeping++;
      if (!matchesKind) continue;
      counts[decision.bucket]++;
      if (decision.urgency === "CUSTOMER_WAITING") filteredCustomerWaiting++;
      if (decision.urgency === "HOUSEKEEPING") filteredHousekeeping++;
      if (decision.bucket === input.bucket) insertTopK(items, entry, maxItems);
      if (input.bucket === "ACTION_REQUIRED" && decision.bucket === "UPCOMING")
        insertTopK(nearestUpcoming, entry, 3);
    }
    const next = page[page.length - 1].id;
    if (next === cursor) throw new Error("Business inbox cursor did not advance");
    cursor = next;
  }
  return {
    items, nearestUpcoming, counts, totals,
    actionGroups: { customerWaiting: filteredCustomerWaiting, housekeeping: filteredHousekeeping },
    menuBadge: customerWaiting,
    housekeepingTotal: housekeeping,
    hasMore: counts[input.bucket] > items.length,
  };
}
