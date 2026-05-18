import assert from "node:assert";
import { sanitizeHtmlAllowlist } from "./articleBlockHtml";

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

console.log("");
console.log("All articleBlockHtml sanitizer tests passed!");