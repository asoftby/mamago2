import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { OfferProductType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getReleaseScopedPublicOfferWhere,
} from "@/server/public/publicContentVisibility";
import {
  createCollection,
  saveIdeaWithCollections,
  setIdeaCollections,
  getIdeaCollectionIds,
} from "@/server/services/ideaCollections.service";

async function main() {
  const marker = randomUUID();
  const previousEnv = process.env.APP_ENV;

  const user = await prisma.user.create({
    data: {
      email: `release-scope-${marker}@example.invalid`,
    },
  });

  const offerIds: string[] = [];
  let placeId: string | undefined;

  try {
    const place = await prisma.place.create({
      data: {
        title: `Release scope ${marker}`,
        shortDesc: "Synthetic integration fixture",
        status: "PUBLISHED",
        createdByUserId: user.id,
      },
    });

    placeId = place.id;

    const types = [
      ...Object.values(OfferProductType),
      null,
    ];

    const offers = [];

    for (const productType of types) {
      const offer = await prisma.offer.create({
        data: {
          kind: "SERVICE",
          productType,
          title: `${productType ?? "LEGACY"} ${marker}`,
          status: "PUBLISHED",
          placeId: place.id,
        },
      });

      offers.push(offer);
      offerIds.push(offer.id);
    }

    process.env.APP_ENV = "dev";

    const dev = await prisma.offer.findMany({
      where: {
        AND: [
          { id: { in: offerIds } },
          getReleaseScopedPublicOfferWhere(),
        ],
      },
    });

    assert.equal(dev.length, types.length);

    const collection = await createCollection(
      user.id,
      "Release scope",
    );

    const existing = offers.find(
      (offer) => offer.productType === "REGULAR_ACTIVITY",
    )!;

    await saveIdeaWithCollections(
      user.id,
      { kind: "OFFER", id: existing.id },
      [collection.id],
    );

    process.env.APP_ENV = "production";

    const prod = await prisma.offer.findMany({
      where: {
        AND: [
          { id: { in: offerIds } },
          getReleaseScopedPublicOfferWhere(),
        ],
      },
    });

    assert.deepEqual(
      prod.map((offer) => offer.productType),
      ["PLACE_VISIT"],
    );

    for (const offer of offers) {
      const target = {
        kind: "OFFER" as const,
        id: offer.id,
      };

      if (offer.productType === "PLACE_VISIT") {
        await saveIdeaWithCollections(
          user.id,
          target,
          [collection.id],
        );

        assert.deepEqual(
          await getIdeaCollectionIds(user.id, target),
          [collection.id],
        );
      } else if (offer.id !== existing.id) {
        await assert.rejects(
          saveIdeaWithCollections(
            user.id,
            target,
            [collection.id],
          ),
          {
            name: "IdeaCollectionError",
            code: "IDEA_NOT_FOUND",
            status: 404,
          },
        );

        assert.equal(
          await prisma.offerIdea.count({
            where: {
              userId: user.id,
              offerId: offer.id,
            },
          }),
          0,
        );
      }

      console.log(
        "[PASS] PROD release scope:",
        offer.productType ?? "LEGACY_NULL",
      );
    }

    // Existing saved ideas remain manageable in PROD.
    await setIdeaCollections(
      user.id,
      { kind: "OFFER", id: existing.id },
      [],
    );

    assert.equal(
      await prisma.offerIdea.count({
        where: {
          userId: user.id,
          offerId: existing.id,
        },
      }),
      1,
    );

    console.log("[PASS] Existing saved ideas preserved");
    console.log("publicReleaseScope.integration.test: OK");
  } finally {
    if (previousEnv === undefined) {
      delete process.env.APP_ENV;
    } else {
      process.env.APP_ENV = previousEnv;
    }

    await prisma.offerIdea.deleteMany({
      where: { userId: user.id },
    });

    await prisma.offer.deleteMany({
      where: { id: { in: offerIds } },
    });

    if (placeId) {
      await prisma.place.delete({
        where: { id: placeId },
      });
    }

    await prisma.user.delete({
      where: { id: user.id },
    });

    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
