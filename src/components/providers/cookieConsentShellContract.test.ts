/**
 * Source-inspection contract for the fast-first-paint cookie-consent shell
 * (CookieConsentShell + its wiring through CookieConsentProvider and
 * consent-manager.ts). Complements consent-cookie-format.test.ts (pure
 * cookie-parsing logic) and the pre-existing externalAnalyticsContract.test.ts
 * (GA4/Yandex gating, unaffected by this change).
 *
 * Run: pnpm exec tsx src/components/providers/cookieConsentShellContract.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function main() {
  const shell = source("src/components/providers/CookieConsentShell.tsx");
  const provider = source("src/components/providers/cookie-consent-provider.tsx");
  const manager = source("src/lib/cookies/consent-manager.ts");
  const config = source("src/lib/cookies/consent-config.ts");

  // --- 5. first-visit user gets an early-render consent UI ---
  assert.match(
    shell,
    /useState\(true\)/,
    "CookieConsentShell must default to mounted/visible on first render (no gating before paint) — the no-flash script + CSS hide the DOM for returning consented visitors instead",
  );
  assert.ok(
    !shell.includes("initialShouldShow") && !shell.includes("cookies()") && !shell.includes("headers()"),
    "the shell must not depend on a server-computed prop or Next dynamic APIs (cookies()/headers()) — that would opt every public route into per-request dynamic rendering just to decide first paint",
  );

  // --- 4. returning valid-consent user does not get the first-visit banner ---
  assert.ok(
    provider.includes("CookieConsentShell"),
    "CookieConsentProvider must mount CookieConsentShell",
  );
  const css = source("src/styles/cookie-consent-mamago.css");
  assert.match(
    css,
    /html\[data-cc-consent-known="1"\]\s*#mamago-cookie-shell\s*\{\s*display:\s*none\s*!important;\s*\}/,
    "cookie-consent-mamago.css must hide #mamago-cookie-shell once the no-flash script has marked <html>",
  );
  assert.match(shell, /id="mamago-cookie-shell"/);
  assert.match(
    shell,
    /hasValidConsentCookieValue\(readOwnCookieValue\(\)\)/,
    "shell must also re-check consent validity itself post-hydration (belt-and-suspenders tidy-unmount)",
  );

  const noFlashScript = source("src/lib/cookies/no-flash-cookie-shell-script.ts");
  assert.match(
    noFlashScript,
    /data-cc-consent-known/,
    "no-flash script must set the same attribute the CSS rule keys off",
  );
  const rootLayout = source("src/app/layout.tsx");
  assert.match(
    rootLayout,
    /dangerouslySetInnerHTML=\{\{\s*__html:\s*buildNoFlashCookieShellScript\(\)\s*\}\}/,
    "root layout must render the no-flash script as a render-blocking inline <script> (no async/defer/type=module)",
  );
  assert.ok(
    !/async|defer|type="module"/.test(rootLayout.slice(rootLayout.indexOf("buildNoFlashCookieShellScript") - 200, rootLayout.indexOf("buildNoFlashCookieShellScript") + 50)),
    "the no-flash <script> must stay render-blocking (no async/defer) — it must run before first paint",
  );
  assert.match(
    rootLayout,
    /suppressHydrationWarning/,
    "root <html> must suppress the expected one-attribute hydration diff caused by the no-flash script",
  );

  // --- 7. no duplicate banner during handoff ---
  assert.match(
    config,
    /autoShow:\s*false/,
    "autoShow must be false: ensureConsentModalShown() — not the library's own init — must own the show-decision so the shell can hand off deterministically",
  );
  assert.match(
    manager,
    /ensureShownPromise\s*=\s*initCookieConsent\(\)\.then/,
    "ensureConsentModalShown must be single-flight (memoized) so multiple mount points never trigger the library's show logic twice",
  );
  assert.match(
    shell,
    /rootRef\.current\.style\.display\s*=\s*"none"/,
    "shell must hide itself synchronously (not only via a later React re-render) when handing off, to avoid a frame where both the shell and the real modal are visible",
  );
  assert.match(
    provider,
    /ensureConsentModalShown\(\)/,
    "CookieConsentProvider must drive the show-decision via ensureConsentModalShown, not raw initCookieConsent",
  );

  // --- 9. init/provider failure stays fail-closed ---
  assert.match(
    shell,
    /ensureConsentModalShown\(\)\.then\(hideShell,\s*hideShell\)/,
    "shell must hide itself on ensureConsentModalShown() rejection too, and must not treat a failure as consent",
  );
  assert.ok(
    !/[^.]acceptCategory\(/.test(shell) && !shell.includes("localStorage") && !shell.includes("document.cookie ="),
    "the shell itself must never call acceptCategory or write consent/cookies directly — only acceptFromShell (via the real library) may",
  );

  // --- fail-closed accept flow: buttons must go through the real library, never
  //     set local 'accepted' state before it resolves ---
  assert.match(
    manager,
    /export async function acceptFromShell\(categories: "all" \| \[\]\): Promise<void> \{\s*\n\s*await ensureConsentModalShown\(\);\s*\n\s*const \{ acceptCategory, hide \} = await import\("vanilla-cookieconsent"\);\s*\n\s*acceptCategory\(categories\);\s*\n\s*hide\(\);/,
    "acceptFromShell must await the real library before calling its acceptCategory/hide — never record consent itself",
  );
  assert.match(shell, /await acceptFromShell\(categories\)/);
  assert.match(shell, /handleAccept\(\s*"all"\s*\)/);
  assert.match(shell, /handleAccept\(\s*\[\]\s*\)/);

  // --- 6. preferences modal continues to work from the shell ---
  assert.match(
    shell,
    /openCookiePreferences\(\)/,
    "the shell's 'Настроить' button must reuse the existing openCookiePreferences (footer link) path, not a second implementation",
  );

  // --- texts sourced from the single canonical BANNER export, not re-typed ---
  assert.match(config, /export const BANNER = \{/);
  assert.match(shell, /import \{ BANNER \} from "@\/lib\/cookies\/consent-config"/);
  for (const key of ["title", "description", "acceptAll", "necessaryOnly", "customize"]) {
    assert.ok(
      shell.includes(`BANNER.${key}`),
      `CookieConsentShell must render BANNER.${key} instead of a duplicated string`,
    );
  }

  console.log("cookieConsentShellContract.test.ts: OK");
}

main();
