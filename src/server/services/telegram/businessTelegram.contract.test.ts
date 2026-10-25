import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
const service = read("src/server/services/telegram/businessTelegram.service.ts");
const webhook = read("src/app/api/business/telegram/webhook/route.ts");
const config = read("src/server/config/businessTelegram.config.ts");
const schema = read("prisma/schema.prisma");
const ui = read("src/components/business/notifications/NotificationSettingsInModal.tsx");
const businessSettings = read("src/components/business/notifications/NotificationSettingsTable.tsx");
const businessCard = read("src/components/business/notifications/BusinessTelegramStatusRow.tsx");
const dashboard = read("src/components/business/dashboard/DashboardClient.tsx");
const onboarding = read("src/components/business/dashboard/NewBusinessDashboard.tsx");
const migration = read("prisma/migrations/20261022020000_business_telegram_bot/migration.sql");

assert.match(config, /TELEGRAM_BUSINESS_BOT_TOKEN_/);
assert.doesNotMatch(config, /"TELEGRAM_BOT_TOKEN"/);
assert.match(webhook, /timingSafeEqual/);
assert.match(webhook, /msg\?\.chat\?\.type !== "private"/);
assert.match(service, /isActive: true, role:/);
assert.doesNotMatch(service, /ownerUserId: link\.userId/);
assert.match(service, /expiresAt: \{ gt: now \}/);
assert.match(service, /tokenHash: hash\(token\)/);
assert.match(service, /getMyBusiness\(userId\)/);
assert.match(schema, /model BusinessTelegramConnection/);
assert.match(schema, /model BusinessTelegramLinkToken/);
assert.match(schema, /@@unique\(\[userId, environment\]\)/);
assert.match(migration, /CREATE TABLE "BusinessTelegramConnection"/);
assert.match(migration, /CREATE TABLE "BusinessTelegramLinkToken"/);
// Dedicated Business Bot appears on the dashboard and both settings surfaces.
assert.match(dashboard, /<BusinessTelegramStatusRow location="dashboard"/);
assert.match(businessSettings, /<BusinessTelegramStatusRow/);
assert.match(ui, /<BusinessNotificationSettingsClient/);
assert.match(ui, /<TelegramStatusRow/); // Existing family connection remains accessible only for USER mode.
assert.match(ui, /mode === "user" && <TelegramStatusRow/);
assert.match(businessCard, /\/api\/business\/telegram/);
assert.doesNotMatch(businessCard, /Проверить статус/);
assert.match(businessCard, /Настроить уведомления/);
assert.match(dashboard, /Возможности кабинета/);
assert.match(dashboard, /setTourOpen\(true\)/);
assert.doesNotMatch(dashboard, /Возможности mamaGo/);
assert.doesNotMatch(onboarding, /Обзор кабинета|Пройти обзор/);
console.log("Business Telegram isolation and linking contracts: OK");
