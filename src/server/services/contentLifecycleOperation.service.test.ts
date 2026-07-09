import assert from "node:assert/strict";
import { ContentStatus, OfferStatus, RouteStatus } from "@prisma/client";
import {
  canPerformContentLifecycleOperation,
  contentLifecycleResultToError,
  lifecycleErrorResponsePayload,
} from "./contentLifecycleOperation.service";

type ModelRows = Record<string, unknown>;

function model(row: unknown) {
  return {
    findUnique: async () => row,
    count: async () => 0,
    groupBy: async () => [],
  };
}

function fakePrisma(rows: ModelRows) {
  return new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop in rows) {
          return model(rows[prop]);
        }
        return model(null);
      },
    },
  ) as never;
}

async function main() {
  const isolatedDraftPrisma = fakePrisma({
    place: {
      status: ContentStatus.DRAFT,
      archivedAt: null,
    },
    offer: {
      status: OfferStatus.DRAFT,
      publishedAt: null,
      archivedAt: null,
      rejectionReason: null,
    },
    article: {
      status: ContentStatus.DRAFT,
      publishedAt: null,
    },
  });

  assert.equal(
    (
      await canPerformContentLifecycleOperation({
        contentType: "PLACE",
        contentId: "place-draft",
        operation: "deleteDraft",
        prisma: isolatedDraftPrisma,
      })
    ).allowed,
    true,
  );

  assert.equal(
    (
      await canPerformContentLifecycleOperation({
        contentType: "OFFER",
        contentId: "offer-draft",
        operation: "deleteDraft",
        prisma: isolatedDraftPrisma,
      })
    ).allowed,
    true,
  );

  assert.equal(
    (
      await canPerformContentLifecycleOperation({
        contentType: "ARTICLE",
        contentId: "article-draft",
        operation: "deleteDraft",
        prisma: isolatedDraftPrisma,
      })
    ).allowed,
    true,
  );

  const publishedPlace = await canPerformContentLifecycleOperation({
    contentType: "PLACE",
    contentId: "place-published",
    operation: "deleteDraft",
    prisma: fakePrisma({
      place: {
        status: ContentStatus.PUBLISHED,
        archivedAt: null,
      },
    }),
  });

  assert.equal(publishedPlace.allowed, false);
  assert.equal(publishedPlace.code, "CONTENT_HARD_DELETE_BLOCKED");
  assert.ok(publishedPlace.reasons?.includes("statusNotDraft"));

  const draftWithOwnedDataPrisma = fakePrisma({
    place: {
      status: ContentStatus.DRAFT,
      archivedAt: null,
    },
  });

  assert.equal(
    (
      await canPerformContentLifecycleOperation({
        contentType: "PLACE",
        contentId: "place-draft-with-owned-data",
        operation: "deleteDraft",
        prisma: draftWithOwnedDataPrisma,
      })
    ).allowed,
    true,
  );

  const draftWithOffersPrisma = new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop === "place") {
          return {
            findUnique: async () => ({
              status: ContentStatus.DRAFT,
              archivedAt: null,
            }),
            count: async () => 0,
          };
        }
        return {
          findUnique: async () => null,
          count: async (args?: { where?: Record<string, unknown> }) => {
            if (prop === "offer" && args?.where?.placeId) return 1;
            return 0;
          },
        };
      },
    },
  ) as never;

  const draftWithOffers = await canPerformContentLifecycleOperation({
    contentType: "PLACE",
    contentId: "place-draft-with-offers",
    operation: "deleteDraft",
    prisma: draftWithOffersPrisma,
  });

  assert.equal(draftWithOffers.allowed, false);
  assert.ok(draftWithOffers.reasons?.includes("offers"));

  const publishedEvent = await canPerformContentLifecycleOperation({
    contentType: "ACTIVITY",
    contentId: "event-published",
    operation: "deleteDraft",
    prisma: fakePrisma({
      activity: {
        status: ContentStatus.PUBLISHED,
      },
    }),
  });

  assert.equal(publishedEvent.allowed, false);
  assert.ok(publishedEvent.reasons?.includes("statusNotDraft"));

  const publishedRoute = await canPerformContentLifecycleOperation({
    contentType: "ROUTE",
    contentId: "route-published",
    operation: "deleteDraft",
    status: RouteStatus.PUBLISHED,
    prisma: fakePrisma({
      route: {
        status: RouteStatus.PUBLISHED,
        _count: {
          planItems: 0,
          ratings: 0,
          routeIdeas: 0,
        },
      },
    }),
  });

  assert.equal(publishedRoute.allowed, false);
  assert.ok(publishedRoute.reasons?.includes("statusNotDraft"));

  const archiveDraft = await canPerformContentLifecycleOperation({
    contentType: "OFFER",
    contentId: "offer-draft",
    operation: "archiveContent",
    status: OfferStatus.DRAFT,
    prisma: isolatedDraftPrisma,
  });

  assert.equal(archiveDraft.allowed, false);
  assert.equal(archiveDraft.code, "CONTENT_ARCHIVE_NOT_ALLOWED_FOR_DRAFT");

  const archivedOfferDelete = await canPerformContentLifecycleOperation({
    contentType: "OFFER",
    contentId: "offer-archived",
    operation: "deleteArchived",
    actorRole: "ADMIN",
    prisma: fakePrisma({
      offer: {
        status: OfferStatus.PUBLISHED,
        archivedAt: new Date("2026-01-01"),
      },
    }),
  });

  assert.equal(archivedOfferDelete.allowed, true);

  const archivedOfferModeratorDelete = await canPerformContentLifecycleOperation({
    contentType: "OFFER",
    contentId: "offer-archived",
    operation: "deleteArchived",
    actorRole: "MODERATOR",
    prisma: fakePrisma({
      offer: {
        status: OfferStatus.PUBLISHED,
        archivedAt: new Date("2026-01-01"),
      },
    }),
  });

  assert.equal(archivedOfferModeratorDelete.allowed, false);
  assert.equal(archivedOfferModeratorDelete.code, "CONTENT_DELETE_ARCHIVED_ADMIN_ONLY");

  const publishedDeleteArchived = await canPerformContentLifecycleOperation({
    contentType: "PLACE",
    contentId: "place-published",
    operation: "deleteArchived",
    actorRole: "ADMIN",
    prisma: fakePrisma({
      place: {
        status: ContentStatus.PUBLISHED,
        archivedAt: null,
      },
    }),
  });

  assert.equal(publishedDeleteArchived.allowed, false);
  assert.ok(publishedDeleteArchived.reasons?.includes("notArchived"));

  const archivedActivityPrisma = fakePrisma({
    activity: {
      status: ContentStatus.ARCHIVED,
    },
  });

  const archivedActivityNoRole = await canPerformContentLifecycleOperation({
    contentType: "EVENT",
    contentId: "event-archived",
    operation: "deleteArchived",
    prisma: archivedActivityPrisma,
  });

  assert.equal(archivedActivityNoRole.allowed, false);
  assert.equal(archivedActivityNoRole.code, "CONTENT_DELETE_ARCHIVED_ADMIN_ONLY");

  const archivedActivityBusinessOwner = await canPerformContentLifecycleOperation({
    contentType: "ACTIVITY",
    contentId: "event-archived",
    operation: "deleteArchived",
    actorRole: "BUSINESS_OWNER",
    prisma: archivedActivityPrisma,
  });

  assert.equal(archivedActivityBusinessOwner.allowed, false);
  assert.equal(
    archivedActivityBusinessOwner.code,
    "CONTENT_DELETE_ARCHIVED_ADMIN_ONLY",
  );

  const archivedActivityModerator = await canPerformContentLifecycleOperation({
    contentType: "EVENT",
    contentId: "event-archived",
    operation: "deleteArchived",
    actorRole: "MODERATOR",
    prisma: archivedActivityPrisma,
  });

  assert.equal(archivedActivityModerator.allowed, false);
  assert.equal(archivedActivityModerator.code, "CONTENT_DELETE_ARCHIVED_ADMIN_ONLY");

  const archivedActivityAdmin = await canPerformContentLifecycleOperation({
    contentType: "ACTIVITY",
    contentId: "event-archived",
    operation: "deleteArchived",
    actorRole: "ADMIN",
    prisma: archivedActivityPrisma,
  });

  assert.equal(archivedActivityAdmin.allowed, true);

  const archivedOfferNoRole = await canPerformContentLifecycleOperation({
    contentType: "OFFER",
    contentId: "offer-archived",
    operation: "deleteArchived",
    prisma: fakePrisma({
      offer: {
        status: OfferStatus.PUBLISHED,
        archivedAt: new Date("2026-01-01"),
      },
    }),
  });

  assert.equal(archivedOfferNoRole.allowed, false);
  assert.equal(archivedOfferNoRole.code, "CONTENT_DELETE_ARCHIVED_ADMIN_ONLY");

  const errorPayload = lifecycleErrorResponsePayload(
    contentLifecycleResultToError(publishedRoute),
  );

  assert.equal(errorPayload.code, "CONTENT_HARD_DELETE_BLOCKED");
  assert.equal(typeof errorPayload.message, "string");
  assert.ok(errorPayload.reasons?.includes("statusNotDraft"));

  console.log("contentLifecycleOperation tests passed");
}

void main();
