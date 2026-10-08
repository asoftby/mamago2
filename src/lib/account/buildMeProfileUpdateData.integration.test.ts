import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { buildMeProfileUpdateData } from "./buildMeProfileUpdateData";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL must point at an isolated test database");
const prisma = new PrismaClient({ datasourceUrl: databaseUrl });

async function main() {
  const user = await prisma.user.create({
    data: {
      email: `family-role-${randomUUID()}@example.invalid`,
      familyRole: "MOM",
      ageBandLabel: "35–44",
    },
  });
  try {
    const clearedWithNull = await prisma.user.update({
      where: { id: user.id },
      data: buildMeProfileUpdateData({ familyRole: null }),
    });
    assert.equal(clearedWithNull.familyRole, null);
    assert.equal(clearedWithNull.ageBandLabel, "35–44");

    await prisma.user.update({ where: { id: user.id }, data: { familyRole: "MOM" } });
    const omitted = await prisma.user.update({
      where: { id: user.id },
      data: buildMeProfileUpdateData({}),
    });
    assert.equal(omitted.familyRole, "MOM");

    const clearedWithEmpty = await prisma.user.update({
      where: { id: user.id },
      data: buildMeProfileUpdateData({ familyRole: "" }),
    });
    assert.equal(clearedWithEmpty.familyRole, null);
    assert.equal(clearedWithEmpty.ageBandLabel, "35–44");
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  }
}

main()
  .then(() => console.log("buildMeProfileUpdateData.integration.test.ts: OK"))
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
