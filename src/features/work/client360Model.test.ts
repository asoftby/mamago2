import assert from "node:assert/strict";
import { test } from "node:test";
import {
  crmClientPath,
  crmClientsHref,
  isCurrentSubscription,
  parseClientFilter,
  parseClientPage,
} from "./client360Model";

test("client filters are explicitly allowlisted", () => {
  assert.equal(parseClientFilter("pending"), "pending");
  assert.equal(parseClientFilter("admin"), "all");
  assert.equal(parseClientFilter(), "all");
});

test("client pagination rejects bad page numbers", () => {
  assert.equal(parseClientPage("8"), 8);
  assert.equal(parseClientPage("-1"), 1);
  assert.equal(parseClientPage("NaN"), 1);
  assert.equal(parseClientPage("1.4"), 1);
  assert.equal(parseClientPage("99999999"), 10000);
});

test("current tariff must be active and unexpired", () => {
  const now = new Date("2026-11-03T10:00:00Z");
  const after = new Date("2026-12-03T10:00:00Z");
  const before = new Date("2026-10-03T10:00:00Z");
  assert.equal(isCurrentSubscription("ACTIVE", after, now), true);
  assert.equal(isCurrentSubscription("TRIALING", after, now), true);
  assert.equal(isCurrentSubscription("ACTIVE", before, now), false);
  assert.equal(isCurrentSubscription("PAST_DUE", after, now), false);
  assert.equal(isCurrentSubscription("CANCELED", after, now), false);
});

test("client links encode IDs and retain search state", () => {
  assert.equal(crmClientPath("a/b"), "/admin/work/clients/a%2Fb");
  assert.equal(
    crmClientsHref({ filter: "pending", search: "дети & спорт", page: 2 }),
    "/admin/work/clients?status=pending&q=%D0%B4%D0%B5%D1%82%D0%B8+%26+%D1%81%D0%BF%D0%BE%D1%80%D1%82&page=2",
  );
});
