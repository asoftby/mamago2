import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const overlay = readFileSync(new URL("./PartyConfirmOverlay.tsx", import.meta.url), "utf8");
const inbox = readFileSync(new URL("./BookingsInbox.tsx", import.meta.url), "utf8");
assert.match(overlay, /manualAllowed\?: boolean/);
assert.match(overlay, /!selectedUnit && !available\.manualAllowed/);
assert.match(overlay, /selectedUnit \? \{ bookingUnitId: selectedUnit \} : \{\}/);
assert.match(overlay, /Автоматическая блокировка календаря не выполняется/);
assert.match(overlay, /available\?\.manualAllowed/);
assert.match(inbox, /Подтвердить заказ/);
assert.doesNotMatch(inbox, /Подтвердить площадку/);
console.log("Manual/non-resource party confirmation UI: OK");
