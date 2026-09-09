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
assert.match(shell, /await acceptFromShell\(categories\)/);
assert.match(shell, /await acceptFromShell\(categories\);[\s\S]*setMounted\(false\)/);
assert.match(shell, /catch \(err\) \{[\s\S]*accept failed[\s\S]*\} finally \{[\s\S]*setPending\(false\)/);
assert.match(shell, /handleAccept\(\s*"all"\s*\)/);
assert.match(shell, /handleAccept\(\s*\[\]\s*\)/);
assert.match(shell, /await openCookiePreferencesFromShell\(\);[\s\S]*setPreferencesOpen\(true\)/);
assert.match(shell, /new MutationObserver\(handlePreferencesState\)/);
assert.match(shell, /classList\.contains\("show--preferences"\)/);
assert.match(shell, /rootRef\.current\.style\.display\s*=\s*""/);
assert.match(shell, /navigator\.webdriver/);
assert.match(shell, /bot\|crawl\|spider\|slurp\|teoma/);
assert.match(shell, /catch \(err\)[\s\S]*setPending\(false\)/);
assert.match(shell, /import \{ BANNER \} from "@\/lib\/cookies\/consent-config"/);

assert.match(provider, /CookieConsentShell/);
assert.match(provider, /initCookieConsent\(\)/);
assert.ok(!provider.includes("ensureConsentModalShown"));
assert.match(config, /export const BANNER = \{/);
assert.match(config, /autoShow:\s*false/);
assert.match(config, /hideFromBots:\s*true/);
assert.match(config, /name:\s*CONSENT_COOKIE_NAME/);
assert.match(manager, /export async function acceptFromShell/);
assert.match(manager, /await initCookieConsent\(\);[\s\S]*CC\.acceptCategory\(categories\)/);
assert.match(manager, /\.catch\(\(err\) => \{\s*initPromise = null;\s*throw err;/);
assert.match(manager, /export async function openCookiePreferencesFromShell/);
assert.match(manager, /showPreferences\(\);[\s\S]*requestAnimationFrame/);
assert.match(manager, /classList\.contains\("show--preferences"\)/);
assert.ok(!manager.includes("show(true)"));
assert.ok(!manager.includes("ensureConsentModalShown"));
assert.match(css, /html\[data-cc-consent-known="1"\]\s*#mamago-cookie-shell\s*\{\s*display:\s*none\s*!important;\s*\}/);
assert.match(noFlashScript, /data-cc-consent-known/);
assert.match(
  rootLayout,
  /dangerouslySetInnerHTML=\{\{\s*__html:\s*buildNoFlashCookieShellScript\(\)\s*\}\}/,
);
assert.match(rootLayout, /suppressHydrationWarning/);

console.log("cookieConsentShellContract.test.ts: OK");
