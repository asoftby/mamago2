import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolveFamilyPicksRequest } from "./request";
import type { FamilyPicksProfile } from "./profile";
import type { FamilyPicksResponse } from "./load";

const profile: FamilyPicksProfile = {
  userId: "account_a", audience: "personalized", children: [{
    id: "child_0001", name: "Ребёнок", birthDate: new Date("2020-06-01Z"), birthPrecision: "MONTH", systemInterests: [],
  }],
};
const forbidden = async (): Promise<never> => { throw new Error("must not invoke ranking/session"); };
function deps(current: FamilyPicksProfile = profile) {
  return {
    getCurrentUser: async () => current.userId ? { id: current.userId } : null,
    getSessionId: forbidden,
    loadProfile: async (userId: string | null) => { assert.equal(userId, current.userId); return current; },
    loadPicks: forbidden,
  };
}

test("context-only validates selection without ranking, trace or session lookup", async () => {
  const result = await resolveFamilyPicksRequest(new URLSearchParams("contextOnly=1&selectedChildId=child_0001"), deps());
  assert.equal(result.status, 200);
  assert.ok("profileContext" in result.body);
  assert.equal(result.body.profileContext?.selectedChildId, "child_0001");
  assert.equal(result.body.profileContext?.selectionApplied, false);
  assert.ok(!JSON.stringify(result.body).includes("2020-06"));
});

test("foreign/deleted/former-family IDs and guest selection have the same non-enumerating error", async () => {
  for (const current of [profile, { ...profile, children: [] }, { userId: null, audience: "guest", children: [] } as FamilyPicksProfile]) {
    const result = await resolveFamilyPicksRequest(new URLSearchParams("contextOnly=1&selectedChildId=foreign_01"), deps(current));
    assert.deepEqual(result, { status: 404, body: { error: "selection_unavailable" } });
  }
});

test("selected-child recommendations remain disabled, never return misleading legacy cards", async () => {
  assert.deepEqual(await resolveFamilyPicksRequest(new URLSearchParams("selectedChildId=child_0001"), deps()), {
    status: 409, body: { error: "selection_not_enabled" },
  });
});

test("malformed or repeated selection is rejected before auth or DB", async () => {
  const d = { ...deps(), getCurrentUser: forbidden };
  for (const query of ["selectedChildId=", "selectedChildId=x", "selectedChildId=child_0001&selectedChildId=child_0002", "selectedChildId=%3Cscript%3E", `selectedChildId=${"a".repeat(65)}`, "contextOnly=0", "contextOnly=1&contextOnly=1", "city=..", "anonymousId=!"]) {
    assert.equal((await resolveFamilyPicksRequest(new URLSearchParams(query), d)).status, 400);
  }
});

test("legacy call preserves loader input and response, no extra profile read", async () => {
  const legacy = { items: [{ id: "existing_event" }], level: "AGE", audience: "user" } as unknown as FamilyPicksResponse;
  const result = await resolveFamilyPicksRequest(new URLSearchParams("city=MINSK&anonymousId=anonymous_1"), {
    ...deps(), loadProfile: forbidden, getSessionId: async () => "session_1",
    loadPicks: async input => {
      assert.deepEqual(input, { citySlug: "minsk", userId: "account_a", anonymousId: "anonymous_1", sessionId: "session_1" });
      return legacy;
    },
  });
  assert.equal(result.body, legacy);
});

test("account switch and profile failure cannot return previous account context", async () => {
  const a = await resolveFamilyPicksRequest(new URLSearchParams("contextOnly=1"), deps());
  const b = await resolveFamilyPicksRequest(new URLSearchParams("contextOnly=1"), deps({ userId: "account_b", audience: "no_child_with_DOB", children: [] }));
  assert.notDeepEqual(a.body, b.body);
  await assert.rejects(resolveFamilyPicksRequest(new URLSearchParams("contextOnly=1"), {
    ...deps(), loadProfile: async () => { throw new Error("DB failed"); },
  }), /DB failed/);
});

test("HTTP adapter keeps successes and errors private/no-store and errors as 500", () => {
  const route = readFileSync("src/app/api/recommendations/family-picks/route.ts", "utf8");
  assert.match(route, /"Cache-Control": "private, no-store"/);
  assert.match(route, /status: result.status, headers/);
  assert.match(route, /status: 500, headers/);
  const loader = readFileSync("src/server/services/recommendations/familyPicks/load.ts", "utf8");
  assert.match(loader, /loadFamilyPicksProfile\(input.userId \?\? null\)/);
  assert.match(loader, /loadFamily\(input.userId, profile.children,/);
  assert.doesNotMatch(loader, /prisma.child.findMany/);
});
