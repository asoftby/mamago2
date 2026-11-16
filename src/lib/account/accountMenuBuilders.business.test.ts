import assert from "node:assert/strict";
import { buildBusinessAccountModel } from "./accountMenuBuilders";

const noop = () => {};
let settingsCalls = 0;

const model = buildBusinessAccountModel({
  user: { email: "owner@example.com", displayName: "Owner", role: "USER" } as never,
  initials: "O",
  onNavigate: noop,
  onGoToPersonalAccount: noop,
  onGoToPersonalIdeas: noop,
  onGoToPersonalPlan: noop,
  onGoToPersonalBookings: noop,
  onGoToPersonalDirect: noop,
  onGoToPersonalRoutes: noop,
  onGoToSettings: () => {
    settingsCalls += 1;
  },
  onGoToAdminAccount: noop,
  onGoToBusinessAccount: noop,
  onGoToBusinessDashboard: noop,
  onGoToBusinessRoot: noop,
  onGoToBusinessPublications: noop,
  onGoToBusinessBookings: noop,
  onGoToBusinessClients: noop,
  onGoToBusinessAnalytics: noop,
  onGoToBusinessPromotion: noop,
  onGoToBusinessBilling: noop,
  onSwitchMode: noop,
  onGoToHome: noop,
  hasBusinessProfile: true,
  onLogout: noop,
  loggingOut: false,
} as never);

const settings = model.mainItems.find((row) => row.key === "settings");
assert.ok(settings && settings.type === "button", "business menu must have a «Настройки» row");
assert.equal(settings.label, "Настройки");
assert.equal(
  settings.type === "button" ? settings.activeHref : null,
  "/settings",
  "business «Настройки» must highlight /settings (not /me/settings)",
);
settings.onClick();
assert.equal(settingsCalls, 1, "row must call onGoToSettings (business surface in business mode)");

// Пополнение баланса: без NEXT_PUBLIC_BILLING_ENABLED=true кнопка неактивна.
assert.equal((model as { topUpDisabled?: boolean }).topUpDisabled, process.env.NEXT_PUBLIC_BILLING_ENABLED !== "true");

console.log("accountMenuBuilders.business.test: OK");
