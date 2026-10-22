import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file: string) => readFileSync(file, "utf8");
const delivery = read("src/server/services/telegram/businessTelegramDelivery.service.ts");
const dispatch = read("src/server/services/notificationDelivery.service.ts");
const channelResolver = read("src/lib/notifications/resolveNotificationChannels.ts");
const settings = read("src/app/api/notifications/settings/route.ts");

assert.match(delivery, /TELEGRAM_BUSINESS_DELIVERY_ENABLED === "true"/);
assert.match(delivery, /connection\?\.isActive/);
assert.match(delivery, /connection\.botUsername !== config\.botUsername/);
assert.match(delivery, /isActive: true/);
assert.match(delivery, /role: \{ in: \["OWNER", "MANAGER"\] \}/);
assert.match(delivery, /if \(!membership\) return null/);
assert.doesNotMatch(delivery, /requireTelegramConfig/);
assert.match(dispatch, /notification\.audience === "BUSINESS"/);
assert.match(dispatch, /delivery\.notification\.audience === "BUSINESS"/);
assert.match(dispatch, /sendBusinessTelegramMessage/);
assert.match(dispatch, /getActiveTelegramConnectionForCurrentEnvironment/);
assert.match(channelResolver, /getActiveBusinessTelegramRecipient/);
assert.match(settings, /surface === "BUSINESS" && await getActiveBusinessTelegramRecipient/);
assert.match(channelResolver, /resolveNotificationSettingsSurfaceForType\(notificationType\) === "BUSINESS"/);
console.log("Business Telegram routing isolation contracts: OK");
