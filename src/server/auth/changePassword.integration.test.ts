import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { hashPassword, verifyPassword } from "@/lib/auth/crypto";
import { createSession, validateSession } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import { changePassword } from "./changePassword.service";

async function main(): Promise<void> {
  const email = `password-change-${randomUUID()}@example.invalid`;
  const currentPassword = "Current-pass-123";
  const newPassword = "Replacement-pass-456";
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(currentPassword),
      status: "ACTIVE",
      lastLoginAt: new Date(),
    },
    select: { id: true },
  });

  try {
    const browserSession = await createSession(user.id);
    const otherDeviceSession = await createSession(user.id);
    const authenticatedUser = await validateSession(browserSession);
    assert.ok(authenticatedUser);
    assert.equal(authenticatedUser.id, user.id);
    const original = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { passwordHash: true },
    });

    assert.deepEqual(
      await changePassword({
        userId: authenticatedUser.id,
        currentPassword: "Wrong-current-pass-123",
        newPassword,
      }),
      { changed: false, reason: "WRONG_CURRENT_PASSWORD" },
    );
    assert.equal(
      (await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).passwordHash,
      original.passwordHash,
    );
    assert.ok(await validateSession(browserSession));
    assert.ok(await validateSession(otherDeviceSession));

    await assert.rejects(
      changePassword({
        userId: authenticatedUser.id,
        currentPassword,
        newPassword: "short1",
      }),
    );
    assert.equal(
      (await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).passwordHash,
      original.passwordHash,
    );
    assert.equal(await prisma.session.count({ where: { userId: user.id } }), 2);

    assert.deepEqual(
      await changePassword({
        userId: authenticatedUser.id,
        currentPassword,
        newPassword,
      }),
      { changed: true },
    );

    const changed = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    assert.ok(changed.passwordHash);
    assert.equal(await verifyPassword(newPassword, changed.passwordHash), true);
    assert.equal(await verifyPassword(currentPassword, changed.passwordHash), false);
    assert.equal(await prisma.session.count({ where: { userId: user.id } }), 0);
    assert.equal(await validateSession(browserSession), null);
    assert.equal(await validateSession(otherDeviceSession), null);
  } finally {
    await prisma.user.deleteMany({ where: { id: user.id } });
    await prisma.$disconnect();
  }

  console.log("changePassword.integration.test.ts: OK");
}

main().catch((error) => {
  console.error("changePassword.integration.test.ts: FAILED", error);
  process.exitCode = 1;
});
