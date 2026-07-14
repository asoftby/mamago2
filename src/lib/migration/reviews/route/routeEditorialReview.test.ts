import assert from "node:assert/strict";

import {
  buildRouteEditorialReview,
  buildRouteReviewApplyPlan,
  proposeShortRouteStopNote,
  renderRouteEditorialReviewMarkdown,
  type RouteReviewPrismaClient,
} from "./routeEditorialReview";

function createFakePrisma(): RouteReviewPrismaClient {
  return {
    migrationLineage: {
      findMany: async () => [
        {
          sourceRecordKey: "wordpress-db:routes:701",
          targetId: "route-1",
          record: {
            status: "LINKED",
            validationSummary: [
              {
                code: "ROUTE_LEVEL_LOCATION_DROPPED",
                message: "Location kept as evidence.",
                severity: "INFO",
              },
            ],
          },
        },
      ],
    } as unknown as RouteReviewPrismaClient["migrationLineage"],
    route: {
      findMany: async () => [
        {
          id: "route-1",
          title: "Family Route",
          slug: "family-route",
          cityId: "city-1",
          status: "DRAFT",
          visibility: "PRIVATE",
          authorId: null,
          stops: [
            {
              id: "stop-2",
              order: 2,
              customTitle: "Second",
              note: "Short note",
              photoUrl: null,
            },
            {
              id: "stop-1",
              order: 1,
              customTitle: "First",
              note:
                "<p>This is a very long imported note with useful family context. " +
                "It has a second practical sentence that should survive. " +
                "It also has extra SEO wording that can be left for manual review after shortening.</p>",
              photoUrl: "/media/first.jpg",
            },
          ].sort((a, b) => a.order - b.order),
        },
      ],
    } as unknown as RouteReviewPrismaClient["route"],
  };
}

async function testBuildReviewCollectsRouteStopsInOrder() {
  const report = await buildRouteEditorialReview(createFakePrisma(), new Date("2026-07-13T00:00:00.000Z"));

  assert.equal(report.actualRouteCount, 1);
  assert.equal(report.activeLineageCount, 1);
  assert.equal(report.routes[0].sourceRecordKey, "wordpress-db:routes:701");
  assert.equal(report.routes[0].legacyWpId, 701);
  assert.equal(report.routes[0].stopCount, 2);
  assert.equal(report.routes[0].stopsWithPhotoUrl, 1);
  assert.deepEqual(report.routes[0].stops.map((stop) => stop.order), [1, 2]);
  assert.equal(report.routes[0].status, "DRAFT");
  assert.equal(report.routes[0].visibility, "PRIVATE");
  assert.equal(report.routes[0].authorId, null);
}

async function testAbsentIsEditorialFieldIsNotABlocker() {
  // Confirmed 2026-07-13: no isEditorial schema field is being added;
  // authorId === null is the sole editorial marker. A route with no other
  // problems must not be BLOCKED just because Prisma has no such column.
  const report = await buildRouteEditorialReview(createFakePrisma());

  assert.ok(!report.routes[0].blockers.some((blocker) => blocker.startsWith("ROUTE_ISEDITORIAL_FIELD_MISSING")));
  // This fixture's stop-1 note is long/has markup, so it still lands on
  // NEEDS_COPY_REVIEW rather than READY — that's the copy-shortening rule,
  // unrelated to the (now-removed) editorial-field blocker.
  assert.equal(report.routes[0].decision, "NEEDS_COPY_REVIEW");
  assert.equal(report.decisionCounts.NEEDS_COPY_REVIEW, 1);
  assert.equal(report.decisionCounts.BLOCKED, 0);
}

function testNoteProposalShortensLongMarkupWithoutInventingFacts() {
  const source =
    "<p>Visit the playground first because it is close to the entrance and easy with children. " +
    "Then walk to the cafe nearby. " +
    "This sentence is extra promotional filler that should not be needed for the short note.</p>";

  const proposal = proposeShortRouteStopNote(source);

  assert.equal(proposal.status, "NEEDS_COPY_REVIEW");
  assert.ok(proposal.proposedNote.length <= 300);
  assert.ok(proposal.proposedNote.includes("playground"));
  assert.ok(!proposal.proposedNote.includes("<p>"));
}

async function testApplyPlanContainsOnlyChangedStopNotes() {
  const report = await buildRouteEditorialReview(createFakePrisma());
  const plan = buildRouteReviewApplyPlan(report);

  assert.equal(plan.routes.length, 1);
  assert.equal(plan.routes[0].decision, "NEEDS_COPY_REVIEW");
  assert.equal(plan.routes[0].proposed.status, "PUBLISHED");
  assert.equal(plan.routes[0].proposed.visibility, "PUBLIC");
  assert.equal(plan.routes[0].proposed.authorId, null);
  assert.equal(plan.routes[0].proposed.isEditorial, true);
  assert.equal(plan.routes[0].stopNoteChanges.length, 1);
  assert.equal(plan.routes[0].stopNoteChanges[0].routeStopId, "stop-1");
}

async function testMarkdownRendersReviewArtifact() {
  const report = await buildRouteEditorialReview(createFakePrisma(), new Date("2026-07-13T00:00:00.000Z"));
  const markdown = renderRouteEditorialReviewMarkdown(report);

  assert.match(markdown, /Route Editorial Review/);
  assert.match(markdown, /wordpress-db:routes:701/);
  assert.match(markdown, /NEEDS_COPY_REVIEW/);
  assert.match(markdown, /Proposed short note/);
}

async function main() {
  await testBuildReviewCollectsRouteStopsInOrder();
  await testAbsentIsEditorialFieldIsNotABlocker();
  testNoteProposalShortensLongMarkupWithoutInventingFacts();
  await testApplyPlanContainsOnlyChangedStopNotes();
  await testMarkdownRendersReviewArtifact();
}

main().then(() => console.log("routeEditorialReview tests: OK"));
