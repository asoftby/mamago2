import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isPartyOutboxEventType, heldPartyOutboxEventTypes, partyOutboxCopy } from "./partyOutbox.logic";

const service = readFileSync(new URL("./partyQuoteAcceptance.service.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../../app/api/parent/parties/[id]/quotes/[quoteId]/accept/route.ts", import.meta.url), "utf8");
const dispatcher = readFileSync(new URL("./partyOutbox.service.ts", import.meta.url), "utf8");

assert.match(service, /FOR UPDATE/);
assert.match(service, /partyOrder: \{ ownerUserId: userId \}/);
assert.match(service, /lastActivityAt: request.lastActivityAt/);
assert.match(service, /status: "ACTIVE", validUntil: \{ gt: now \}/);
assert.match(service, /partyStage: "AWAITING_RECONFIRM"/);
assert.match(service, /confirmed: false/);
assert.match(service, /dedupeKey: "party:" \+ requestId \+ ":accepted:" \+ quoteId/);
assert.match(route, /getCurrentUser\(\)/);
assert.match(route, /checkRateLimit/);
assert.match(route, /requestId: body.requestId/);
assert.match(dispatcher, /"PARTY_QUOTE_ACCEPTED"/);
assert.equal(isPartyOutboxEventType("PARTY_QUOTE_ACCEPTED"), true);
assert.ok(heldPartyOutboxEventTypes({}).includes("PARTY_QUOTE_ACCEPTED"));
const copy = partyOutboxCopy({ type: "PARTY_QUOTE_ACCEPTED", offerTitle: "Площадка", dateLabel: "10.11" });
assert.equal(copy.audience, "BUSINESS");
assert.match(copy.body, /Требуется проверить доступность/);
console.log("Party quote acceptance safety contracts: OK");
