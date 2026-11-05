import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SoftAudienceNotice } from "./SoftAudienceNotice";

test("alternative notice is a single poster card that introduces content to the right", () => {
  const html = renderToStaticMarkup(<SoftAudienceNotice label="занятия" />);
  assert.match(html, /aspect-\[2\/3\]/);
  assert.match(html, /Справа — другие занятия/);
  assert.match(html, /lucide-arrow-right/);
  assert.doesNotMatch(html, /mb-4 rounded-xl border border-neutral-200 bg-neutral-50/);
});

test("masonry notice occupies one full grid cell without carousel width", () => {
  const html = renderToStaticMarkup(<SoftAudienceNotice inGrid label="события" />);
  assert.match(html, /w-full/);
  assert.doesNotMatch(html, /snap-start/);
});

test("empty class and birthday cards expose a contextual catalog link", () => {
  for (const [href, label] of [["/minsk/classes", "Занятия"], ["/minsk/birthday", "Праздник"]]) {
    const html = renderToStaticMarkup(<SoftAudienceNotice noAlternatives actionHref={href} actionLabel={label} />);
    assert.match(html, /По вашему запросу мы ничего не нашли/);
    assert.match(html, /Попробуйте другие варианты/);
    assert.ok(html.includes(`href="${href}"`));
    assert.ok(html.includes(label));
    assert.match(html, /lucide-arrow-right/);
    assert.match(html, /aspect-\[2\/3\]/);
  }
});
