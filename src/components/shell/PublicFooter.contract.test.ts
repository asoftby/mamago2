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

// Column heading/link palette is deliberately inverted from the previous footer.
assert.match(footerSource, /const FOOTER_HEADING_CLASS =\s*"text-\[14px\] font-normal text-\[#3A332B\]"/, "Section titles use the former dark link color");
assert.match(footerSource, /const FOOTER_LINK_CLASS =[\s\S]*?text-\[14px\][\s\S]*?text-\[rgba\(20,18,16,0\.6\)\]/, "Footer links use 14px and the muted gray heading palette at accessible contrast");
assert.match(footerSource, /hover:text-primary hover:no-underline/, "Footer links change to primary without underline on hover");
// The original 50%-opacity headings were ~3.43:1 on the warm footer background.
// Links are actionable 14px text, so ensure at least WCAG AA's 4.5:1 contrast.
const alpha = Number(footerSource.match(/text-\[rgba\(20,18,16,(0\.\d+)\)\]/)?.[1]);
const foreground = [20, 18, 16];
const background = [0xF6, 0xF2, 0xEA];
const blended = foreground.map((value, index) => alpha * value + (1 - alpha) * background[index]!);
function luminance(rgb: number[]) {
  const channels = rgb.map((value) => {
    const srgb = value / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}
assert.ok(
  (luminance(background) + 0.05) / (luminance(blended) + 0.05) >= 4.5,
  "Footer links remain readable at WCAG AA normal-text contrast on the warm footer background",
);

assert.doesNotMatch(footerSource, /hover:underline(?:\s|\b)/, "Footer links do not underline on hover");

assert.match(
  footerSource,
  /<CookieSettingsFooterLink[^>]*\/>/,
  "Footer keeps a text trigger («Настройки cookies») for reopening the cookie preferences modal",
);

assert.doesNotMatch(
  footerSource,
  /Настройки cookies/,
  "Cookie-settings label lives in CookieSettingsFooterLink, not hard-coded in the footer",
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
