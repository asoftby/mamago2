import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { ActivityTicketCard, adaptActivityTicket, formatTicketAddress } from "./ActivityTicketCard";
import { BYN_SYMBOL } from "@/lib/formatters/format-price";
import { readFileSync } from "node:fs";
import { join } from "node:path";

assert.deepEqual(adaptActivityTicket({ title: "Событие", priceMode: "FREE" }).price, {
  kind: "free",
  label: "Бесплатно",
});
assert.deepEqual(adaptActivityTicket({ title: "Занятие", priceMode: "FROM", priceValue: 45 }).price, {
  kind: "paid",
  label: `от 45 ${BYN_SYMBOL}`,
  amount: "45",
  isFrom: true,
});
assert.deepEqual(adaptActivityTicket({ title: "Предложение", priceMode: "EXACT", priceValue: "45 BYN" }).price, {
  kind: "paid",
  label: `45 ${BYN_SYMBOL}`,
  amount: "45",
  isFrom: false,
});
assert.deepEqual(adaptActivityTicket({ title: "Группированная цена", priceMode: "EXACT", priceLabel: "1 200,00 BYN" }).price, {
  kind: "paid",
  label: `1200 ${BYN_SYMBOL}`,
  amount: "1200",
  isFrom: false,
});
assert.deepEqual(adaptActivityTicket({ title: "Диапазон", priceLabel: "1 200–1 500 BYN" }).price, {
  kind: "paid",
  label: `от 1200 ${BYN_SYMBOL}`,
  amount: "1200",
  isFrom: true,
});
assert.equal(adaptActivityTicket({ title: "Неизвестная цена" }).price, null);
assert.equal(
  adaptActivityTicket({ title: "Ноль не означает бесплатно", priceMode: "UNKNOWN", priceValue: 0 }).price,
  null,
);

const html = renderToStaticMarkup(
  <ActivityTicketCard
    source={{
      title: "Очень длинное название события, которое должно аккуратно занять не больше двух строк",
      venue: "Детский центр",
      address: "Минск, улица Примерная, 10",
      priceMode: "FREE",
    }}
  />,
);
assert.ok(html.includes("line-clamp-2"), "title is clamped to two lines");
assert.ok(html.includes("Детский центр"), "venue is rendered");
assert.ok(html.includes("г. Минск, улица Примерная, 10"), "address is rendered in short city-first form");
assert.ok(html.includes("Бесплатно"), "free label is rendered");
assert.ok(html.includes("Обложка отсутствует"), "missing image uses the project placeholder pattern");
assert.ok(html.includes("border-dashed"), "price section keeps the ticket perforation");
assert.ok(html.includes("min-h-[112px]"), "ticket has a compact 112px minimum height");
assert.ok(html.includes("py-3"), "vertical ticket padding is compact while content remains legible");
assert.ok(html.includes("mask-image:") && html.includes("mask-composite:intersect"), "side notches mask the entire ticket transparently");
assert.ok(!html.includes("-left-2.5") && !html.includes("-right-2.5"), "old white circle overlays are removed");

const imageHtml = renderToStaticMarkup(
  <ActivityTicketCard
    source={{
      title: "Событие с обложкой",
      imageUrl: "https://example.com/cover.jpg",
      priceMode: "UNKNOWN",
    }}
  />,
);
assert.ok(imageHtml.includes("absolute inset-0 -z-20 h-full w-full object-cover object-center"), "cover fills the full ticket");
assert.ok(!imageHtml.includes("Бесплатно"), "an unknown price is never rendered as free");

const paidHtml = renderToStaticMarkup(
  <ActivityTicketCard source={{ title: "Спектакль", venue: "Дворец культуры", address: "Минск, ул. Ленина, 10", priceMode: "FROM", priceValue: 40 }} />,
);
assert.ok(paidHtml.includes("Дворец культуры") && paidHtml.includes("г. Минск, ул. Ленина, 10"));
assert.ok(paidHtml.includes('>от</span>'), "the from prefix is rendered on its own line");
assert.ok(paidHtml.includes('text-[26px]') && paidHtml.includes('>40</span>'), "the amount is prominently rendered on the second line");
assert.ok(paidHtml.includes('text-[12px]') && paidHtml.includes('aria-label="бел. руб."'), "the official BYN sign is the same small size as 'от'");
assert.ok(!paidHtml.includes(`от 40 ${BYN_SYMBOL}`), "the ticket does not render a flat price string");

const exactHtml = renderToStaticMarkup(
  <ActivityTicketCard source={{ title: "Билет", priceMode: "EXACT", priceValue: 30 }} />,
);
assert.ok(exactHtml.includes('>30</span>'), "an exact paid amount is still large");
assert.ok(!exactHtml.includes('>от</span>'), "an exact price is never mislabeled as from");

const widePriceHtml = renderToStaticMarkup(
  <ActivityTicketCard source={{ title: "Событие", priceMode: "FROM", priceValue: 1200 }} />,
);
assert.ok(widePriceHtml.includes('text-[20px]'), "a four-digit price fits in the narrow price area");

const saveModal = readFileSync(join(process.cwd(), "src/components/activity/SaveToPlanModal.tsx"), "utf8");
const saveHeader = readFileSync(join(process.cwd(), "src/components/activity/SaveActivityHeader.tsx"), "utf8");
const confirmBar = saveModal.split("function ConfirmBar(")[1]?.split("// ─── All-dates drawer")[0];
assert.ok(confirmBar?.includes("{label}"), "save action keeps its label");
assert.ok(!confirmBar?.includes("<ArrowIcon"), "Save button has no arrow");
assert.ok(saveHeader.includes("marginTop: 18, marginBottom: 18"), "ticket outside spacing decreases another 5px on both sides");
assert.ok(saveHeader.includes('className="mb-1 flex h-10 -translate-y-1 items-center justify-start sm:translate-y-0"'), "header label is left-aligned");
assert.ok(saveHeader.includes(">сохранить активность</span>"), "kicker has no bullet");
assert.ok(!saveHeader.includes("● сохранить активность"), "kicker bullet is removed");
assert.ok(saveModal.includes('className="px-6 pb-5 pt-0 sm:pt-4"'), "mobile and desktop header labels align with close button");


assert.equal(formatTicketAddress("ул. Московская 18а, Минск, Минская область 220007"), "г. Минск, ул. Московская, 18а");
assert.equal(formatTicketAddress("г. Минск, ул. Московская, 18а"), "г. Минск, ул. Московская, 18а");
assert.equal(formatTicketAddress("Минск, ул. Московская, 18а"), "г. Минск, ул. Московская, 18а");
assert.equal(formatTicketAddress("ул. Советская 25, Гродно, Гродненская область 230000"), "г. Гродно, ул. Советская, 25");
assert.equal(formatTicketAddress("Произвольное описание места"), "Произвольное описание места");
assert.equal(formatTicketAddress(null), null);

console.log("ActivityTicketCard tests: OK");
