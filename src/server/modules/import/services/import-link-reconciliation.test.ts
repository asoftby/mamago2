import assert from "node:assert/strict";
import { Prisma, ContentStatus } from "@prisma/client";
import {
  getImportedRecordLinkState,
  isActivityLinkActive,
  isPlaceLinkActive,
  planImportedRecordLinkReconciliation,
} from "./import-link-reconciliation.service";

{
  assert.equal(isActivityLinkActive({ id: "a1", status: ContentStatus.PUBLISHED }), true);
  assert.equal(isActivityLinkActive({ id: "a2", status: ContentStatus.DELETED }), false);
  assert.equal(
    isPlaceLinkActive({
      id: "p1",
      status: ContentStatus.PUBLISHED,
      archivedAt: null,
    }),
    true,
  );
  assert.equal(
    isPlaceLinkActive({
      id: "p2",
      status: ContentStatus.PUBLISHED,
      archivedAt: new Date(),
    }),
    false,
  );
}

{
  const plan = planImportedRecordLinkReconciliation({
    record: {
      id: "rec-1",
      publishedPlaceId: null,
      publishedActivityId: "act-1",
      reviewDecision: {
        decision: "APPROVED_UPDATE",
        targetEntityId: "act-1",
        targetEntityType: "ACTIVITY",
        reviewedAt: "2026-01-01T00:00:00.000Z",
        reviewerUserId: "user-1",
      },
      applyResult: {
        appliedAt: "2026-01-01T00:00:00.000Z",
        appliedByUserId: "user-1",
        decision: "APPROVED_UPDATE",
        placeId: "act-1",
        appliedFields: [],
        skippedFields: [],
        emptyFields: [],
      },
    },
    place: null,
    activity: null,
    detachedAt: "2026-02-01T00:00:00.000Z",
  });

  assert.equal(plan.changed, true);
  assert.equal(plan.updates.publishedActivityId, null);
  assert.equal(plan.updates.applyResult, Prisma.JsonNull);

  const reviewDecision = plan.updates.reviewDecision as { recovery?: { invalidLinkedEntityId: string } };
  assert.equal(reviewDecision.recovery?.invalidLinkedEntityId, "act-1");

  const recovered = getImportedRecordLinkState({
    id: "rec-1",
    publishedPlaceId: null,
    publishedActivityId: null,
    reviewDecision,
    applyResult: null,
  });

  assert.equal(recovered.kind, "RECOVERED");
}

{
  const plan = planImportedRecordLinkReconciliation({
    record: {
      id: "rec-2",
      publishedPlaceId: null,
      publishedActivityId: "act-2",
      reviewDecision: null,
      applyResult: null,
    },
    place: null,
    activity: { id: "act-2", status: ContentStatus.PUBLISHED },
  });

  assert.equal(plan.changed, false);
}

console.log("import-link-reconciliation tests: OK");
