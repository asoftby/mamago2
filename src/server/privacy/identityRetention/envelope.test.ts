import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";
import {
  buildIdentityPayload,
  IdentityRetentionKeyError,
  identityRetentionPurgeAfter,
  loadPrivateKey,
  loadPublicKey,
  loadPublicKeyFromEnv,
  matchesIdentitySelector,
  openIdentityEnvelope,
  sealIdentityPayload,
} from "./envelope";

function keyPair(bits = 3072, passphrase?: string) {
  return generateKeyPairSync("rsa", {
    modulusLength: bits,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: passphrase
      ? { type: "pkcs8", format: "pem", cipher: "aes-256-cbc", passphrase }
      : { type: "pkcs8", format: "pem" },
  });
}

const main = keyPair(3072, "test-passphrase");
const other = keyPair(3072);

const user = {
  id: "user-1",
  email: "parent@example.test",
  emailVerifiedAt: new Date("2026-01-02T03:04:05Z"),
  phoneE164: "+375291234567",
  phoneVerifiedAt: new Date("2026-01-03T00:00:00Z"),
  businessContactVerifiedPhoneE164: null,
  businessContactPhoneVerifiedAt: null,
  displayName: "Мама",
  telegramId: "777",
  telegramUsername: "mama_tg",
  createdAt: new Date("2025-12-31T23:00:00Z"),
};
const endedAt = new Date("2026-11-17T10:00:00Z");

test("seal → open round-trips the full identity payload; ciphertext never contains plaintext", () => {
  const payload = buildIdentityPayload(user, endedAt);
  const pub = loadPublicKey(main.publicKey);
  const sealed = sealIdentityPayload(payload, pub);
  assert.equal(sealed.keyId, pub.keyId);
  assert.ok(!sealed.envelope.includes("375291234567"));
  assert.ok(!sealed.envelope.includes("parent@example.test"));

  const priv = loadPrivateKey(main.privateKey, "test-passphrase");
  assert.equal(priv.keyId, pub.keyId);
  assert.deepEqual(openIdentityEnvelope(sealed.envelope, "user-1", priv), payload);
});

test("two seals of the same payload differ (random data key and IV)", () => {
  const payload = buildIdentityPayload(user, endedAt);
  const pub = loadPublicKey(main.publicKey);
  assert.notEqual(sealIdentityPayload(payload, pub).envelope, sealIdentityPayload(payload, pub).envelope);
});

test("open refuses a foreign key, a swapped userId and a tampered ciphertext", () => {
  const sealed = sealIdentityPayload(buildIdentityPayload(user, endedAt), loadPublicKey(main.publicKey));
  const priv = loadPrivateKey(main.privateKey, "test-passphrase");

  assert.throws(
    () => openIdentityEnvelope(sealed.envelope, "user-1", loadPrivateKey(other.privateKey)),
    (e: unknown) => e instanceof IdentityRetentionKeyError && e.code === "KEY_MISMATCH",
  );
  assert.throws(() => openIdentityEnvelope(sealed.envelope, "user-2", priv));

  const env = JSON.parse(sealed.envelope);
  const ct = Buffer.from(env.ct, "base64");
  ct[0] ^= 0xff;
  env.ct = ct.toString("base64");
  assert.throws(() => openIdentityEnvelope(JSON.stringify(env), "user-1", priv));
  assert.throws(
    () => openIdentityEnvelope("not json", "user-1", priv),
    (e: unknown) => e instanceof IdentityRetentionKeyError && e.code === "MALFORMED_ENVELOPE",
  );
});

test("public key: missing, garbage and weak keys are rejected; env accepts escaped and base64 PEM", () => {
  const codeOf = (fn: () => unknown) => {
    try {
      fn();
    } catch (e) {
      return e instanceof IdentityRetentionKeyError ? e.code : "OTHER";
    }
    return "OK";
  };
  assert.equal(codeOf(() => loadPublicKeyFromEnv({})), "MISSING");
  assert.equal(codeOf(() => loadPublicKey("   ")), "MISSING");
  assert.equal(codeOf(() => loadPublicKey("garbage")), "INVALID");
  assert.equal(codeOf(() => loadPublicKey(keyPair(2048).publicKey)), "TOO_WEAK");
  const ec = generateKeyPairSync("ec", { namedCurve: "P-256", publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } });
  assert.equal(codeOf(() => loadPublicKey(ec.publicKey)), "INVALID");

  const expected = loadPublicKey(main.publicKey).keyId;
  const escaped = main.publicKey.replace(/\n/g, "\\n");
  assert.equal(loadPublicKeyFromEnv({ IDENTITY_RETENTION_PUBLIC_KEY: escaped }).keyId, expected);
  const b64 = Buffer.from(main.publicKey).toString("base64");
  assert.equal(loadPublicKeyFromEnv({ IDENTITY_RETENTION_PUBLIC_KEY: b64 }).keyId, expected);
});

test("private key with a wrong passphrase is rejected", () => {
  assert.throws(
    () => loadPrivateKey(main.privateKey, "wrong"),
    (e: unknown) => e instanceof IdentityRetentionKeyError && e.code === "INVALID",
  );
});

test("purgeAfter is exactly one calendar year later and never shorter (leap day)", () => {
  assert.equal(identityRetentionPurgeAfter(endedAt).toISOString(), "2027-11-17T10:00:00.000Z");
  const leap = identityRetentionPurgeAfter(new Date("2028-02-29T12:00:00Z"));
  assert.equal(leap.toISOString(), "2029-03-01T12:00:00.000Z");
  const days = (leap.getTime() - Date.UTC(2028, 1, 29, 12)) / 86_400_000;
  assert.ok(days >= 365);
});

test("operator selector matches phone by digits (any format), business phone, email case-insensitively", () => {
  const payload = { ...buildIdentityPayload(user, endedAt), businessContactPhoneE164: "+375447654321" };
  assert.ok(matchesIdentitySelector(payload, { phone: "+375 (29) 123-45-67" }));
  assert.ok(matchesIdentitySelector(payload, { phone: "375447654321" }));
  assert.ok(!matchesIdentitySelector(payload, { phone: "+375291234560" }));
  assert.ok(!matchesIdentitySelector(payload, { phone: "---" }));
  assert.ok(matchesIdentitySelector(payload, { email: " Parent@Example.TEST " }));
  assert.ok(!matchesIdentitySelector(payload, { email: "other@example.test" }));
  assert.ok(!matchesIdentitySelector(payload, {}));
});
