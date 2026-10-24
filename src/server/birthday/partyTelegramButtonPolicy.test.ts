import assert from "node:assert/strict";
import { canConfirmPartyWithOneTap } from "./partyTelegramButtonPolicy";

const choice = (overrides: Partial<Parameters<typeof canConfirmPartyWithOneTap>[0]> = {}) => ({
  availableUnitIds: ["room-a"], activeMappedUnitCount: 1,
  acceptedQuoteUnitId: null, manualAllowed: false, ...overrides,
});

assert.equal(canConfirmPartyWithOneTap(choice()), true, "one mapped and available room");
assert.equal(canConfirmPartyWithOneTap(choice({ availableUnitIds: [] })), false, "no room available");
assert.equal(canConfirmPartyWithOneTap(choice({ availableUnitIds: ["room-a", "room-b"],
  activeMappedUnitCount: 2 })), false, "two rooms require explicit selection");
assert.equal(canConfirmPartyWithOneTap(choice({ activeMappedUnitCount: 2 })),
  false, "one available of two mapped rooms still requires selection");
assert.equal(canConfirmPartyWithOneTap(choice({ activeMappedUnitCount: 2,
  acceptedQuoteUnitId: "room-a" })), true, "quote fixes a particular available room");
assert.equal(canConfirmPartyWithOneTap(choice({ activeMappedUnitCount: 2,
  acceptedQuoteUnitId: "room-b" })), false, "quote fixed to unavailable room");
assert.equal(canConfirmPartyWithOneTap(choice({ activeMappedUnitCount: 0,
  availableUnitIds: [], manualAllowed: true })), true, "add-on without rooms");
assert.equal(canConfirmPartyWithOneTap(choice({ activeMappedUnitCount: 1,
  availableUnitIds: [], manualAllowed: true })), false, "cannot bypass mapped resource");
console.log("Party Telegram one-tap room policy: OK");
