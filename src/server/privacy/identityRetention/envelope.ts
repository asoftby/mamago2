/**
 * Hybrid encryption for identity-retention records (постановление Совмина РБ № 850).
 *
 * The application only ever holds the RSA PUBLIC key: it can seal a record but
 * never open one. Opening needs the offline private key and happens only in the
 * `identity-retention-disclose` operator script on a lawful request.
 *
 * Envelope v1: random AES-256-GCM data key (AAD binds the ciphertext to its
 * userId, so rows cannot be swapped), data key wrapped with RSA-OAEP-SHA256.
 * Pure Node crypto, no DB access — unit-tested in envelope.test.ts.
 */
import {
  constants,
  createCipheriv,
  createDecipheriv,
  createHash,
  createPrivateKey,
  createPublicKey,
  privateDecrypt,
  publicEncrypt,
  randomBytes,
  type KeyObject,
} from "node:crypto";

export const IDENTITY_RETENTION_PUBLIC_KEY_ENV = "IDENTITY_RETENTION_PUBLIC_KEY";
const ALGORITHM = "RSA-OAEP-256/A256GCM";
const MIN_RSA_BITS = 4096;

export type IdentityRetentionPayload = {
  schemaVersion: 1;
  userId: string;
  email: string | null;
  emailVerifiedAt: string | null;
  phoneE164: string | null;
  phoneVerifiedAt: string | null;
  businessContactPhoneE164: string | null;
  businessContactPhoneVerifiedAt: string | null;
  displayName: string | null;
  telegramId: string | null;
  telegramUsername: string | null;
  accountCreatedAt: string;
  agreementEndedAt: string;
};

type EnvelopeV1 = { v: 1; alg: typeof ALGORITHM; kid: string; ek: string; iv: string; tag: string; ct: string };

export class IdentityRetentionKeyError extends Error {
  constructor(readonly code: "MISSING" | "INVALID" | "TOO_WEAK" | "KEY_MISMATCH" | "MALFORMED_ENVELOPE") {
    super(`identity retention key error: ${code}`);
    this.name = "IdentityRetentionKeyError";
  }
}

/** Accepts a PEM with real newlines, with literal "\n", or base64 of the whole PEM (env-friendly). */
export function normalizePem(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.includes("-----BEGIN")) return trimmed.replace(/\\n/g, "\n");
  const decoded = Buffer.from(trimmed, "base64").toString("utf8").trim();
  return decoded.includes("-----BEGIN") ? decoded : trimmed;
}

function assertStrongRsa(key: KeyObject): void {
  if (key.asymmetricKeyType !== "rsa") throw new IdentityRetentionKeyError("INVALID");
  const bits = key.asymmetricKeyDetails?.modulusLength ?? 0;
  if (bits < MIN_RSA_BITS) throw new IdentityRetentionKeyError("TOO_WEAK");
}

export function keyIdOf(publicKey: KeyObject): string {
  const der = publicKey.export({ type: "spki", format: "der" });
  return createHash("sha256").update(der).digest("hex").slice(0, 16);
}

export type IdentityRetentionPublicKey = { key: KeyObject; keyId: string };

export function loadPublicKey(pem: string | undefined | null): IdentityRetentionPublicKey {
  if (!pem || !pem.trim()) throw new IdentityRetentionKeyError("MISSING");
  const normalized = normalizePem(pem);
  // Node's createPublicKey() also accepts PRIVATE KEY PEM and silently derives
  // a public key. Never allow decryption material in a server-only setting.
  if (/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/i.test(normalized)) {
    throw new IdentityRetentionKeyError("INVALID");
  }
  let key: KeyObject;
  try {
    key = createPublicKey(normalized);
  } catch {
    throw new IdentityRetentionKeyError("INVALID");
  }
  assertStrongRsa(key);
  return { key, keyId: keyIdOf(key) };
}

export function loadPublicKeyFromEnv(
  env: Record<string, string | undefined> = process.env,
): IdentityRetentionPublicKey {
  return loadPublicKey(env[IDENTITY_RETENTION_PUBLIC_KEY_ENV]);
}

function aadFor(userId: string): Buffer {
  return Buffer.from(`mamago-identity-retention:v1:${userId}`, "utf8");
}

export function sealIdentityPayload(
  payload: IdentityRetentionPayload,
  publicKey: IdentityRetentionPublicKey,
): { keyId: string; envelope: string } {
  const dataKey = randomBytes(32);
  try {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", dataKey, iv);
    cipher.setAAD(aadFor(payload.userId));
    const ct = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    const ek = publicEncrypt(
      { key: publicKey.key, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
      dataKey,
    );
    const envelope: EnvelopeV1 = {
      v: 1,
      alg: ALGORITHM,
      kid: publicKey.keyId,
      ek: ek.toString("base64"),
      iv: iv.toString("base64"),
      tag: tag.toString("base64"),
      ct: ct.toString("base64"),
    };
    return { keyId: publicKey.keyId, envelope: JSON.stringify(envelope) };
  } finally {
    dataKey.fill(0);
  }
}

export function loadPrivateKey(pem: string, passphrase?: string): { key: KeyObject; keyId: string } {
  let key: KeyObject;
  try {
    key = createPrivateKey({ key: normalizePem(pem), format: "pem", ...(passphrase ? { passphrase } : {}) });
  } catch {
    throw new IdentityRetentionKeyError("INVALID");
  }
  assertStrongRsa(key);
  return { key, keyId: keyIdOf(createPublicKey(key)) };
}

function parseEnvelope(raw: string): EnvelopeV1 {
  try {
    const parsed = JSON.parse(raw) as Partial<EnvelopeV1>;
    if (
      parsed.v === 1 &&
      parsed.alg === ALGORITHM &&
      typeof parsed.kid === "string" &&
      typeof parsed.ek === "string" &&
      typeof parsed.iv === "string" &&
      typeof parsed.tag === "string" &&
      typeof parsed.ct === "string"
    ) {
      return parsed as EnvelopeV1;
    }
  } catch {
    // fall through
  }
  throw new IdentityRetentionKeyError("MALFORMED_ENVELOPE");
}

function validateIdentityPayload(value: unknown, userId: string): IdentityRetentionPayload {
  const invalid = () => new IdentityRetentionKeyError("MALFORMED_ENVELOPE");
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
  const p = value as Record<string, unknown>;
  if (p.schemaVersion !== 1 || p.userId !== userId || !userId) throw invalid();
  const nullableStringFields = [
    "email", "phoneE164", "businessContactPhoneE164", "displayName",
    "telegramId", "telegramUsername",
  ] as const;
  for (const field of nullableStringFields) {
    if (p[field] !== null && typeof p[field] !== "string") throw invalid();
  }
  const isIsoDate = (v: unknown): boolean =>
    typeof v === "string" && Number.isFinite(Date.parse(v)) &&
    new Date(v).toISOString() === v;
  for (const field of ["emailVerifiedAt", "phoneVerifiedAt", "businessContactPhoneVerifiedAt"]) {
    if (p[field] !== null && !isIsoDate(p[field])) throw invalid();
  }
  if (!isIsoDate(p.accountCreatedAt) || !isIsoDate(p.agreementEndedAt)) throw invalid();
  return p as IdentityRetentionPayload;
}

/** Operator-side only. Throws on wrong key, tampering or a userId that does not match the row. */
export function openIdentityEnvelope(
  rawEnvelope: string,
  userId: string,
  privateKey: { key: KeyObject; keyId: string },
): IdentityRetentionPayload {
  const envelope = parseEnvelope(rawEnvelope);
  if (envelope.kid !== privateKey.keyId) throw new IdentityRetentionKeyError("KEY_MISMATCH");
  const dataKey = privateDecrypt(
    { key: privateKey.key, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
    Buffer.from(envelope.ek, "base64"),
  );
  try {
    const tag = Buffer.from(envelope.tag, "base64");
    if (tag.length !== 16) throw new IdentityRetentionKeyError("MALFORMED_ENVELOPE");
    const decipher = createDecipheriv("aes-256-gcm", dataKey, Buffer.from(envelope.iv, "base64"), {
      authTagLength: 16,
    });
    decipher.setAAD(aadFor(userId));
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(Buffer.from(envelope.ct, "base64")), decipher.final()]);
    try {
      const parsed: unknown = JSON.parse(plain.toString("utf8"));
      return validateIdentityPayload(parsed, userId);
    } catch {
      throw new IdentityRetentionKeyError("MALFORMED_ENVELOPE");
    } finally {
      plain.fill(0);
    }
  } finally {
    dataKey.fill(0);
  }
}

/** Retention ends one calendar year after the agreement ended (Feb 29 rolls to Mar 1 — never shorter). */
export function identityRetentionPurgeAfter(agreementEndedAt: Date): Date {
  const purgeAfter = new Date(agreementEndedAt.getTime());
  purgeAfter.setUTCFullYear(purgeAfter.getUTCFullYear() + 1);
  return purgeAfter;
}

type IdentitySource = {
  id: string;
  email: string;
  emailVerifiedAt: Date | null;
  phoneE164: string | null;
  phoneVerifiedAt: Date | null;
  businessContactVerifiedPhoneE164: string | null;
  businessContactPhoneVerifiedAt: Date | null;
  displayName: string | null;
  telegramId: string | null;
  telegramUsername: string | null;
  createdAt: Date;
};

export function buildIdentityPayload(user: IdentitySource, agreementEndedAt: Date): IdentityRetentionPayload {
  const iso = (d: Date | null) => (d ? d.toISOString() : null);
  return {
    schemaVersion: 1,
    userId: user.id,
    email: user.email,
    emailVerifiedAt: iso(user.emailVerifiedAt),
    phoneE164: user.phoneE164,
    phoneVerifiedAt: iso(user.phoneVerifiedAt),
    businessContactPhoneE164: user.businessContactVerifiedPhoneE164,
    businessContactPhoneVerifiedAt: iso(user.businessContactPhoneVerifiedAt),
    displayName: user.displayName,
    telegramId: user.telegramId,
    telegramUsername: user.telegramUsername,
    accountCreatedAt: user.createdAt.toISOString(),
    agreementEndedAt: agreementEndedAt.toISOString(),
  };
}

export const IDENTITY_SOURCE_SELECT = {
  id: true,
  email: true,
  emailVerifiedAt: true,
  phoneE164: true,
  phoneVerifiedAt: true,
  businessContactVerifiedPhoneE164: true,
  businessContactPhoneVerifiedAt: true,
  displayName: true,
  telegramId: true,
  telegramUsername: true,
  createdAt: true,
} as const;

const digitsOnly = (value: string) => value.replace(/\D/g, "");

/** Operator lookup by phone (account or verified business contact) or email; phone compares digits only. */
export function matchesIdentitySelector(
  payload: IdentityRetentionPayload,
  selector: { phone?: string | null; email?: string | null },
): boolean {
  if (selector.phone) {
    const wanted = digitsOnly(selector.phone);
    if (!wanted) return false;
    return [payload.phoneE164, payload.businessContactPhoneE164].some((p) => p !== null && digitsOnly(p) === wanted);
  }
  if (selector.email) return payload.email?.trim().toLowerCase() === selector.email.trim().toLowerCase();
  return false;
}
