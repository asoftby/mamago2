import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { ActivityTicketCard, adaptActivityTicket } from "./ActivityTicketCard";
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
});
assert.deepEqual(adaptActivityTicket({ title: "Предложение", priceMode: "EXACT", priceValue: "45 BYN" }).price, {
  kind: "paid",
  label: `45 ${BYN_SYMBOL}`,
});
assert.deepEqual(adaptActivityTicket({ title: "Группированная цена", priceMode: "EXACT", priceLabel: "1 200,00 BYN" }).price, {
  kind: "paid",
  label: `1200 ${BYN_SYMBOL}`,
});
assert.deepEqual(adaptActivityTicket({ title: "Диапазон", priceLabel: "1 200–1 500 BYN" }).price, {
  kind: "paid",
  label: `от 1200 ${BYN_SYMBOL}`,
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
assert.ok(html.includes("Минск, улица Примерная, 10"), "address is rendered");
assert.ok(html.includes("Бесплатно"), "free label is rendered");
assert.ok(html.includes("Обложка отсутствует"), "missing image uses the project placeholder pattern");
assert.ok(html.includes("border-dashed"), "price section keeps the ticket perforation");
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
assert.ok(paidHtml.includes("Дворец культуры") && paidHtml.includes("Минск, ул. Ленина, 10"));
assert.ok(paidHtml.includes("от 40"), "a known price appears on the right of the perforation");
assert.ok(paidHtml.includes('aria-label="бел. руб."'), "the amount uses the official Belarusian ruble icon");

const saveModal = readFileSync(join(process.cwd(), "src/components/activity/SaveToPlanModal.tsx"), "utf8");
const confirmBar = saveModal.split("function ConfirmBar(")[1]?.split("// ─── All-dates drawer")[0];
assert.ok(confirmBar?.includes("{label}"), "save action keeps its label");
assert.ok(!confirmBar?.includes("<ArrowIcon"), "Save button has no arrow");


console.log("ActivityTicketCard tests: OK");
