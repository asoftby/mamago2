/**
 * Test-only helper: installs a throwaway RSA key as IDENTITY_RETENTION_PUBLIC_KEY
 * so deleteAccount integration tests can seal identity records. Never used at runtime.
 */
import { generateKeyPairSync } from "node:crypto";
import { IDENTITY_RETENTION_PUBLIC_KEY_ENV, loadPrivateKey } from "./envelope";

export function installTestIdentityRetentionKey() {
  const pair = generateKeyPairSync("rsa", {
    modulusLength: 4096,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  process.env[IDENTITY_RETENTION_PUBLIC_KEY_ENV] = pair.publicKey;
  return { publicKeyPem: pair.publicKey, privateKey: loadPrivateKey(pair.privateKey) };
}
