/**
 * Regression coverage for SeoPanel's canonical-URL origin independence.
 *
 * Bug: `normalizedPublicUrl` used to rebase the already-canonical `publicUrl`
 * prop (built by the caller from resolveSeoPublicBase()/NEXT_PUBLIC_APP_URL —
 * the same fixed origin the server's syncArticleCanonical()/absoluteBase()
 * persists) onto `window.location.origin` via sameOriginUrl() once hydrated.
 * That meant the canonical URL written into form state depended on whatever
 * origin the admin happened to be browsing the editor from (admin.*
 * subdomain, a dev port, …), which never matched what the server actually
 * saves — keeping `dirty` stuck `true` again right after every save.
 *
 * Fix: `normalizedPublicUrl` is now a pure trim of the `publicUrl` prop, with
 * no origin dependency at all.
 *
 * HONEST LIMITATION: this repo's test harness has no jsdom/RTL, only
 * `renderToStaticMarkup` (server-side, never hydrates). The actual bug only
 * manifested post-hydration, inside `useEffect`s gated on `hydrated`, which
 * never run under SSR — so this test passes identically on the old buggy
 * code and the fixed code; it does NOT discriminate between them and must
 * not be read as proof the effect-level bug is fixed. It only documents/
 * guards the static invariant that the computation stays a pure function of
 * `publicUrl`. The actual regression coverage for the effect-level bug is
 * the live browser verification (edit → save → reload → dirty stays false),
 * not this file.
 *
 * Run: npx tsx src/features/admin/seo/components/SeoPanel.test.tsx
 */
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { SeoPanel } from "./SeoPanel";

function render(publicUrl: string): string {
  return renderToStaticMarkup(
    <SeoPanel
      seoTitle=""
      seoDescription=""
      canonicalUrl=""
      noindex={false}
      publicUrl={publicUrl}
      onSeoTitleChange={() => {}}
      onSeoDescriptionChange={() => {}}
      onCanonicalUrlChange={() => {}}
      onNoindexChange={() => {}}
    />,
  );
}

// ── The canonical-URL placeholder must equal the publicUrl prop verbatim —
// no rebasing onto any other origin, since SSR never hydrates. ────────────
{
  const canonicalUrl = "http://mamago.local:3000/minsk/blog/some-article-slug";
  const html = render(canonicalUrl);
  assert.ok(
    html.includes(`placeholder="${canonicalUrl}"`),
    `expected canonical-URL input placeholder to equal the publicUrl prop verbatim (${canonicalUrl}), got: ${html.match(/id="seo-canonical"[^>]*/)?.[0]}`,
  );
}

// ── A publicUrl on a completely different (e.g. production) origin from
// this one must render identically shaped — proving the derivation has no
// dependency on any "current" origin at all. ──────────────────────────────
{
  const canonicalUrl = "https://mamago.by/minsk/blog/some-article-slug";
  const html = render(canonicalUrl);
  assert.ok(
    html.includes(`placeholder="${canonicalUrl}"`),
    "canonical-URL placeholder must reflect the publicUrl prop's own origin (mamago.by), not be rebased onto anything else",
  );
}

console.log("SeoPanel.test.tsx: all assertions passed");
