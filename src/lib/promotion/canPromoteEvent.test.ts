import assert from "node:assert/strict";
import { ContentStatus } from "@prisma/client";
import { getEventPromoteBlockReason } from "./canPromoteEvent";

assert.equal(getEventPromoteBlockReason(ContentStatus.PUBLISHED, "UPCOMING"), null);
assert.equal(getEventPromoteBlockReason(ContentStatus.PUBLISHED, "ONGOING"), null);
assert.equal(getEventPromoteBlockReason(ContentStatus.PUBLISHED, "UNKNOWN"), null, "без даты не считается прошедшим");
assert.equal(getEventPromoteBlockReason(ContentStatus.PUBLISHED), null, "состояние не передано — не блокируем");
assert.equal(getEventPromoteBlockReason(ContentStatus.PUBLISHED, "PAST"), "past");
assert.equal(getEventPromoteBlockReason(ContentStatus.DRAFT, "UPCOMING"), "not-published");
assert.equal(getEventPromoteBlockReason(ContentStatus.ARCHIVED, "UPCOMING"), "not-published");
assert.equal(getEventPromoteBlockReason(ContentStatus.ARCHIVED, "PAST"), "not-published", "неактивность приоритетнее");

console.log("canPromoteEvent.test: OK");
