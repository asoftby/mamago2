import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// --- Root viewport must not disable pinch-zoom (Lighthouse a11y: "user-scalable").
// Reads the source directly (no Next/React runtime needed) so this stays a
// fast, dependency-free regression guard. ---

const source = fs.readFileSync(path.join(__dirname, "layout.tsx"), "utf8");

assert.ok(!/maximumScale/.test(source), "viewport must not set maximumScale");
assert.ok(!/userScalable/.test(source), "viewport must not set userScalable");
assert.ok(/width:\s*"device-width"/.test(source), "viewport must keep width: device-width");
assert.ok(/initialScale:\s*1/.test(source), "viewport must keep initialScale: 1");

console.log("viewport zoom test: OK");

// iOS Safari focus zoom: even forms with inline font-size below 16px must be
// guarded on mobile, while manual pinch zoom stays available.
const globalStyles = fs.readFileSync(path.join(__dirname, "globals.css"), "utf8");
const mobileInputRule = globalStyles.match(/@media\s*\(max-width:\s*767px\)\s*\{([\s\S]*?)\n\}/);
assert.ok(mobileInputRule, "mobile form controls must have a dedicated font-size rule");
for (const control of ["input:not", "textarea", "select"]) {
  assert.ok(mobileInputRule[1].includes(control), `mobile zoom guard must cover ${control}`);
}
assert.match(mobileInputRule[1], /font-size:\s*16px\s*!important\s*;/,
  "mobile form font size must override local CSS and inline fontSize below 16px");
