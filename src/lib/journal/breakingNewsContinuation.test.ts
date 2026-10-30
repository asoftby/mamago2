import assert from "node:assert/strict";
import { activeBreakingNewsContinuationWhere, nextContinuationItem } from "./breakingNewsContinuation";
import { BREAKING_NEWS_SUBTITLE } from "@/lib/publications/breakingNewsArticle";

const now = new Date("2026-10-30T10:00:00Z");
const where = activeBreakingNewsContinuationWhere(now);
assert.equal(where.subtitle, BREAKING_NEWS_SUBTITLE);
assert.deepEqual(where.expiresAt, { gt: now }, "expired and missing-expiry entries are excluded");
assert.deepEqual(where.publishedAt, { lte: now }, "future-dated news must not appear");
console.log("Breaking News active continuation query: OK");

const queue = [{ id: "expired" }, { id: "still-active" }];
assert.equal(nextContinuationItem(queue, new Set(), new Set())?.id, "expired");
assert.equal(nextContinuationItem(queue, new Set(), new Set(["expired"]))?.id, "still-active",
  "a 404 for expired metadata must never block the next active article");
assert.equal(nextContinuationItem(queue, new Set(["still-active"]), new Set(["expired"])), null,
  "the reader can reach the end when all candidates are read or unavailable");
