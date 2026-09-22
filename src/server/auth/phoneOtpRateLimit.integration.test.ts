import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { checkActivationRateLimit } from "./activationRateLimit";

async function main() {
  const key = `test:otp:sms:concurrency:${randomUUID()}`;
  try {
    const results = await Promise.all(
      Array.from({ length: 40 }, () =>
        checkActivationRateLimit({
          key,
          limit: 30,
          windowMs: 60_000,
        }),
      ),
    );

    assert.equal(
      results.filter((result) => result.allowed).length,
      30,
      "atomic persistent limiter must allow no more than the configured ceiling",
    );
    assert.equal(
      (await prisma.rateLimitEntry.findUnique({ where: { key } }))?.count,
      40,
      "every concurrent attempt must be counted",
    );
    console.log("phone OTP persistent concurrency limit test: OK");
  } finally {
    await prisma.rateLimitEntry.deleteMany({ where: { key } });
    await prisma.$disconnect();
  }
}

void main();
