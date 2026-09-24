import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const fontsSource = readFileSync(join(root, "src/lib/fonts.ts"), "utf8");
const layoutSource = readFileSync(join(root, "src/app/layout.tsx"), "utf8");

for (const [face, weight] of [
  ["Regular", "400"],
  ["Medium", "500"],
  ["SemiBold", "600"],
  ["Bold", "700"],
] as const) {
  const relativePath = `public/fonts/GoogleSans/GoogleSans-${face}.woff2`;
  const absolutePath = join(root, relativePath);

  assert.ok(existsSync(absolutePath), `${relativePath} must exist`);
  assert.ok(statSync(absolutePath).size < 200_000, `${relativePath} must remain a web-sized subset`);
  assert.ok(fontsSource.includes(`GoogleSans-${face}.woff2`), `${face} must be registered`);
  assert.match(
    fontsSource,
    new RegExp(`GoogleSans-${face}\\.woff2"[\\s\\S]*?weight: "${weight}"[\\s\\S]*?style: "normal"`),
    `${face} must be registered as normal ${weight}`,
  );
}

assert.ok(fontsSource.includes('variable: "--font-google-sans"'));
assert.ok(fontsSource.includes('variable: "--font-ntsomic"'));
assert.ok(layoutSource.includes('"--font-sans"'));
assert.ok(layoutSource.includes("var(--font-google-sans), var(--font-ntsomic)"));
assert.ok(!layoutSource.includes("fonts.googleapis.com"));
assert.ok(!layoutSource.includes("fonts.gstatic.com"));
assert.ok(!existsSync(join(root, "src/lib/fontsRuntime.ts")));
assert.ok(!existsSync(join(root, "src/lib/fontsRuntime.test.ts")));
assert.match(
  readFileSync(join(root, "public/fonts/GoogleSans/OFL.txt"), "utf8"),
  /SIL OPEN FONT LICENSE Version 1\.1/,
);

console.log("Google Sans local delivery contracts: OK");
