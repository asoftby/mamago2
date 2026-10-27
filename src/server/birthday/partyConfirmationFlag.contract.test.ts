import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assertPartyConfirmationEnabled, isPartyConfirmationEnabled } from "./partyConfirmationFlag";
import { PartyApiError } from "./partyDraft.validation";

// PARTY_CONFIRMATION_ENABLED gates every confirmation path on the server (#818).
assert.equal(isPartyConfirmationEnabled({}), false);
assert.equal(isPartyConfirmationEnabled({ PARTY_CONFIRMATION_ENABLED: "false" }), false);
assert.equal(isPartyConfirmationEnabled({ PARTY_CONFIRMATION_ENABLED: "1" }), false);
assert.equal(isPartyConfirmationEnabled({ PARTY_CONFIRMATION_ENABLED: "true" }), true);
assert.throws(() => assertPartyConfirmationEnabled({}),
  (error: unknown) => error instanceof PartyApiError && error.status === 503);

const read = (file: string) => readFileSync(new URL("./" + file, import.meta.url), "utf8");
const acceptance = read("partyQuoteAcceptance.service.ts");
const confirm = read("partyConfirm.service.ts");
const reply = read("partyBusiness.service.ts");
const telegram = read("partyTelegramConfirmAction.service.ts");
assert.ok(acceptance.indexOf("assertPartyConfirmationEnabled()") !== -1 &&
  acceptance.indexOf("assertPartyConfirmationEnabled()") < acceptance.indexOf("prisma.$transaction"),
  "Parent acceptance is gated before any write");
assert.ok(confirm.indexOf("assertPartyConfirmationEnabled()") !== -1 &&
  confirm.indexOf("assertPartyConfirmationEnabled()") < confirm.indexOf("prisma.$transaction"),
  "Business confirmation (site and Telegram) is gated before any write");
assert.match(reply, /const fixedPrice = !declined && isPartyConfirmationEnabled\(\) &&/);
assert.match(telegram, /status === 503\) return \{ ok: false as const, reason: "CONFIRMATION_DISABLED"/);
console.log("partyConfirmationFlag.contract.test.ts: OK");
