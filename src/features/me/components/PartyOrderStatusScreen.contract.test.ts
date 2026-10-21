import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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
console.log("Parent PartyOrder UI and acceptance contract: OK");
