import assert from "node:assert/strict";
import { getHomeSectionAvailability } from "./homeSectionAvailability";

// First public release (AUDIT-XR-19): classes and birthday are outside the
// public scope unless explicitly enabled, whatever the home kill switches say.
assert.deepEqual(getHomeSectionAvailability({}), {
  classes: false,
  birthday: false,
  routes: false,
});
assert.deepEqual(
  getHomeSectionAvailability({ ENABLE_HOME_CLASSES: "true", ENABLE_HOME_BIRTHDAY: "true" }),
  { classes: false, birthday: false, routes: false },
);

const publicScope = { ENABLE_PUBLIC_CLASSES: "true", ENABLE_PUBLIC_BIRTHDAY: "true" };

assert.deepEqual(getHomeSectionAvailability(publicScope), {
  classes: true,
  birthday: true,
  routes: false,
});

assert.deepEqual(
  getHomeSectionAvailability({
    ...publicScope,
    ENABLE_HOME_CLASSES: "true",
    ENABLE_HOME_BIRTHDAY: "false",
    ENABLE_HOME_ROUTES: "TRUE",
  }),
  {
    classes: true,
    birthday: false,
    routes: true,
  },
);

assert.deepEqual(getHomeSectionAvailability({
  ...publicScope, ENABLE_HOME_CLASSES: "false", ENABLE_HOME_BIRTHDAY: "FALSE",
}), { classes: false, birthday: false, routes: false });

console.log("home section availability tests: OK");
