import assert from "node:assert/strict";

import { shouldShowDesktopHeaderSearch } from "./shouldShowDesktopHeaderSearch";

assert.equal(shouldShowDesktopHeaderSearch("/minsk"), true);
assert.equal(shouldShowDesktopHeaderSearch("/minsk/events"), true);
assert.equal(shouldShowDesktopHeaderSearch("/minsk/classes"), true);
assert.equal(shouldShowDesktopHeaderSearch("/minsk/events/today"), true);
assert.equal(shouldShowDesktopHeaderSearch("/minsk/events/some-event-slug"), false);
assert.equal(shouldShowDesktopHeaderSearch("/minsk/places"), true);
assert.equal(shouldShowDesktopHeaderSearch("/minsk/places/cafes"), true);
assert.equal(shouldShowDesktopHeaderSearch("/minsk/places/some-place-slug"), false);
assert.equal(shouldShowDesktopHeaderSearch("/plan"), false);
assert.equal(shouldShowDesktopHeaderSearch("/profile"), false);
assert.equal(shouldShowDesktopHeaderSearch("/admin/publications"), false);
assert.equal(shouldShowDesktopHeaderSearch("/business/events"), false);
assert.equal(shouldShowDesktopHeaderSearch("/editor/event/123/edit"), false);

console.log("shouldShowDesktopHeaderSearch tests: OK");
