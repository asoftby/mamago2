import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const service = readFileSync("src/server/services/notificationDelivery.service.ts", "utf8");
const retryStart = service.indexOf("export async function retryFailedDelivery(");
const resendStart = service.indexOf("export async function resendNotificationDelivery(");
assert.ok(retryStart >= 0 && resendStart > retryStart);
const retry = service.slice(retryStart, resendStart);
assert.ok(retry.includes("mayUseFamilyTelegramBot(delivery.notification.audience)"),
  "retry must enforce family/business audience isolation");
assert.ok(!retry.includes("const connection = businessRecipient\n"),
  "business-recipient absence must never enable fallback to family bot");
assert.ok(retry.includes("buildPartyConfirmationTelegramKeyboard("),
  "business party retry must generate fresh gated confirmation action");
assert.ok(retry.includes("partyMarkup ?? rendered.replyMarkup"),
  "retry must preserve business action markup");
console.log("businessTelegramRetry.contract.test.ts: OK");
