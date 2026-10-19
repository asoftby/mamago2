import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./PlanNewTaskScreen.tsx", import.meta.url), "utf8");
assert.match(source, /const customLeadValid = !timed \|\| !customLeadOpen \|\| \(/, "untimed entries cannot be blocked by hidden custom reminder inputs");
assert.match(source, /const can = Boolean\(text\.trim\(\) && day && \(!timed \|\| timeValid\) && customLeadValid\)/);
console.log("PlanNewTaskScreen custom reminder state: OK");
