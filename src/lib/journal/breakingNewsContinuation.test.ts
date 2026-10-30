import assert from "node:assert/strict";
import { activeBreakingNewsContinuationWhere } from "./breakingNewsContinuation";
import { BREAKING_NEWS_SUBTITLE } from "@/lib/publications/breakingNewsArticle";

const now = new Date("2026-10-30T10:00:00Z");
const where = activeBreakingNewsContinuationWhere(now);
assert.equal(where.subtitle, BREAKING_NEWS_SUBTITLE);
assert.deepEqual(where.expiresAt, { gt: now }, "expired and missing-expiry entries are excluded");
assert.deepEqual(where.publishedAt, { lte: now }, "future-dated news must not appear");
console.log("Breaking News active continuation query: OK");
