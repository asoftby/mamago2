import assert from "node:assert/strict";
import test from "node:test";
import { resolveAvatarUrlUpdate } from "./resolveAvatarUrlUpdate";

const own = "/media/2026/11/me-avatar.webp";
const isOwn = async (url: string) => url === own;

test("omitted avatarUrl leaves the avatar untouched", async () => {
  assert.deepEqual(await resolveAvatarUrlUpdate({ displayName: "A" }, isOwn), { kind: "none" });
  assert.deepEqual(await resolveAvatarUrlUpdate(null, isOwn), { kind: "none" });
});

test("own uploaded media URL is persisted", async () => {
  assert.deepEqual(await resolveAvatarUrlUpdate({ avatarUrl: own }, isOwn), { kind: "set", avatarUrl: own });
});

test("null removes the avatar", async () => {
  assert.deepEqual(await resolveAvatarUrlUpdate({ avatarUrl: null }, isOwn), { kind: "set", avatarUrl: null });
});

test("foreign, external or malformed URLs are rejected", async () => {
  for (const avatarUrl of ["https://evil.example/x.png", "/media/other-user.webp", "", "   ", 42, {}, "x".repeat(3000)]) {
    assert.deepEqual(await resolveAvatarUrlUpdate({ avatarUrl }, isOwn), { kind: "invalid" }, String(avatarUrl).slice(0, 40));
  }
});
