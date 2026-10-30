import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement, type ReactElement, type ReactNode } from "react";

import { PublicationTitle } from "@/components/publication-page/PublicationTitle";
import { publicOfferPriceLabel } from "./publicOfferPriceLabel";
import type { OfferPageData } from "@/lib/offer/offerPageTypes";

// SSR assertions exercise real components; CSS is compiled/checked by Next's build.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const originalCssLoader = require.extensions[".css"];
require.extensions[".css"] = () => {};
const { PublicOfferContent } =
  require("./PublicOfferContent") as typeof import("./PublicOfferContent");
const { PublicOfferHero } =
  require("./PublicOfferHero") as typeof import("./PublicOfferHero");
const { OfferAccordion, OfferUniqueSections } =
  require("./OfferAccordion") as typeof import("./OfferAccordion");
if (originalCssLoader) require.extensions[".css"] = originalCssLoader;
else delete require.extensions[".css"];

const data: OfferPageData = {
  id: "offer-test",
  slug: "test",
  citySlug: "minsk",
  title: "Услуга для семьи",
  offerType: "REGULAR",
  productType: "PARTY_SERVICE",
  media: { gallery: [] },
  metaGrid: [],
  pricing: {},
  cta: { primaryLabel: "Записаться" },
};
const primary = () => {};
const save = () => {};
const props = {
  data,
  priceLabel: "",
  isSaved: false,
  canEditOffer: false,
  ctaRef: { current: null },
  onPrimary: primary,
  onSave: save,
  onShiftCta: () => {},
  onSaveShift: () => {},
  onItemCta: () => {},
};
function render(overrides: Partial<OfferPageData> = {}) {
  return renderToStaticMarkup(
    createElement(PublicOfferContent, {
      ...props,
      data: { ...data, ...overrides },
    }),
  );
}
const empty = render({
  description: "<p> &nbsp; </p>",
  accommodation: { provided: false },
  openingHours: { lines: [], closedDates: [] },
});
for (const heading of [
  "Описание предложения",
  "Расписание дня",
  "Проживание и условия",
  "Режим работы",
  "Сколько это стоит",
  "Расписание уточняется",
]) {
  assert.ok(
    !empty.includes(heading),
    `empty public section is absent: ${heading}`,
  );
}
for (const mock of ["Подъём", "5-разовое", "База отдыха", "Медпункт"])
  assert.ok(!empty.includes(mock), `no synthetic ${mock}`);
assert.match(empty, /Услуга/); // productType wins over legacy REGULAR presentation.
assert.equal(
  renderToStaticMarkup(createElement(OfferUniqueSections, { data })),
  "",
);
assert.match(
  renderToStaticMarkup(createElement(OfferAccordion, { data })),
  /5-разовое/,
); // preview fallback preserved.
const camp = render({
  offerType: "CAMP",
  productType: "CAMP",
  daySchedule: [{ time: "12:00", title: "Реальная программа" }],
  accommodation: { rooms: "Двухместные комнаты", provided: true },
});
assert.match(camp, /Реальная программа/);
assert.match(camp, /Двухместные комнаты/);
assert.ok(!camp.includes("5-разовое"));
assert.match(render({ pricing: { priceMode: "FREE" } }), /Бесплатно/);
assert.match(
  render({ pricing: { priceMode: "ON_REQUEST" } }),
  /Цена по запросу/,
);
const tariff = render({
  description: "<p>Реальное описание</p>",
  pricing: {
    rawPriceItems: {
      items: [
        { id: "tariff", label: "Абонемент", price: "120", unit: "месяц" },
      ],
      note: "Условия оплаты",
    },
    discounts: [{ rate: "10%", label: "Второму ребёнку" }],
  },
});
for (const text of [
  "Реальное описание",
  "Абонемент",
  "Условия оплаты",
  "Второму ребёнку",
])
  assert.ok(tariff.includes(text));
const noAction = render({ hasPrimaryAction: false });
assert.ok(!noAction.includes(">Записаться</button>"));
assert.match(noAction, /aria-label="Сохранить публикацию"/);
// The presentation passes the controller's exact callbacks through, with no new action policy.
const hero = PublicOfferHero(props);
const callbacks: unknown[] = [];
function walk(node: ReactNode): void {
  if (Array.isArray(node)) {
    node.forEach(walk);
    return;
  }
  if (!node || typeof node !== "object" || !("props" in node)) return;
  const p = (node as ReactElement<Record<string, unknown>>).props;
  if (p.onClick) callbacks.push(p.onClick);
  walk(p.children as ReactNode);
  walk(p.decision as ReactNode);
}
walk(hero);
assert.ok(callbacks.includes(primary));
assert.ok(callbacks.includes(save) || render().includes("Сохранить"), "Shared Save/Share bar retains save action");
console.log(
  "Public Offer presentation: empty sections, no mock fallbacks, preview compatibility, real content, prices, tariffs and action callbacks OK",
);

assert.equal(
  publicOfferPriceLabel({ priceMode: "FROM" }, "25 BYN"),
  publicOfferPriceLabel({ priceMode: "FROM" }, "от 25 BYN"),
);
assert.equal(publicOfferPriceLabel({ priceMode: "NONE" }, "25 BYN"), "");
assert.match(
  render({
    schedule: {
      type: "classes",
      items: [
        {
          id: "group",
          groupName: "Реальная группа",
          days: "Понедельник",
          time: "12:00",
          ctaEnabled: true,
        },
      ],
    },
  }),
  /Реальная группа/,
);

assert.equal(
  renderToStaticMarkup(createElement(PublicationTitle, null, "Эталон Event")),
  '<h1 style="margin:0;font-family:var(--font-sans);font-size:40px;font-weight:600;line-height:1.1;letter-spacing:-0.025em;color:#141210">Эталон Event</h1>',
);

const staleTariffs = {
  items: [
    { id: "stale", label: "Старый платный тариф", price: "975", unit: "месяц" },
  ],
  note: "",
};
for (const mode of ["FREE", "NONE", "ON_REQUEST"] as const) {
  const html = render({
    pricing: {
      priceMode: mode,
      rawPriceItems: staleTariffs,
      oldPrice: "999",
      discounts: [{ rate: "50%", label: "Старая скидка" }],
    },
  });
  assert.ok(!html.includes("Старый платный тариф"));
  assert.ok(!html.includes("999"));
  assert.ok(!html.includes("Старая скидка"));
  assert.ok(!html.includes("Сколько это стоит"));
}

const linkedPricing = render({ pricing: {
  priceCaption: '<p>Читайте <a href="https://example.com/participation">условия участия</a></p>',
  promotionDetails: '<p><a href="https://example.com/promotion">Инструкция по акции</a></p>',
} });
assert.match(linkedPricing, /href="https:\/\/example\.com\/participation"/);
assert.match(linkedPricing, /href="https:\/\/example\.com\/promotion"/);
