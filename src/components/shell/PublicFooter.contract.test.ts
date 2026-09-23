import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const footerSource = readFileSync(new URL("./PublicFooter.tsx", import.meta.url), "utf8");
const navSource = readFileSync(new URL("./FooterPrimaryNavigation.tsx", import.meta.url), "utf8");

assert.doesNotMatch(
  footerSource,
  /FooterJournalLink/,
  "Journal must not be rendered inside the Project footer column",
);

assert.match(
  navSource,
  /index > 0[\s\S]*border-l[\s\S]*pl-3/,
  "Bottom footer sections must have a visible vertical separator between items",
);

assert.doesNotMatch(
  navSource,
  /hidden opacity-70 min-\[769px\]:inline/,
  "Footer separators must not be hidden on smaller layouts",
);

console.log("PublicFooter contract tests: OK");
