import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import { resolveEventOrganizer } from "./eventOrganizer";

function mockDb(existingBusinessId: string | null) {
  const writes = {
    businesses: 0,
    users: 0,
    organizers: 0,
  };
  let lastOrganizerData: Record<string, unknown> | null = null;

  const prisma = {
    user: {
      create: async () => {
        writes.users++;
        throw new Error("Organizer resolution must not create technical users");
      },
    },
    business: {
      findFirst: async ({ where }: { where: { unp: string } }) => {
        assert.equal(where.unp, "693344712");
        return existingBusinessId ? { id: existingBusinessId } : null;
      },
      create: async () => {
        writes.businesses++;
        throw new Error("Organizer resolution must not create businesses");
      },
    },
    organizer: {
      findFirst: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        writes.organizers++;
        lastOrganizerData = data;
        return {
          id: "organizer-test",
          name: data.name,
          unp: data.unp,
          phone: data.phone,
          website: data.website,
          instagram: data.instagram,
          createdFrom: data.createdFrom,
        };
      },
    },
  } as unknown as PrismaClient;

  return { prisma, writes, getOrganizerData: () => lastOrganizerData };
}

test("new organizer with УНП does not create phantom Business or User", async () => {
  const db = mockDb(null);
  const result = await resolveEventOrganizer(db.prisma, {
    mode: "import",
    name: "Тестовый организатор",
    unp: "693344712",
  });

  assert.equal(result.organizerId, "organizer-test");
  assert.equal(result.organizerSnapshot?.unp, "693344712");
  assert.deepEqual(db.writes, { businesses: 0, users: 0, organizers: 1 });
  assert.equal(db.getOrganizerData()?.linkedBusinessId, null);
});

test("new organizer links existing Business without creating additional identity", async () => {
  const db = mockDb("existing-business");
  await resolveEventOrganizer(db.prisma, {
    mode: "manual",
    name: "Тестовый организатор",
    unp: "693344712",
  });

  assert.deepEqual(db.writes, { businesses: 0, users: 0, organizers: 1 });
  assert.equal(db.getOrganizerData()?.linkedBusinessId, "existing-business");
});
