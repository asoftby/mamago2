import assert from "node:assert/strict";
import {
  buildEventJsonLd,
  eventJsonLdOverrideHasMissingStartDate,
  pickEventStartDate,
} from "./buildEventJsonLd";

const canonicalUrl = "https://mamago.by/minsk/events/test-event";

assert.equal(
  pickEventStartDate([
    { startsAt: "2000-01-01T10:00:00.000Z" },
    { startsAt: "2001-01-01T10:00:00.000Z" },
  ]),
  "2001-01-01T10:00:00.000Z",
  "past-only sessions must use the most recent occurrence",
);

assert.equal(
  pickEventStartDate([
    { startsAt: "2101-01-01T10:00:00.000Z" },
    { startsAt: "2100-01-01T10:00:00.000Z" },
  ]),
  "2100-01-01T10:00:00.000Z",
  "future sessions must use the next occurrence",
);

assert.equal(
  pickEventStartDate([{ startsAt: null }, { startsAt: "not-a-date" }]),
  undefined,
  "invalid sessions must not create a fake date",
);

const explicitStartDate = buildEventJsonLd({
  canonicalUrl,
  title: "Test event",
  startDate: "2026-08-31T12:00:00+03:00",
  sessions: [{ startsAt: "2100-01-01T10:00:00.000Z" }],
});

assert.ok(explicitStartDate);
assert.equal(
  explicitStartDate.startDate,
  "2026-08-31T09:00:00.000Z",
  "authoritative schema start date must win over UI session filtering",
);

assert.equal(
  buildEventJsonLd({
    canonicalUrl,
    title: "Undated event",
    sessions: [],
  }),
  null,
  "Event JSON-LD without a valid startDate must not be emitted",
);

assert.equal(
  eventJsonLdOverrideHasMissingStartDate({
    "@context": "https://schema.org",
    "@type": "Event",
    name: "Broken override",
  }),
  true,
  "direct Event overrides without startDate must be rejected",
);

assert.equal(
  eventJsonLdOverrideHasMissingStartDate({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Event",
        name: "Broken graph override",
      },
    ],
  }),
  true,
  "Event nodes inside @graph must also be checked",
);

assert.equal(
  eventJsonLdOverrideHasMissingStartDate({
    "@context": "https://schema.org",
    "@type": "Event",
    name: "Valid override",
    startDate: "2026-09-01T12:00:00+03:00",
  }),
  false,
  "Event overrides with a valid startDate must remain usable",
);

console.log("buildEventJsonLd tests: OK");
