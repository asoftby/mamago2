import assert from "node:assert/strict";
import { ContentStatus } from "@prisma/client";
import { getEventPromoteBlockReason } from "./canPromoteEvent";

const now = new Date("2026-11-16T12:00:00Z");
const future = new Date("2026-11-20T10:00:00Z");
const past = new Date("2026-11-13T10:00:00Z");

assert.equal(getEventPromoteBlockReason(ContentStatus.PUBLISHED, future, now), null);
assert.equal(getEventPromoteBlockReason(ContentStatus.PUBLISHED, null, now), null, "без даты не считается прошедшим");
assert.equal(getEventPromoteBlockReason(ContentStatus.PUBLISHED, past, now), "past");
assert.equal(getEventPromoteBlockReason(ContentStatus.PUBLISHED, past.toISOString(), now), "past", "строка даты после сериализации");
assert.equal(getEventPromoteBlockReason(ContentStatus.DRAFT, future, now), "not-published");
assert.equal(getEventPromoteBlockReason(ContentStatus.ARCHIVED, future, now), "not-published");
assert.equal(getEventPromoteBlockReason(ContentStatus.ARCHIVED, past, now), "not-published", "неактивность приоритетнее");

console.log("canPromoteEvent.test: OK");
