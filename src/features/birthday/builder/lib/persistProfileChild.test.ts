import assert from "node:assert/strict";
import test from "node:test";
import { persistBirthdayProfileChild } from "./persistProfileChild";

test("existing profile child edit awaits an exact-day non-destructive PUT", async () => {
  const requests: { input: RequestInfo | URL; init?: RequestInit }[] = [];
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ input, init });
    return new Response(JSON.stringify({ child: { id: "child-1" } }), { status: 200 });
  };

  await persistBirthdayProfileChild(fetcher, {
    id: "child-1",
    name: " Маша ",
    birthDate: "2020-05-17",
    systemInterests: ["art"],
  });

  const request = requests[0];
  assert.equal(request?.input, "/api/children/child-1");
  assert.equal(request?.init?.method, "PUT");
  const body = JSON.parse(String(request?.init?.body));
  assert.deepEqual(body, {
    name: " Маша ",
    birthDate: "2020-05-17",
    birthPrecision: "DAY",
    systemInterests: ["art"],
  });
  assert.equal("customInterests" in body, false);
});

test("existing profile child edit rejects before UI can report success", async () => {
  const fetcher = async () =>
    new Response(JSON.stringify({ error: "validation failed" }), { status: 400 });

  await assert.rejects(
    persistBirthdayProfileChild(fetcher, {
      id: "child-1",
      name: "Маша",
      birthDate: "2020-05-17",
      systemInterests: [],
    }),
    /validation failed/,
  );
});

test("refinement always PUTs explicit child B, independent of current selection", async () => {
  const targets: string[] = [];
  const fetcher = async (input: RequestInfo | URL) => {
    targets.push(String(input));
    return new Response(JSON.stringify({ child: { id: "child-b" } }), { status: 200 });
  };
  const refineB = () =>
    persistBirthdayProfileChild(fetcher, {
      id: "child-b",
      name: "Б",
      birthDate: "2020-05-17",
      systemInterests: [],
    });

  await refineB(); // no selected child
  const unrelatedCurrentSelection = "child-a";
  assert.equal(unrelatedCurrentSelection, "child-a");
  await refineB(); // selected A must not influence the mutation target

  assert.deepEqual(targets, ["/api/children/child-b", "/api/children/child-b"]);
});
