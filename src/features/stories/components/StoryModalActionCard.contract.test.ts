import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveStoryActions } from "../lib/story-actions";

const breakingActions = resolveStoryActions({
  id: "breaking-1",
  offerId: "breaking-1",
  type: "breaking-news",
  title: "Новость",
  image: "",
  href: "/blog/news",
});

assert.deepEqual(
  breakingActions.map((action) => action.label),
  ["Подробнее"],
  "Breaking News must use the short «Подробнее» CTA",
);

const cardSource = readFileSync(
  new URL("./StoryModalActionCard.tsx", import.meta.url),
  "utf8",
);
assert.match(
  cardSource,
  /item\.type === "breaking-news"[\s\S]*WebkitLineClamp:\s*10/,
  "Breaking News description must be clamped to 10 visible lines",
);
assert.match(
  cardSource,
  /renderCurrencyText\(item\.price,\s*\{\s*iconSize:\s*"storyPrice"\s*\}\)/,
  "Story price must use the story-specific aligned BYN icon size",
);

const iconSource = readFileSync(
  new URL("../../../components/icons/BelarusianRubleIcon.tsx", import.meta.url),
  "utf8",
);
assert.match(
  iconSource,
  /storyPrice:\s*\{\s*width:\s*"0\.69em",\s*height:\s*"0\.86em"/,
  "Story BYN glyph must keep the larger cap-height alignment contract",
);

console.log("StoryModalActionCard contract tests: OK");
