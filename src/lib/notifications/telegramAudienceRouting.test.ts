import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mayUseFamilyTelegramBot } from "./telegramAudienceRouting";

assert.equal(mayUseFamilyTelegramBot("BUSINESS"), false, "never fall back to Info Bot");
assert.equal(mayUseFamilyTelegramBot("USER"), true, "keep existing family flow");
assert.equal(mayUseFamilyTelegramBot("ADMIN"), true, "preserve non-business behavior");

// Guard the concrete delivery path, not merely the standalone policy.
const delivery = readFileSync(
  new URL("../../server/services/notificationDelivery.service.ts", import.meta.url),
  "utf8",
);
assert.match(delivery, /const connection = mayUseFamilyTelegramBot\(notification\.audience\)/);
assert.match(delivery, /if \(businessRecipient\) \{\s*await sendBusinessTelegramMessage/);
console.log("Business Telegram / Info Bot audience isolation: OK");
