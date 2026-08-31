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
