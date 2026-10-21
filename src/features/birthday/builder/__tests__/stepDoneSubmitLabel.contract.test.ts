import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// StepDone's submit button is display:flex; any JSX text mixed with expressions becomes
// separate flex items ("заявк" + "и"). The label must be built as a single string.
const src = readFileSync("src/features/birthday/builder/components/steps/StepDone.tsx", "utf8");
assert.match(src, /const submitLabel = `Отправить \$\{summaryItems\.length\} \$\{pluralRu\(/);
assert.doesNotMatch(src, /заявк\{/, "plural ending must not be a separate JSX expression");
