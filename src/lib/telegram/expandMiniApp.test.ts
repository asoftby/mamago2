import assert from "node:assert/strict";
import { expandMiniApp } from "./expandMiniApp";

let calls = 0;
expandMiniApp({ expand: () => { calls += 1; } });
assert.equal(calls, 1, "Telegram Mini App expands on open");

assert.doesNotThrow(() => expandMiniApp({}));
assert.doesNotThrow(() => expandMiniApp(null));
assert.doesNotThrow(() => expandMiniApp({ expand: () => { throw new Error("unsupported client"); } }));
assert.equal(calls, 1);
