import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { enforceUploadRequestLimits, UPLOAD_MAX_REQUEST_BYTES } from "./uploadRequestLimits";

const req = (headers: Record<string, string>) => new NextRequest("http://localhost/api/upload", { method: "POST", headers });
const allowAll = async () => ({ allowed: true });

test("upload requests must declare a bounded size before multipart parsing", async () => {
  assert.equal((await enforceUploadRequestLimits(req({}), "u1", allowAll))?.status, 411);
  assert.equal((await enforceUploadRequestLimits(req({ "content-length": "abc" }), "u1", allowAll))?.status, 411);
  assert.equal((await enforceUploadRequestLimits(req({ "content-length": String(UPLOAD_MAX_REQUEST_BYTES + 1) }), "u1", allowAll))?.status, 413);
  assert.equal(await enforceUploadRequestLimits(req({ "content-length": "1024" }), "u1", allowAll), null);
});

test("upload rate is capped per user and per trusted IP", async () => {
  const keys: string[] = [];
  const denyUser = async (key: string) => { keys.push(key); return { allowed: !key.startsWith("upload:user:") }; };
  assert.equal((await enforceUploadRequestLimits(req({ "content-length": "10" }), "u1", denyUser))?.status, 429);
  assert.deepEqual(keys, ["upload:user:u1"]);

  const previous = process.env.TRUST_PROXY_HEADERS;
  process.env.TRUST_PROXY_HEADERS = "true";
  try {
    const denyIp = async (key: string) => ({ allowed: !key.startsWith("upload:ip:") });
    const limited = await enforceUploadRequestLimits(req({ "content-length": "10", "x-real-ip": "203.0.113.7" }), "u1", denyIp);
    assert.equal(limited?.status, 429);
  } finally {
    if (previous === undefined) delete process.env.TRUST_PROXY_HEADERS; else process.env.TRUST_PROXY_HEADERS = previous;
  }
});
