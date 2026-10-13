import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { ActivityTicketCard, adaptActivityTicket } from "./ActivityTicketCard";

assert.deepEqual(adaptActivityTicket({ title: "Событие", priceMode: "FREE" }).price, {
  kind: "free",
  label: "Бесплатно",
});
assert.deepEqual(adaptActivityTicket({ title: "Занятие", priceMode: "FROM", priceValue: 45 }).price, {
  kind: "paid",
  label: "от 45 Br",
});
assert.deepEqual(adaptActivityTicket({ title: "Предложение", priceMode: "EXACT", priceValue: "45 BYN" }).price, {
  kind: "paid",
  label: "45 Br",
});
assert.deepEqual(adaptActivityTicket({ title: "Группированная цена", priceMode: "EXACT", priceLabel: "1 200,00 BYN" }).price, {
  kind: "paid",
  label: "1200 Br",
});
assert.deepEqual(adaptActivityTicket({ title: "Диапазон", priceLabel: "1 200–1 500 BYN" }).price, {
  kind: "paid",
  label: "от 1200 Br",
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

console.log("ActivityTicketCard tests: OK");
