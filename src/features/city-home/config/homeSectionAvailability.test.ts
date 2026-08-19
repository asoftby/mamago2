import assert from "node:assert/strict";
import { getHomeSectionAvailability } from "./homeSectionAvailability";

assert.deepEqual(getHomeSectionAvailability({}), {
  classes: false,
  birthday: false,
  routes: false,
});

assert.deepEqual(
  getHomeSectionAvailability({
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

console.log("home section availability tests: OK");
