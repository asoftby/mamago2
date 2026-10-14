import assert from "node:assert/strict";
import { resolveActivityTicketLocation } from "./activityTicketLocation";

assert.deepEqual(resolveActivityTicketLocation({
  format: "ONLINE",
  venue: { kind: "PLACE", title: "Устаревшее место", addressLine: "Минск", place: { title: "Зал", formattedAddr: "Минск, 1" } },
  place: { title: "Здание", formattedAddr: "Минск, 2" },
}), { venue: null, address: null }, "online activities must never present a physical ticket location");

assert.deepEqual(resolveActivityTicketLocation({
  format: "OFFLINE",
  venue: { kind: "PLACE", title: "Старое имя", addressLine: "Старый адрес", place: {
    title: "Актуальная площадка", customAddress: "Новый адрес", formattedAddr: "Форматированный адрес",
  } },
}), { venue: "Актуальная площадка", address: "Новый адрес" }, "PLACE venue prefers the linked Place, not its saved snapshot");

assert.deepEqual(resolveActivityTicketLocation({
  format: "OFFLINE",
  venue: { kind: "MANUAL", title: "Сцена на площади", addressLine: "Вход с площади" },
  place: { title: "Рядом", formattedAddr: "Другая улица" },
}), { venue: "Сцена на площади", address: "Вход с площади" }, "manual venue should use its explicitly entered location");

assert.deepEqual(resolveActivityTicketLocation({
  place: { title: "Молодёжный театр эстрады", formattedAddr: "ул. Московская, 18а" },
}), { venue: "Молодёжный театр эстрады", address: "ул. Московская, 18а" }, "activity place is fallback");

console.log("activityTicketLocation tests: OK");
