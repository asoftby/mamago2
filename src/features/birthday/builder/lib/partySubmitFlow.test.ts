import assert from "node:assert/strict";
import { test } from "node:test";
import {
  submitBirthdayParty, type PartyFlowState, type PartyRequest, type PartySubmissionInput,
} from "./partySubmitFlow";

const input: PartySubmissionInput = {
  citySlug: "minsk", venueMode: "HOME", eventDate: "2026-12-20",
  timeFrom: "14:00", timeTo: "17:00", childrenCount: 8, adultsCount: 3,
  childName: "Тая", contactName: "Родитель", contactPhone: "+375291234567",
  anchorOfferId: "animator", addonOfferIds: ["cake"],
};
function fresh(): PartyFlowState {
  return { draft: null, pending: null, key: null, submitted: false };
}

test("lost submit response retries with the same key, never creates another order or request", async () => {
  const state = fresh();
  const calls: { url: string; method: string; key?: string }[] = [];
  let submits = 0;
  const request: PartyRequest = async <T>(url: string, method: string, _body?: object, key?: string): Promise<T> => {
    calls.push({ url, method, key });
    if (url === "/api/parent/parties") return { id: "order1", version: 0 } as T;
    if (method === "PATCH") return { id: "order1", version: 1 } as T;
    if (url.endsWith("/submit") && ++submits === 1) throw new Error("network dropped response");
    return { alreadySubmitted: true } as T;
  };
  await assert.rejects(() => submitBirthdayParty(state, input, request), /network dropped/);
  assert.equal(state.submitted, false);
  await submitBirthdayParty(state, input, request);
  assert.equal(state.submitted, true);
  assert.equal(calls.filter((c) => c.url === "/api/parent/parties").length, 1);
  assert.equal(calls.filter((c) => c.method === "PATCH").length, 1);
  const sent = calls.filter((c) => c.url.endsWith("/submit"));
  assert.equal(sent.length, 2);
  assert.ok(sent[0].key);
  assert.equal(sent[0].key, sent[1].key);
});

test("changed form after ambiguous submit checks order status before updating and rotates key", async () => {
  const state = fresh();
  const calls: { method: string; url: string; body?: object; key?: string }[] = [];
  let version = 0;
  let submitCount = 0;
  const request: PartyRequest = async <T>(url: string, method: string, body?: object, key?: string): Promise<T> => {
    calls.push({ url, method, body, key });
    if (url === "/api/parent/parties") return { id: "order2", version: 0 } as T;
    if (method === "GET") return { status: "DRAFT", version } as T;
    if (method === "PATCH") return { id: "order2", version: ++version } as T;
    if (url.endsWith("/submit") && ++submitCount === 1) throw new Error("lost");
    return { alreadySubmitted: false } as T;
  };
  await assert.rejects(() => submitBirthdayParty(state, input, request));
  const originalKey = state.key;
  await submitBirthdayParty(state, { ...input, timeFrom: "15:00" }, request);
  assert.equal(state.submitted, true);
  assert.equal(calls.filter((c) => c.method === "GET").length, 1);
  assert.equal(calls.filter((c) => c.method === "PATCH").length, 2);
  assert.notEqual(state.key, originalKey);
});

test("a committed PATCH with lost response reconciles its version before retry", async () => {
  const state = fresh();
  let version = 0;
  let patches = 0;
  const versions: number[] = [];
  const request: PartyRequest = async <T>(url: string, method: string, body?: object): Promise<T> => {
    if (url === "/api/parent/parties") return { id: "order3", version: 0 } as T;
    if (method === "GET") return { status: "DRAFT", version } as T;
    if (method === "PATCH") {
      const expected = (body as { version: number }).version;
      versions.push(expected);
      assert.equal(expected, version);
      version++;
      if (++patches === 1) throw new Error("PATCH response lost");
      return { id: "order3", version } as T;
    }
    return { alreadySubmitted: false } as T;
  };
  await assert.rejects(() => submitBirthdayParty(state, input, request), /PATCH response lost/);
  assert.equal(state.draft?.version, 1);
  await submitBirthdayParty(state, input, request);
  assert.deepEqual(versions, [0, 1]);
  assert.equal(state.submitted, true);
});

test("already submitted order after a lost response is not submitted twice when details change", async () => {
  const state = fresh();
  let sends = 0;
  const request: PartyRequest = async <T>(url: string, method: string): Promise<T> => {
    if (url === "/api/parent/parties") return { id: "order4", version: 0 } as T;
    if (method === "PATCH") return { id: "order4", version: 1 } as T;
    if (method === "GET") return { status: "ANCHOR_PENDING", version: 2 } as T;
    if (url.endsWith("/submit") && ++sends === 1) throw new Error("lost");
    throw new Error("unexpected duplicate submission");
  };
  await assert.rejects(() => submitBirthdayParty(state, input, request));
  await submitBirthdayParty(state, { ...input, adultsCount: 4 }, request);
  assert.equal(state.submitted, true);
  assert.equal(sends, 1);
});
