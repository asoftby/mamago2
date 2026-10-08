import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const similar = readFileSync(new URL("./SimilarEventsSection.tsx", import.meta.url), "utf8");
const card = readFileSync(new URL("../events/EventCard.tsx", import.meta.url), "utf8");

test("related events reuse the canonical home/discovery card and save action", () => {
  assert.match(similar, /import \{ EventCard \} from "@\/components\/events\/EventCard"/);
  assert.match(similar, /<EventCard/);
  assert.match(similar, /saveMeta=\{\{\}\}/);
  assert.match(card, /<SaveHeart/);
  assert.doesNotMatch(similar, /<img|<Image|renderCurrencyText|normalizeUiCurrencyText/);
});

test("related events share category, date and price presentation props", () => {
  assert.match(similar, /categoryLabel=\{ev\.categoryLabel\}/);
  assert.match(similar, /metaLabel=\{/);
  assert.match(similar, /priceLabel=\{ev\.priceLabel\}/);
});
