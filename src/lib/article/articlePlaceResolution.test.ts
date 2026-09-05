import assert from "node:assert/strict";
import { DEFAULT_ARTICLE_PLACE_SECTIONS, type ArticleBlockMvp } from "@/lib/publications/articleMvp";
import type { ResolvedArticlePlace } from "@/lib/place/articlePlaceLiveData";
import { collectArticlePlaceIds, resolveArticlePlaceCard } from "./articlePlaceResolution";

const blocks: ArticleBlockMvp[] = [
  { id: "p1-a", type: "activityCard", entityType: "PLACE", entityId: " p1 " },
  { id: "event", type: "activityCard", entityType: "EVENT", entityId: "e1" },
  { id: "p2", type: "activityCard", entityType: "PLACE", entityId: "p2", placeSections: { ...DEFAULT_ARTICLE_PLACE_SECTIONS, image: false } },
  { id: "p1-b", type: "activityCard", entityType: "PLACE", entityId: "p1" },
  { id: "missing", type: "activityCard", entityType: "PLACE", entityId: "missing" },
];

assert.deepEqual(collectArticlePlaceIds(blocks), ["p1", "p2", "missing"], "one stable unique batch preserves first-reference order");

const place = (title: string): ResolvedArticlePlace => ({
  id: title, title, href: `/minsk/places/${title}`, imageUrl: null, description: null, address: null,
  contacts: { phones: [], socials: [] }, price: { mode: "UNKNOWN", currency: "BYN", min: null, max: null, items: [], note: "" }, openingHours: null,
});
const firstSource = new Map([["p1", place("old title")], ["p2", place("p2")]]);
const secondSource = new Map([["p1", place("new title")], ["p2", place("p2")]]);

const placeBlocks = blocks.filter((block): block is Extract<ArticleBlockMvp, { type: "activityCard" }> => block.type === "activityCard" && block.entityType === "PLACE");
assert.deepEqual(placeBlocks.map((block) => resolveArticlePlaceCard(block, firstSource)?.place.title ?? null), ["old title", "p2", "old title", null]);
assert.equal(resolveArticlePlaceCard(placeBlocks[0], firstSource)?.sections.events, false);
assert.equal(resolveArticlePlaceCard(placeBlocks[1], firstSource)?.sections.image, false);
assert.equal(resolveArticlePlaceCard(placeBlocks[0], secondSource)?.place.title, "new title", "Place source changes without rewriting Article block");

console.log("articlePlaceResolution.test.ts: OK");
