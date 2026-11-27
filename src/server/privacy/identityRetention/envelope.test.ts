import assert from "node:assert/strict";
import { generateKeyPairSync, createCipheriv, randomBytes, publicEncrypt, constants } from "node:crypto";
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

function keyPair(bits = 4096, passphrase?: string) {
  return generateKeyPairSync("rsa", {
    modulusLength: bits,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: passphrase
      ? { type: "pkcs8", format: "pem", cipher: "aes-256-cbc", passphrase }
      : { type: "pkcs8", format: "pem" },
  });
}

const main = keyPair(4096, "test-passphrase");
const other = keyPair(4096);

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
  assert.equal(codeOf(() => loadPublicKey(keyPair(3072).publicKey)), "TOO_WEAK");
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

test("server refuses RSA private PEM in the public-key environment variable", () => {
  const unencrypted = keyPair(4096);
  assert.throws(
    () => loadPublicKey(unencrypted.privateKey),
    (e: unknown) => e instanceof IdentityRetentionKeyError && e.code === "INVALID",
  );
  assert.throws(
    () => loadPublicKey(Buffer.from(unencrypted.privateKey).toString("base64")),
    (e: unknown) => e instanceof IdentityRetentionKeyError && e.code === "INVALID",
  );
});

test("envelope v1 rejects truncated GCM tags instead of downgrading authentication", () => {
  const sealed = sealIdentityPayload(buildIdentityPayload(user, endedAt), loadPublicKey(main.publicKey));
  const parsed = JSON.parse(sealed.envelope);
  const tag = Buffer.from(parsed.tag, "base64");
  parsed.tag = tag.subarray(0, 4).toString("base64");
  assert.throws(
    () => openIdentityEnvelope(JSON.stringify(parsed), user.id, loadPrivateKey(main.privateKey, "test-passphrase")),
    (e: unknown) => e instanceof IdentityRetentionKeyError && e.code === "MALFORMED_ENVELOPE",
  );
});

test("authenticated but invalid identity payloads are rejected", () => {
  const valid = buildIdentityPayload(user, endedAt);
  const pub = loadPublicKey(main.publicKey);
  const priv = loadPrivateKey(main.privateKey, "test-passphrase");
  const invalid = [
    { ...valid, schemaVersion: 2 },
    { ...valid, email: 123 },
    { ...valid, phoneE164: undefined },
    { ...valid, accountCreatedAt: "invalid" },
    { ...valid, emailVerifiedAt: false },
    { ...valid, displayName: {} },
  ];
  for (const payload of invalid) {
    const sealed = sealIdentityPayload(payload as typeof valid, pub);
    assert.throws(
      () => openIdentityEnvelope(sealed.envelope, user.id, priv),
      (e: unknown) => e instanceof IdentityRetentionKeyError && e.code === "MALFORMED_ENVELOPE",
    );
  }
});

test("seal rejects an unusable wrapping key", () => {
  const payload = buildIdentityPayload(user, endedAt);
  const ec = generateKeyPairSync("ec", { namedCurve: "P-256" });
  assert.throws(() => sealIdentityPayload(payload, { key: ec.publicKey, keyId: "invalid" }));
});

test("authenticated malformed JSON and mismatched embedded identity are rejected", () => {
  const pub = loadPublicKey(main.publicKey);
  const priv = loadPrivateKey(main.privateKey, "test-passphrase");
  for (const raw of ["{", "null", "[]", JSON.stringify({ ...buildIdentityPayload(user, endedAt), userId: "other" })]) {
    const key = randomBytes(32);
    try {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      cipher.setAAD(Buffer.from("mamago-identity-retention:v1:" + user.id));
      const ct = Buffer.concat([cipher.update(raw, "utf8"), cipher.final()]);
      const ek = publicEncrypt({ key: pub.key, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, key);
      const envelope = JSON.stringify({ v: 1, alg: "RSA-OAEP-256/A256GCM", kid: pub.keyId,
        ek: ek.toString("base64"), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), ct: ct.toString("base64") });
      assert.throws(() => openIdentityEnvelope(envelope, user.id, priv),
        (e: unknown) => e instanceof IdentityRetentionKeyError && e.code === "MALFORMED_ENVELOPE");
    } finally {
      key.fill(0);
    }
  }
});

test("sealing clears the data key even when wrapping fails", () => {
  const ec = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const original = Buffer.prototype.fill;
  const cleared: Buffer[] = [];
  const spy = test.mock.method(Buffer.prototype, "fill", function (this: Buffer, ...args: Parameters<typeof original>) {
    const result = Reflect.apply(original, this, args);
    if (this.length === 32 && args[0] === 0) cleared.push(Buffer.from(this));
    return result;
  });
  try {
    assert.throws(() => sealIdentityPayload(buildIdentityPayload(user, endedAt), { key: ec.publicKey, keyId: "invalid" }));
    assert.ok(cleared.some((key) => key.every((byte) => byte === 0)));
  } finally {
    spy.mock.restore();
  }
});
