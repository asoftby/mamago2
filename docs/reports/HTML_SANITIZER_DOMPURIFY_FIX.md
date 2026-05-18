# HTML Sanitizer: DOMPurify Migration

## Summary

Replaced the custom regex-based HTML sanitizer (`sanitizeHtmlAllowlist`) in `src/lib/article/articleBlockHtml.ts` with `isomorphic-dompurify` (DOMPurify + jsdom).

## Motivation

The previous implementation used hand-written regex to parse and filter HTML tags/attributes. Regex-based HTML sanitization is inherently fragile — it can be bypassed by malformed HTML, nested edge cases, or encoding tricks. DOMPurify is a battle-tested, industry-standard HTML sanitizer used by major projects (GitHub, Slack, etc.).

## Changes

### `src/lib/article/articleBlockHtml.ts`

- **Removed**: Custom regex-based `sanitizeHtmlAllowlist()` implementation with manual tag/attribute filtering, `javascript:`/`data:` protocol blocking, and `on*` event handler removal.
- **Added**: `import DOMPurify from "isomorphic-dompurify"` — the isomorphic version works on both server (via jsdom) and client.
- **Replaced**: `sanitizeHtmlAllowlist()` now delegates to `DOMPurify.sanitize()` with:
  - `ALLOWED_TAGS` — explicit allowlist (p, br, strong, b, em, i, u, s, ul, ol, li, h2, h3, h4, blockquote, a, span)
  - `ALLOWED_ATTR` — explicit allowlist (href, target, rel, class)
  - `ALLOW_DATA_ATTR: true` — preserves `data-*` attributes (e.g., `data-sponsored`)
  - `ALLOW_UNKNOWN_PROTOCOLS: false` — blocks dangerous protocols (javascript:, data:, vbscript:)
- **Added**: Post-DOMPurify regex to guarantee `rel="noopener noreferrer"` for any `<a target="_blank">` (replaces any existing `rel` value).

### `src/lib/article/articleBlockHtml.test.ts` (new)

Added 14 test cases covering:

| # | Test | Expected |
|---|------|----------|
| 1 | `<script>alert(1)</script>` | Fully removed |
| 2 | `<img src=x onerror=alert(1)>` | Fully removed (img not in allowlist) |
| 3 | `<a href="javascript:alert(1)">x</a>` | href stripped, text preserved |
| 4 | `<a href="https://example.com">link</a>` | Fully preserved |
| 5 | `<a href="https://x.com" target="_blank">x</a>` | `rel="noopener noreferrer"` added |
| 6 | `<p><strong>bold</strong> and <em>italic</em></p>` | Fully preserved |
| 7 | `<p style="color:red">text</p>` | style attribute stripped |
| 8 | `<a onclick="alert(1)">x</a>` | onclick stripped |
| 9 | `<a href="data:text/html,alert(1)">x</a>` | data: href stripped |
| 10 | `<a href="mailto:test@example.com">email</a>` | mailto preserved |
| 11 | `<a href="tel:+1234567890">call</a>` | tel preserved |
| 12 | `<a target="_blank" rel="nofollow">x</a>` | rel replaced with noopener noreferrer |
| 13 | `<p class="my-class">text</p>` | class preserved |
| 14 | `<div>content</div><iframe src="..."></iframe>` | div/iframe removed, text preserved |

## Security Properties

- **XSS prevention**: DOMPurify removes all script execution vectors (inline scripts, event handlers, javascript: URLs, data: URLs)
- **Protocol restriction**: Only http, https, mailto, tel are allowed for `href`
- **Tag allowlist**: Only semantic text tags are allowed (no script, style, iframe, object, embed, form, input, button)
- **Attribute allowlist**: Only href, target, rel, class, and data-* attributes are allowed
- **Safe links**: `target="_blank"` always gets `rel="noopener noreferrer"`

## Backward Compatibility

- Public API unchanged: `sanitizeHtmlAllowlist(html, allowedTags, allowedAttrs): string`
- All existing callers (including `articleEmbedSanitize.ts`) continue to work
- The `articleBlockHtmlForEditor()` and `sanitizeArticleBlockHtml()` functions are unchanged
- The `articleBlockTextLooksLikeHtml()` and `legacyPlainTextToEditorHtml()` helpers are unchanged

## Verification

- ✅ All 14 new sanitizer tests pass
- ✅ Existing `articleEmbedSanitize.test.ts` passes
- ✅ ESLint passes on modified files
- ✅ TypeScript compilation passes (no new type errors)
- ✅ Pre-existing type errors (unrelated to this change) remain unchanged

## Dependencies

- `isomorphic-dompurify@3.7.1` — already present in `package.json` dependencies
