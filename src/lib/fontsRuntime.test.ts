import assert from "node:assert/strict";
import { shouldUseGoogleSans } from "./fontsRuntime";

for (const appEnv of ["dev", "DEV", " prod ", "production", "PRODUCTION"]) {
  assert.equal(
    shouldUseGoogleSans(appEnv),
    true,
    `Google Sans must be active for APP_ENV=${appEnv}`,
  );
}

for (const appEnv of [undefined, "", "local", "staging", "preview"]) {
  assert.equal(
    shouldUseGoogleSans(appEnv),
    false,
    `NTSomic fallback must remain for APP_ENV=${String(appEnv)}`,
  );
}

console.log("Google Sans runtime environment tests: OK");
