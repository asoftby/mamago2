import assert from "node:assert";
import {
  articleBlockHtmlForPublic,
  sanitizeArticleBlockHtml,
  sanitizeHtmlAllowlist,
} from "./articleBlockHtml";

const TEXT_TAGS = ["p", "br", "strong", "b", "em", "i", "ul", "ol", "li", "a"];
const TEXT_ATTRS = ["href", "target", "rel", "class"];

// 1. <script>alert(1)</script> is removed
const r1 = sanitizeHtmlAllowlist("<script>alert(1)</script>", TEXT_TAGS, TEXT_ATTRS);
assert.strictEqual(r1, "");
console.log("OK 1: script tag removed");

// 2. <img src=x onerror=alert(1)> is removed (img not in allowlist)
const r2 = sanitizeHtmlAllowlist("<img src=x onerror=alert(1)>", TEXT_TAGS, TEXT_ATTRS);
assert.strictEqual(r2, "");
console.log("OK 2: img tag removed");

// 3. <a href="javascript:alert(1)">x</a> - href is stripped
const r3 = sanitizeHtmlAllowlist("<a href=\"javascript:alert(1)\">x</a>", TEXT_TAGS, TEXT_ATTRS);
assert.ok(!r3.includes("javascript:alert"), "javascript: href removed");
assert.ok(r3.includes("x"), "link text preserved");
console.log("OK 3: javascript: href stripped");

// 4. <a href="https://example.com">link</a> - normal link preserved
const r4 = sanitizeHtmlAllowlist("<a href=\"https://example.com\">link</a>", TEXT_TAGS, TEXT_ATTRS);
assert.ok(r4.includes("https://example.com"), "https href preserved");
assert.ok(r4.includes("link"), "link text preserved");
console.log("OK 4: normal https link preserved");

// 5. target="_blank" gets rel="noopener noreferrer"
const r5 = sanitizeHtmlAllowlist("<a href=\"https://x.com\" target=\"_blank\">x</a>", TEXT_TAGS, TEXT_ATTRS);
assert.ok(r5.includes("rel=\"noopener noreferrer\""), "rel=noopener noreferrer added");
assert.ok(r5.includes("target=\"_blank\""), "target=_blank preserved");
console.log("OK 5: target=_blank gets safe rel");

// 6. <p><strong>bold</strong> and <em>italic</em></p> preserved
const r6 = sanitizeHtmlAllowlist("<p><strong>bold</strong> and <em>italic</em></p>", TEXT_TAGS, TEXT_ATTRS);
assert.ok(r6.includes("<strong>bold</strong>"), "strong preserved");
assert.ok(r6.includes("<em>italic</em>"), "em preserved");
assert.ok(r6.includes("<p>"), "p preserved");
console.log("OK 6: formatted text preserved");

// 7. style attribute is stripped
const r7 = sanitizeHtmlAllowlist("<p style=\"color:red\">text</p>", TEXT_TAGS, TEXT_ATTRS);
assert.ok(!r7.includes("style="), "style attribute stripped");
assert.ok(r7.includes("text"), "text preserved");
console.log("OK 7: style attribute stripped");

// 8. onclick event handler is stripped
const r8 = sanitizeHtmlAllowlist("<a href=\"https://x.com\" onclick=\"alert(1)\">x</a>", TEXT_TAGS, TEXT_ATTRS);
assert.ok(!r8.includes("onclick"), "onclick stripped");
console.log("OK 8: onclick stripped");

// 9. data: URI in href is stripped
const r9 = sanitizeHtmlAllowlist("<a href=\"data:text/html,alert(1)\">x</a>", TEXT_TAGS, TEXT_ATTRS);
assert.ok(!r9.includes("data:"), "data: href stripped");
console.log("OK 9: data: href stripped");

// 10. mailto: link is preserved
const r10 = sanitizeHtmlAllowlist("<a href=\"mailto:test@example.com\">email</a>", TEXT_TAGS, TEXT_ATTRS);
assert.ok(r10.includes("mailto:test@example.com"), "mailto href preserved");
console.log("OK 10: mailto link preserved");

// 11. tel: link is preserved
const r11 = sanitizeHtmlAllowlist("<a href=\"tel:+1234567890\">call</a>", TEXT_TAGS, TEXT_ATTRS);
assert.ok(r11.includes("tel:+1234567890"), "tel href preserved");
console.log("OK 11: tel link preserved");

// 12. Existing rel is replaced for target=_blank
const r12 = sanitizeHtmlAllowlist("<a href=\"https://x.com\" target=\"_blank\" rel=\"nofollow\">x</a>", TEXT_TAGS, TEXT_ATTRS);
assert.ok(r12.includes("rel=\"noopener noreferrer\""), "existing rel replaced with noopener noreferrer");
assert.ok(!r12.includes("nofollow"), "old rel removed");
console.log("OK 12: existing rel replaced for target=_blank");

// 13. class attribute is preserved when allowed
const r13 = sanitizeHtmlAllowlist("<p class=\"my-class\">text</p>", TEXT_TAGS, TEXT_ATTRS);
assert.ok(r13.includes("class=\"my-class\""), "class attribute preserved");
console.log("OK 13: class attribute preserved");

// 14. Disallowed tags (div, iframe) are removed
const r14 = sanitizeHtmlAllowlist("<div>content</div><iframe src=\"https://evil.com\"></iframe>", TEXT_TAGS, TEXT_ATTRS);
assert.ok(!r14.includes("<div>"), "div removed");
assert.ok(!r14.includes("iframe"), "iframe removed");
assert.ok(r14.includes("content"), "text content preserved");
console.log("OK 14: disallowed tags removed");

// 15. Lead/intro preserves the same rich formatting as a regular text block
const introRichHtml = sanitizeArticleBlockHtml(
  '<p><strong>Лид</strong> <a href="/blog/example">ссылка</a></p><ul><li>Пункт</li></ul><div data-type="quote-block"><p>Цитата</p></div>',
  "intro",
);
assert.ok(introRichHtml.includes("<strong>Лид</strong>"), "intro bold preserved");
assert.ok(introRichHtml.includes('<a href="/blog/example">ссылка</a>'), "intro link preserved");
assert.ok(introRichHtml.includes("<ul><li>Пункт</li></ul>"), "intro list preserved");
assert.ok(introRichHtml.includes('data-type="quote-block"'), "intro quote block preserved");
console.log("OK 15: intro preserves rich-text formatting");

// 16. Inline quote from the lead renders the same way as in a text block
const introPublicHtml = articleBlockHtmlForPublic(
  '<div data-type="quote-block"><p>Цитата в лиде</p></div>',
  "intro",
);
assert.ok(introPublicHtml.includes("<blockquote"), "intro quote rendered as blockquote");
assert.ok(!introPublicHtml.includes('data-type="quote-block"'), "editor quote node removed from public HTML");
console.log("OK 16: intro quote renders for public article");

// 17. <code> (footnote/small monospace mark) survives sanitization for a
// text block, both at save time and when re-rendered for the public page.
const codeSaved = sanitizeArticleBlockHtml("<p>Обычный текст <code>сноска</code> дальше</p>", "text");
assert.ok(codeSaved.includes("<code>сноска</code>"), "code mark preserved on save");
const codePublic = articleBlockHtmlForPublic(codeSaved, "text");
assert.ok(codePublic.includes("<code>сноска</code>"), "code mark preserved for public render");
console.log("OK 17: code (footnote) mark survives text-block sanitization");

// 18. <code> is stripped from intro (dek) HTML — the editor never offers the
// toggle there, and older/imported intro content shouldn't leak it through
// to the public header, which has no matching styling for it.
const introCodeStripped = sanitizeArticleBlockHtml("<p>Лид <code>сноска</code> текст</p>", "intro");
assert.ok(!introCodeStripped.includes("<code>"), "code tag stripped from intro");
assert.ok(introCodeStripped.includes("сноска"), "inner text kept even though the tag is stripped");
console.log("OK 18: code mark stripped from intro (dek) HTML");

// 19. Browser-decoded and normalized executable URL schemes are removed.
const maliciousHrefPayloads = [
  "javascript:alert(1)",
  "JaVaScRiPt:alert(1)",
  "jav&#x61;script:alert(1)",
  "jav&#97;script:alert(1)",
  "&#106avascript:alert(1)",
  "java&colon;script:alert(1)",
  "j&#x61;v&#x61;script&#x3a;alert(1)",
  "javasc&#114;ipt&#58;alert(1)",
  "java\nscript:alert(1)",
  "java\rscript:alert(1)",
  "java\tscript:alert(1)",
  "java\fscript:alert(1)",
  "java&#x0a;script:alert(1)",
  "j&#x09;avascript:alert(1)",
  "java&#x0c;script:alert(1)",
  "java&#13;script:alert(1)",
  " \u0000javascript:alert(1)",
  "\u0001javascript:alert(1)",
  "data:text/html,<script>alert(1)</script>",
  "vbscript:msgbox(1)",
  "file:///etc/passwd",
];

for (const payload of maliciousHrefPayloads) {
  const sanitized = sanitizeHtmlAllowlist(
    `<a href="${payload}">payload</a>`,
    TEXT_TAGS,
    TEXT_ATTRS,
  );
  assert.strictEqual(sanitized, "<a>payload</a>", `dangerous href removed: ${payload}`);
}
console.log("OK 19: encoded, mixed-case and control-character URL schemes stripped");

// 20. Every supported URL-bearing attribute goes through the same scheme check.
const urlAttributeCases = [
  { tag: "a", attr: "href" },
  { tag: "img", attr: "src" },
  { tag: "form", attr: "action" },
  { tag: "button", attr: "formaction" },
  { tag: "a", attr: "xlink:href" },
];
for (const { tag, attr } of urlAttributeCases) {
  const sanitized = sanitizeHtmlAllowlist(
    `<${tag} ${attr}="jav&#x61;script:alert(1)">payload</${tag}>`,
    [tag],
    [attr],
  );
  assert.ok(!sanitized.includes(`${attr}=`), `${attr} dangerous scheme removed`);
}
console.log("OK 20: all URL-bearing attributes use canonical scheme validation");

// 21. Product-supported schemes and internal relative links remain intact.
const safeHrefs = [
  "https://mamago.by/minsk/events",
  "https://example.com/path?q=1",
  "http://example.com/path",
  "mailto:test@example.com",
  "tel:+375291112233",
  "/minsk/kuda",
  "#section",
];
for (const href of safeHrefs) {
  const sanitized = sanitizeHtmlAllowlist(
    `<a href="${href}">safe</a>`,
    TEXT_TAGS,
    TEXT_ATTRS,
  );
  assert.ok(sanitized.includes(`href="${href}"`), `safe href preserved: ${href}`);
}
console.log("OK 21: safe absolute and relative links preserved");

// 22. Protocol-relative URLs are intentionally rejected instead of silently
// inheriting http/https and leaving the allowlist ambiguous.
const protocolRelative = sanitizeHtmlAllowlist(
  '<a href="//evil.example/payload">payload</a>',
  TEXT_TAGS,
  TEXT_ATTRS,
);
assert.strictEqual(protocolRelative, "<a>payload</a>", "protocol-relative href removed");
console.log("OK 22: protocol-relative href stripped");

// 23. A doubly encoded entity is not recursively decoded by an HTML parser and
// therefore cannot become an executable scheme during this single render.
const doubleEncoded = sanitizeHtmlAllowlist(
  '<a href="&amp;#x6a;avascript:alert(1)">payload</a>',
  TEXT_TAGS,
  TEXT_ATTRS,
);
assert.ok(!doubleEncoded.includes('href="javascript:'), "double encoding never emitted as executable href");
assert.ok(doubleEncoded.includes("&amp;#x6a;avascript"), "non-recursive entity stays inert text");
console.log("OK 23: double-encoded entity remains non-executable");

// 24. Malformed quoting is parsed as HTML before validation; it cannot smuggle
// an event handler or a second executable URL attribute into the result.
const malformed = sanitizeHtmlAllowlist(
  '<a href="https://mamago.by/"onclick="alert(1)" href="javascript:alert(2)">payload</a>',
  TEXT_TAGS,
  TEXT_ATTRS,
);
assert.ok(!malformed.includes("onclick"), "malformed event handler stripped");
assert.ok(!malformed.toLowerCase().includes("javascript:"), "duplicate dangerous href stripped");
console.log("OK 24: malformed and duplicate attributes cannot bypass parsing");

console.log("");
console.log("All articleBlockHtml sanitizer tests passed!");
