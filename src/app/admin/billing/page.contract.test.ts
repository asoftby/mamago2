"use strict";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

for (const text of [
  'title="Финансовый обзор"',
  'label="Выручка сегодня"',
  'label="Выручка за месяц"',
  'label="Успешные списания"',
  'label="Ошибки платежей"',
  'label="Активные бизнесы"',
  'label="Низкий баланс"',
  "Последние транзакции",
  "Все транзакции →",
  "Просроченные подписки",
  "Балансы бизнесов",
]) {
  assert.equal(source.includes(text), true, "missing localized UI copy: " + text);
}

for (const legacyEnglish of [
  "Billing Overview",
  "Revenue Today",
  "Revenue This Month",
  "Successful Charges",
  "Failed Payments",
  "Active Businesses",
  "Low Balance",
  "Recent Transactions",
  "View all",
  "Past Due",
  "All Transactions",
  "Business Balances",
]) {
  assert.equal(
    source.includes(">" + legacyEnglish + "<") || source.includes('"' + legacyEnglish + '"'),
    false,
    "legacy English UI copy must not remain: " + legacyEnglish,
  );
}

assert.equal(
  source.includes('revenueToday || 0, { hideZero: true }), { iconSize: "xs" }'),
  true,
  "today revenue must use the compact BYN symbol",
);
assert.equal(
  source.includes('revenueThisMonth || 0, { hideZero: true }), { iconSize: "xs" }'),
  true,
  "monthly revenue must use the compact BYN symbol",
);
assert.equal(source.includes("TransactionTypeBadge"), true);
assert.equal(source.includes("TransactionStatusBadge"), true);
assert.equal(source.includes("icon={Banknote}"), true);

console.log("Admin billing overview localization contract: OK");
