import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const shell = source("src/components/providers/CookieConsentShell.tsx");
const provider = source("src/components/providers/cookie-consent-provider.tsx");
const manager = source("src/lib/cookies/consent-manager.ts");
const config = source("src/lib/cookies/consent-config.ts");
const css = source("src/styles/cookie-consent-mamago.css");
const rootLayout = source("src/app/layout.tsx");
const noFlashScript = source("src/lib/cookies/no-flash-cookie-shell-script.ts");

assert.match(shell, /useState\(true\)/);
assert.ok(!shell.includes("cookies()") && !shell.includes("headers()"));
assert.match(shell, /id="mamago-cookie-shell"/);
assert.match(shell, /hasValidConsentCookieValue\(readOwnCookieValue\(\)\)/);
assert.match(shell, /rootRef\.current\.style\.display\s*=\s*"none"/);
assert.match(shell, /ensureConsentModalShown\(\)\.then\(hideShell,\s*hideShell\)/);
assert.match(shell, /await acceptFromShell\(categories\)/);
assert.match(shell, /handleAccept\(\s*"all"\s*\)/);
assert.match(shell, /handleAccept\(\s*\[\]\s*\)/);
assert.match(shell, /openCookiePreferences\(\)/);
assert.match(shell, /import \{ BANNER \} from "@\/lib\/cookies\/consent-config"/);

assert.match(provider, /CookieConsentShell/);
assert.match(provider, /ensureConsentModalShown\(\)/);
assert.match(config, /export const BANNER = \{/);
assert.match(config, /autoShow:\s*false/);
assert.match(config, /name:\s*CONSENT_COOKIE_NAME/);
assert.match(manager, /ensureShownPromise\s*=\s*initCookieConsent\(\)\.then/);
assert.match(manager, /export async function acceptFromShell/);
assert.match(css, /html\[data-cc-consent-known="1"\]\s*#mamago-cookie-shell\s*\{\s*display:\s*none\s*!important;\s*\}/);
assert.match(noFlashScript, /data-cc-consent-known/);
assert.match(
  rootLayout,
  /dangerouslySetInnerHTML=\{\{\s*__html:\s*buildNoFlashCookieShellScript\(\)\s*\}\}/,
);
assert.match(rootLayout, /suppressHydrationWarning/);

console.log("cookieConsentShellContract.test.ts: OK");
