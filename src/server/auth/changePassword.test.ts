import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { changePasswordSchema } from "./changePassword.service";

assert.equal(
  changePasswordSchema.safeParse({
    currentPassword: "Current-pass-123",
    newPassword: "short1",
  }).success,
  false,
);
assert.equal(
  changePasswordSchema.safeParse({
    currentPassword: "Current-pass-123",
    newPassword: "No-digits-here",
  }).success,
  false,
);

const service = readFileSync(
  "src/server/auth/changePassword.service.ts",
  "utf8",
);
assert.match(service, /await prisma\.\$transaction\(/);
assert.match(service, /await tx\.user\.updateMany\(/);
assert.match(
  service,
  /await tx\.session\.deleteMany\(\{ where: \{ userId: user\.id \} \}\)/,
  "password update and all-session revocation must share one transaction",
);

const route = readFileSync("src/app/api/settings/password/route.ts", "utf8");
assert.match(route, /deleteSessionCookie\(response, host \?\? undefined\)/);
assert.match(route, /reauthRequired: true/);

const form = readFileSync(
  "src/app/settings/password/ChangePasswordForm.tsx",
  "utf8",
);
assert.match(form, /window\.location\.assign\("\/login\?passwordChanged=1"\)/);
assert.match(form, /все активные сеансы завершатся/);
assert.doesNotMatch(form, /вход останется активным/);

console.log("changePassword.test.ts: OK");
