import assert from "node:assert/strict";
import { isSessionEligibleAccount, isSessionEligibleStatus } from "./accountEligibility";
import { verifyLoginPassword } from "./credentials";
import { hashPassword } from "./crypto";
import { DISABLED_PASSWORD_HASH } from "./crypto";
import type { UserStatus } from "@prisma/client";

async function main(): Promise<void> {
  assert.equal(isSessionEligibleStatus("ACTIVE"), true);
  assert.equal(isSessionEligibleStatus("LIMITED"), true);
  assert.equal(isSessionEligibleStatus("PENDING_ACTIVATION"), false);
  assert.equal(isSessionEligibleStatus("SUSPENDED"), false);
  assert.equal(isSessionEligibleStatus("BANNED"), false);
  assert.equal(isSessionEligibleStatus("FUTURE_STATUS" as UserStatus), false);

  assert.equal(isSessionEligibleAccount({ status: "ACTIVE", deletedAt: null }), true);
  assert.equal(
    isSessionEligibleAccount({ status: "ACTIVE", deletedAt: new Date() }),
    false,
  );

  const password = "Foundation-pass-123";
  const passwordHash = await hashPassword(password);

  assert.equal(
    await verifyLoginPassword(password, {
      status: "ACTIVE",
      deletedAt: null,
      passwordHash,
    }),
    true,
  );
  assert.equal(
    await verifyLoginPassword("wrong", {
      status: "ACTIVE",
      deletedAt: null,
      passwordHash,
    }),
    false,
  );
  assert.equal(
    await verifyLoginPassword(password, {
      status: "PENDING_ACTIVATION",
      deletedAt: null,
      passwordHash,
    }),
    false,
  );
  assert.equal(
    await verifyLoginPassword(password, {
      status: "ACTIVE",
      deletedAt: null,
      passwordHash: null,
    }),
    false,
  );
  assert.equal(await verifyLoginPassword(password, null), false);
  assert.equal(
    await verifyLoginPassword(password, {
      status: "ACTIVE",
      deletedAt: null,
      passwordHash: DISABLED_PASSWORD_HASH,
    }),
    false,
  );
  assert.equal(
    await verifyLoginPassword(password, {
      status: "ACTIVE",
      deletedAt: null,
      passwordHash: "",
    }),
    false,
  );

  let dummyComparisons = 0;
  const recordingVerifier = async (_password: string, hash: string): Promise<boolean> => {
    dummyComparisons += 1;
    assert.match(hash, /^\$2[aby]\$12\$/u);
    return false;
  };
  assert.equal(await verifyLoginPassword(password, null, recordingVerifier), false);
  assert.equal(
    await verifyLoginPassword(
      password,
      { status: "ACTIVE", deletedAt: null, passwordHash: null },
      recordingVerifier,
    ),
    false,
  );
  assert.equal(dummyComparisons, 2);

  console.log("account eligibility tests: OK");
}

main().catch((error) => {
  console.error("account eligibility tests: FAILED", error);
  process.exitCode = 1;
});
