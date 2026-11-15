import assert from "node:assert/strict";
import { BANNER } from "./consent-config";

// AnalyticsLoader initializes Google Analytics before consent (Advanced Consent
// Mode, cookieless pings); Yandex Metrica and ad pixels are fully consent-gated.
// The first-screen banner must disclose this, not only the Preferences panel.
assert.match(BANNER.description, /Google Analytics/);
assert.match(BANNER.description, /до вашего согласия/);
assert.match(BANNER.description, /без cookies/);
assert.match(BANNER.description, /Яндекс\.Метрика/);
assert.match(BANNER.description, /только с согласия/);

console.log("consentBannerDisclosure.test.ts: OK");
