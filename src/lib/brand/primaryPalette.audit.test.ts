import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve("src");
const exceptions = [
  "app/globals.css", // canonical brand hex values and global tokens
  "features/email/", // HTML emails require inline hex, not CSS variables
  "features/email-studio/server/", // HTML emails require inline hex
  "lib/email/", // legacy plain HTML email markup
  "components/email/",
];
const legacyHex = /#(?:EF8759|E86A3A|C24E22)\b/gi;
const files: string[] = [];
function visit(directory: string) {
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, item.name);
    if (item.isDirectory()) visit(full);
    else if (/\.(tsx?|css|scss)$/.test(item.name) && !/\.test\./.test(item.name)) {
      const relative = path.relative(root, full).replace(/\\/g, "/");
      if (exceptions.some((entry) => relative === entry || relative.startsWith(entry))) continue;
      if (legacyHex.test(readFileSync(full, "utf8"))) files.push(relative);
      legacyHex.lastIndex = 0;
    }
  }
}
visit(root);
assert.deepEqual(files, [], `Use semantic primary tokens instead of legacy orange literals: ${files.join(", ")}`);
console.log("primaryPalette.audit.test: OK");
