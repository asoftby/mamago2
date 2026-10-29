import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { partyCancelBlocker } from "../../../server/birthday/partyCancelRules";

const me = readFileSync(new URL("./PartyOrderStatusScreen.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../../../app/(public)/me/birthdays/[id]/page.tsx", import.meta.url), "utf8");
const list = readFileSync(new URL("../../../server/services/userBirthdays.service.ts", import.meta.url), "utf8");
const read = readFileSync(new URL("../../../server/birthday/partyDraft.service.ts", import.meta.url), "utf8");

assert.match(list, /where: \{ ownerUserId: userId \}/);
assert.doesNotMatch(list, /return \[\]/);
assert.match(page, /readPartyOrder\(user.id, id\)/);
assert.match(page, /quote\.priceByn\?\.toString\(\)/);
assert.match(page, /quote\.validUntil && quote\.validUntil > new Date\(\)/);
assert.match(read, /orderBy: \{ createdAt: "desc" \}/);
assert.match(me, /Принять предложение/);
assert.match(me, /Бронирование считается завершённым/);
assert.match(me, /router.refresh\(\)/);
assert.match(me, /requestId, expectedVersion/);
assert.doesNotMatch(me, /Date\.now\(\)/);
// #818 D1: order status banner, cancel only without confirmations, expired offers explained.
assert.match(page, /cancelBlocker: partyCancelBlocker\(party\)/);
assert.match(page, /version: party.version/);
assert.match(me, /NEEDS_ALTERNATIVE: "Основной исполнитель не подтвердил праздник/);
assert.match(me, /\/cancel`/);
assert.match(me, /body: JSON\.stringify\(\{ version: party\.version \}\)/);
assert.match(me, /party\.cancelBlocker \? \(/);
assert.match(me, /Срок предложения истёк/);
assert.match(me, /const isAvailable = !cancelled &&/);
const blocker = partyCancelBlocker;
assert.equal(blocker({ status: "ANCHOR_PENDING", items: [{ status: "REQUESTED", confirmedBookingRequestId: null }] }), null);
assert.equal(blocker({ status: "NEEDS_ALTERNATIVE", items: [{ status: "DECLINED", confirmedBookingRequestId: null }] }), null);
assert.match(blocker({ status: "ANCHOR_CONFIRMED", items: [] }) ?? "", /только по их условиям/);
// A confirmed add-on blocks cancellation even while the order itself is not ANCHOR_CONFIRMED.
assert.match(blocker({ status: "ANCHOR_PENDING", items: [{ status: "CONFIRMED", confirmedBookingRequestId: "r1" }] }) ?? "",
  /только по их условиям/);
console.log("Parent PartyOrder UI and acceptance contract: OK");
