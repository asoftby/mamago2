import assert from "node:assert/strict";
import { ownerColor } from "./ownerColor";

assert.equal(ownerColor("family"), "var(--plan-accent)");
assert.equal(ownerColor("child-abc"), ownerColor("child-abc"));
assert.match(ownerColor("clx123"), /^var\(--plan-child-[1-6]\)$/);
console.log("plan-calendar ownerColor.test.ts ok");
