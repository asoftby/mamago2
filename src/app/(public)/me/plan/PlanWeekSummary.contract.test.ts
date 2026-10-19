import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./PlanPageClient.tsx", import.meta.url), "utf8");
assert.match(source, /weekItems\.length === 0 \? "Нет событий" : `\$\{weekItems\.length\} \$\{pluralizeEvents\(weekItems\.length\)\}`/);
assert.match(source, /font-sans text-\[27px\] font-normal leading-tight/);
assert.doesNotMatch(source, /font-sans text-\[27px\] font-semibold leading-tight/);
console.log("Plan week summary copy and typography: OK");
