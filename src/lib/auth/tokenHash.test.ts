import assert from "node:assert/strict";

import { generateRawToken, hashToken } from "./tokenHash";

// --- generateRawToken ---

{
  const token = generateRawToken();
  assert.equal(token.length, 64, "raw token should be 64 chars long");
  assert.match(token, /^[0-9a-f]{64}$/u, "raw token should be hex");
}

{
  const token1 = generateRawToken();
  const token2 = generateRawToken();
  assert.notEqual(token1, token2, "tokens should be unique");
}

// --- hashToken ---

{
  const hash = hashToken("some-token");
  assert.equal(hash.length, 64, "hash should be 64 chars long");
  assert.match(hash, /^[0-9a-f]{64}$/u, "hash should be hex");
}

// Deterministic — same input always produces same hash
{
  const token = "test-token-123";
  const hash1 = hashToken(token);
  const hash2 = hashToken(token);
  assert.equal(hash1, hash2, "hash should be deterministic");
}

// Raw token != its hash
{
  const token = generateRawToken();
  const hash = hashToken(token);
  assert.notEqual(token, hash, "raw token should differ from its hash");
}

// Different tokens produce different hashes
{
  const hash1 = hashToken("token-a");
  const hash2 = hashToken("token-b");
  assert.notEqual(hash1, hash2, "different tokens should produce different hashes");
}

// --- Integration ---

// Invalid token should not match stored hash
{
  const raw = generateRawToken();
  const storedHash = hashToken(raw);
  const invalidHash = hashToken("wrong-token");
  assert.notEqual(storedHash, invalidHash, "invalid token hash should not match stored hash");
}

// Hashing the same raw token twice matches
{
  const raw = generateRawToken();
  const hash1 = hashToken(raw);
  const hash2 = hashToken(raw);
  assert.equal(hash1, hash2, "hashing same token twice should match");
}
