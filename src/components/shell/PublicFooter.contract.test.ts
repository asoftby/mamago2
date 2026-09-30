import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const footerSource = readFileSync(new URL("./PublicFooter.tsx", import.meta.url), "utf8");
const navSource = readFileSync(new URL("./FooterPrimaryNavigation.tsx", import.meta.url), "utf8");
const globalsSource = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");

assert.doesNotMatch(
  footerSource,
  /FooterJournalLink/,
  "Journal must not be rendered inside the Project footer column",
);

assert.match(
  footerSource,
  /<CookieSettingsFooterLink iconOnly \/>/,
  "Footer keeps an icon-only trigger for reopening the cookie preferences modal",
);

assert.doesNotMatch(
  footerSource,
  /Настройки cookies/,
  "Public footer must not render visible cookie-settings text",
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


assert.match(
  globalsSource,
  /#cc-main\s*\{[\s\S]*?display:\s*none\s*!important;/,
  "Generated cookie-consent root must stay hidden outside the modal",
);

assert.match(
  globalsSource,
  /html\.show--preferences #cc-main\s*\{[\s\S]*?display:\s*block\s*!important;/,
  "Cookie preferences root may become visible only for the explicit preferences modal",
);

console.log("PublicFooter contract tests: OK");
