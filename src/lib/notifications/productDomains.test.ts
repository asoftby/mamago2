import assert from "node:assert/strict";
import {
  getNotificationProductDomainBadge,
  resolveNotificationProductDomain,
} from "./productDomains";

assert.equal(
  resolveNotificationProductDomain({
    type: "SYSTEM",
    audience: "USER",
    title: "Ваша почта подтверждена",
    body: "Теперь вы можете получать важные уведомления.",
  }),
  "ACCOUNT",
);

assert.equal(
  getNotificationProductDomainBadge({
    type: "SYSTEM",
    audience: "USER",
    title: "Ваша почта подтверждена",
    body: "Теперь вы можете получать важные уведомления.",
  }).label,
  "Аккаунт",
);

assert.equal(
  resolveNotificationProductDomain({
    type: "BOOKING_CONFIRMED",
    audience: "USER",
    title: "Заявка подтверждена",
    body: "Бизнес подтвердил вашу запись.",
  }),
  "BOOKINGS",
);

assert.equal(
  getNotificationProductDomainBadge({
    type: "UNRECOGNIZED_TYPE",
    audience: null,
    title: "Неизвестное уведомление",
    body: "",
  }).label,
  "Система",
);

console.log("productDomains tests: OK");
