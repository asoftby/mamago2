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
  explicitStartDate.eventStatus,
  "https://schema.org/EventScheduled",
  "published events must explicitly describe their scheduled status",
);

const structuredLocation = buildEventJsonLd({
  canonicalUrl,
  title: "Structured location event",
  startDate: "2026-09-01T12:00:00+03:00",
  location: {
    name: "Парк истории Сула",
    address: "Сула, 14, Сула, Минская область 222664",
    addressLocality: "Минск",
  },
});

assert.ok(structuredLocation);
assert.deepEqual(
  structuredLocation.location,
  {
    "@type": "Place",
    name: "Парк истории Сула",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Сула, 14, Сула, Минская область 222664",
      addressLocality: "Минск",
      addressCountry: "BY",
    },
  },
  "physical Event addresses must be emitted as PostalAddress without guessing address components",
);

const freeEvent = buildEventJsonLd({
  canonicalUrl,
  title: "Free event",
  startDate: "2026-09-01T12:00:00+03:00",
  sessions: [{ startsAt: "2026-09-01T12:00:00+03:00", isSaleOpen: true }],
  pricing: {
    mode: "FREE",
    priceFrom: null,
    currency: "BYN",
    validFrom: "2026-08-01T09:00:00+03:00",
  },
});
assert.ok(freeEvent);
assert.deepEqual(
  freeEvent.offers,
  {
    "@type": "Offer",
    price: 0,
    priceCurrency: "BYN",
    url: canonicalUrl,
    availability: "https://schema.org/InStock",
    validFrom: "2026-08-01T06:00:00.000Z",
  },
  "FREE events must expose zero-price admission",
);

for (const [mode, price] of [
  ["EXACT", 25],
  ["FROM", 12.5],
  ["RANGE", 10],
] as const) {
  const pricedEvent = buildEventJsonLd({
    canonicalUrl,
    title: `${mode} event`,
    startDate: "2026-09-01T12:00:00+03:00",
    pricing: { mode, priceFrom: price, currency: "byn" },
  });
  assert.ok(pricedEvent);
  assert.deepEqual(
    pricedEvent.offers,
    {
      "@type": "Offer",
      price,
      priceCurrency: "BYN",
      url: canonicalUrl,
      availability: undefined,
      validFrom: undefined,
    },
    `${mode} events must expose their lowest authoritative price`,
  );
}

for (const mode of ["NONE", "UNKNOWN"] as const) {
  const unknownEvent = buildEventJsonLd({
    canonicalUrl,
    title: `${mode} event`,
    startDate: "2026-09-01T12:00:00+03:00",
    pricing: { mode, priceFrom: 20, currency: "BYN" },
  });
  assert.ok(unknownEvent);
  assert.equal(
    unknownEvent.offers,
    undefined,
    `${mode} pricing must not create Event offers`,
  );
}

const invalidPrice = buildEventJsonLd({
  canonicalUrl,
  title: "Invalid price event",
  startDate: "2026-09-01T12:00:00+03:00",
  pricing: { mode: "EXACT", priceFrom: -5, currency: "BYN" },
});
assert.ok(invalidPrice);
assert.equal(invalidPrice.offers, undefined, "invalid numeric prices must not enter JSON-LD");

const invalidCurrency = buildEventJsonLd({
  canonicalUrl,
  title: "Invalid currency event",
  startDate: "2026-09-01T12:00:00+03:00",
  pricing: { mode: "EXACT", priceFrom: 10, currency: "Br" },
});
assert.ok(invalidCurrency);
assert.equal(invalidCurrency.offers, undefined, "non-ISO currency labels must not enter JSON-LD");

const closedEvent = buildEventJsonLd({
  canonicalUrl,
  title: "Closed sale event",
  startDate: "2026-09-01T12:00:00+03:00",
  sessions: [{ startsAt: "2026-09-01T12:00:00+03:00", isSaleOpen: false }],
  pricing: { mode: "EXACT", priceFrom: 10, currency: "BYN", validFrom: "" },
});
assert.ok(closedEvent);
assert.equal(
  (closedEvent.offers as Record<string, unknown>).availability,
  "https://schema.org/OutOfStock",
);
assert.equal(
  (closedEvent.offers as Record<string, unknown>).validFrom,
  undefined,
  "validFrom must be omitted without an authoritative date",
);

const incompletePhysicalLocation = buildEventJsonLd({
  canonicalUrl,
  title: "Physical event without an address",
  description: "",
  image: "",
  startDate: "2026-09-01T12:00:00+03:00",
  location: { name: "Площадка", address: "", addressLocality: "Минск" },
});
assert.ok(incompletePhysicalLocation);
assert.deepEqual(incompletePhysicalLocation.location, {
  "@type": "Place",
  name: "Площадка",
  address: undefined,
});
const serializedIncomplete = JSON.stringify(incompletePhysicalLocation);
assert.doesNotMatch(serializedIncomplete, /null|""/, "empty optional values must not be serialized");
assert.match(
  String(incompletePhysicalLocation.startDate),
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
  "startDate must remain ISO 8601",
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
    name: "Invalid calendar date",
    startDate: "2026-02-30",
  }),
  true,
  "calendar-invalid dates must not pass through JavaScript date normalization",
);

assert.equal(
  eventJsonLdOverrideHasMissingStartDate({
    "@context": "https://schema.org",
    "@type": "Event",
    name: "Locale date",
    startDate: "09/01/2026",
  }),
  true,
  "locale-formatted dates must not be accepted as structured dates",
);

assert.equal(
  eventJsonLdOverrideHasMissingStartDate({
    "@context": "https://schema.org",
    "@type": "https://schema.org/Event",
    name: "Absolute Event IRI",
  }),
  true,
  "absolute schema.org Event IRIs must require startDate",
);

assert.equal(
  eventJsonLdOverrideHasMissingStartDate({
    "@context": "https://schema.org",
    "@type": ["Thing", "http://schema.org/Event"],
    name: "Event IRI in type array",
  }),
  true,
  "Event IRIs inside type arrays must require startDate",
);

assert.equal(
  eventJsonLdOverrideHasMissingStartDate({
    "@context": "https://schema.org",
    "@type": "Event",
    name: "Valid date-only override",
    startDate: "2028-02-29",
  }),
  false,
  "valid ISO date-only Event startDate must remain usable",
);

assert.equal(
  eventJsonLdOverrideHasMissingStartDate({
    "@context": "https://schema.org",
    "@type": "Event",
    name: "Valid override",
    startDate: "2026-09-01T12:00:00+03:00",
  }),
  false,
  "Event overrides with a valid ISO startDate must remain usable",
);

console.log("buildEventJsonLd tests: OK");
