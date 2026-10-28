import assert from "node:assert/strict";
import { bookingBucket, compareBookingDecisions, type BookingBucket } from "./bookingBucket";
import { scanBusinessInboxPages, type InboxScanKind } from "./businessInboxScan";

const now = new Date("2026-10-29T12:00:00.000Z");
type RecordRow = {
  id: string; kind: "STANDARD" | "PARTY"; createdAt: Date;
  status: "NEW" | "CONFIRMED" | "CANCELLED";
  stage: "SENT" | "QUOTED" | "CONFIRMED" | "CANCELLED" | null;
  end: Date | null; due: Date | null; quoteValid: Date | null;
};

function createRows(n: number): RecordRow[] {
  return Array.from({ length: n }, (_, i) => {
    const party = i % 3 === 0;
    const variant = i % 6;
    const stage = party ? (variant === 0 ? "SENT" : variant === 3 ? "QUOTED" : "CONFIRMED") : null;
    return {
      id: `book-${String(i).padStart(5, "0")}`,
      createdAt: new Date(now.getTime() - Math.floor(i / 3) * 60_000),
      kind: party ? "PARTY" : "STANDARD",
      status: party ? (stage === "CONFIRMED" ? "CONFIRMED" : "NEW") : (variant === 1 ? "NEW" : "CONFIRMED"),
      stage,
      end: i % 4 === 0 ? new Date(now.getTime() - 3600_000) : new Date(now.getTime() + 3600_000 * 24),
      due: i % 5 === 0 ? new Date(now.getTime() - 1000) : new Date(now.getTime() + 3600_000),
      quoteValid: i % 2 === 0 ? new Date(now.getTime() - 1000) : new Date(now.getTime() + 3600_000),
    };
  }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id));
}
const classify = (row: RecordRow) => ({
  row, createdAt: row.createdAt, serviceEndsAt: row.end,
  decision: bookingBucket({
    kind: row.kind, status: row.status, partyStage: row.stage,
    createdAt: row.createdAt, serviceEndsAt: row.end, hasServiceDate: Boolean(row.end),
    responseDueAt: row.due, quoteStatus: row.stage === "QUOTED" ? "ACTIVE" : null,
    quoteValidUntil: row.quoteValid,
  }, now),
});
const empty = () => ({ ACTION_REQUIRED: 0, UPCOMING: 0, AWAITING_CUSTOMER: 0, ARCHIVE: 0 });
function reference(rows: RecordRow[], bucket: BookingBucket, kind: InboxScanKind, limit: number) {
  const decisions = rows.map(classify);
  const totals = empty(); const counts = empty();
  let customerWaiting = 0, housekeeping = 0, filteredCustomerWaiting = 0, filteredHousekeeping = 0;
  for (const item of decisions) {
    const d = item.decision;
    totals[d.bucket]++;
    const match = kind === "all" || item.row.kind === (kind === "party" ? "PARTY" : "STANDARD");
    if (d.urgency === "CUSTOMER_WAITING") customerWaiting++;
    if (d.urgency === "HOUSEKEEPING") housekeeping++;
    if (!match) continue;
    counts[d.bucket]++;
    if (d.urgency === "CUSTOMER_WAITING") filteredCustomerWaiting++;
    if (d.urgency === "HOUSEKEEPING") filteredHousekeeping++;
  }
  const matches = (x: ReturnType<typeof classify>) => kind === "all" || x.row.kind === (kind === "party" ? "PARTY" : "STANDARD");
  const items = decisions.filter((x) => x.decision.bucket === bucket && matches(x))
    .sort(compareBookingDecisions).slice(0, Math.min(100, Math.max(1, limit)));
  const upcoming = bucket === "ACTION_REQUIRED" ? decisions.filter((x) => x.decision.bucket === "UPCOMING" && matches(x))
    .sort(compareBookingDecisions).slice(0, 3) : [];
  return { items: items.map((x) => x.row.id), nearestUpcoming: upcoming.map((x) => x.row.id), totals, counts,
    menuBadge: customerWaiting, housekeepingTotal: housekeeping,
    actionGroups: { customerWaiting: filteredCustomerWaiting, housekeeping: filteredHousekeeping },
    hasMore: counts[bucket] > items.length };
}

async function main() {
  for (const size of [0, 1, 100, 1000]) {
    const rows = createRows(size);
    for (const bucket of ["ACTION_REQUIRED", "UPCOMING", "AWAITING_CUSTOMER", "ARCHIVE"] as const) {
      for (const kind of ["all", "standard", "party"] as const) {
        let calls = 0;
        let peakRows = 0;
        const actual = await scanBusinessInboxPages({
          fetchPage: async (cursor) => {
            calls++;
            const start = cursor ? rows.findIndex((r) => r.id === cursor) + 1 : 0;
            const page = rows.slice(start, start + 200);
            peakRows = Math.max(peakRows, page.length);
            return page;
          },
          classify, bucket, kind, limit: 17,
        });
        const expected = reference(rows, bucket, kind, 17);
        assert.deepEqual({ ...actual, items: actual.items.map((x) => x.row.id),
          nearestUpcoming: actual.nearestUpcoming.map((x) => x.row.id) }, expected, `size=${size}, bucket=${bucket}, kind=${kind}`);
        assert.ok(peakRows <= 200);
        assert.ok(actual.items.length <= 17 && actual.nearestUpcoming.length <= 3);
        assert.ok(calls <= Math.ceil(size / 200) + 1);
      }
    }
  }
  await assert.rejects(scanBusinessInboxPages({
    fetchPage: async () => [{ id: "A", kind: "STANDARD" as const, createdAt: now }],
    classify: (row) => ({ row, createdAt: now, serviceEndsAt: null, decision: bookingBucket({ kind: "STANDARD", status: "NEW", createdAt: now }, now) }),
    bucket: "ACTION_REQUIRED", kind: "all", limit: 10,
  }), /cursor did not advance/);
  console.log("Business Inbox bounded parity tests: OK");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
