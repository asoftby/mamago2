import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PrismaClient } from "@prisma/client";
import type { PlacesWriterPrismaClient } from "./placesProductionWiring";

import { SequentialEntityPhaseAdapter } from "../adapter";
import type { PhoenixPhaseAdapter, PhoenixPhaseName, PhoenixReleaseManifest } from "../types";

import { OffersPhaseExecutor } from "./offersAdapter";
import { createOffersDependencyResolver, createOffersLoadCandidate, createOffersTargetStateResolver, createOffersWriter } from "./offersProductionWiring";
import { FrozenOfferSourceRepository } from "./frozenOfferSourceRepository";

import { ArticlesPhaseExecutor } from "./articlesAdapter";
import { createArticlesTargetStateResolver, createArticlesWriter } from "./articlesProductionWiring";
import { FrozenArticleSourceRepository } from "./frozenArticleSourceRepository";

import { EventsFreshTargetPhaseAdapter, EventsPhaseExecutor } from "./eventsAdapter";
import { createEventsCandidateLoader, createEventsPhasePreflight, createEventsTargetStateResolver, createEventsWriter } from "./eventsProductionWiring";
import { FrozenEventSourceRepository } from "./frozenEventSourceRepository";

import { RoutesPhaseExecutor } from "./routesAdapter";
import { createRoutesCandidateLoader, createRoutesTargetStateResolver, createRoutesWriter } from "./routesProductionWiring";
import { FrozenRouteSourceRepository } from "./frozenRouteSourceRepository";

import { PlacesPhaseExecutor } from "./placesAdapter";
import { createPlacesDependencyResolver, createPlacesLoadCandidate, createPlacesTargetStateResolver, createPlacesWriter } from "./placesProductionWiring";
import { FrozenPlaceSourceRepository } from "./frozenPlaceSourceRepository";

import { UsersPhaseExecutor } from "./usersAdapter";
import { FrozenUserSourceRepository, createUsersDependencies } from "./usersProductionWiring";
import { BusinessesProductionExecutor } from "./businessesProductionWiring";

/**
 * One production adapter registry, used identically for LOCAL, DEV and
 * PROD — the only thing that differs by environment is the config passed
 * in (`prisma`, `artifactRoot`, media policy), never the registry's own
 * logic or which adapters exist. No historical one-off CLI is invoked
 * here; every entry wires a `PhoenixPhaseAdapter` to the same production
 * pipeline already proven by that entity's own golden proof
 * (`scripts/phoenix-*-golden-proof.ts`).
 *
 * Businesses uses the approved base/override manifest as its exact scope,
 * creates owner Businesses before Places, and lets the Places writer attach
 * ownership through the owner's logical User lineage. `redirects` remains
 * `VALIDATION_ONLY`, so it needs no apply/rerun adapter.
 *
 * Never opens a WordPress connection — every `Frozen*SourceRepository`
 * reads only from the already-captured, checksummed private artifact
 * under `artifactRoot`.
 */

export const EXECUTABLE_PHASES: readonly PhoenixPhaseName[] = ["users", "businesses", "places", "offers", "routes", "events", "articles"];

export interface BuildPhoenixAdapterRegistryInput {
  prisma: PrismaClient;
  /** `PHOENIX_RELEASE_ARTIFACT_ROOT` — the one place private capture artifacts are read from. */
  artifactRoot: string;
  manifest: PhoenixReleaseManifest;
  mediaPolicy?: { offers?: "NONE" | "METADATA" | "FULL" };
}

interface ScopeArtifact {
  privateArtifact?: { sha256?: string };
  records: Array<{ sourceRecordKey: string; sourceHash: string }>;
}

function readScopeArtifact(entity: string): ScopeArtifact {
  const path = resolve(`docs/migration/manifests/phoenix-${entity}-dev-release-scope-2026-07-31.json`);
  return JSON.parse(readFileSync(path, "utf8")) as ScopeArtifact;
}

function scopeArtifactChecksum(entity: string): string {
  const sha256 = readScopeArtifact(entity).privateArtifact?.sha256;
  if (!sha256) throw new Error(`RELEASE_BLOCKED:SCOPE_ARTIFACT_MISSING_CHECKSUM:${entity}`);
  return sha256;
}

function domainHashMap(entity: string): Map<string, string> {
  const artifact = readScopeArtifact(entity);
  return new Map(artifact.records.map((record) => [record.sourceRecordKey, record.sourceHash]));
}

/**
 * Fail-closed structural checks, run once at build time — before any
 * phase executes, not discovered mid-apply:
 *  - every phase this registry builds an adapter for must actually exist
 *    in `manifest.phaseOrder` (a manifest/adapter phase mismatch);
 *  - `manifest.phaseOrder`'s own relative ordering of the entities this
 *    registry covers must match `EXECUTABLE_PHASES`'s ordering exactly
 *    (a phase-order mismatch);
 *  - every `READY` phase in the manifest that this registry is expected
 *    to cover must receive an adapter (a missing adapter) — and nothing
 *    here can ever register two adapters for the same phase, since the
 *    return type is a plain object keyed by `PhoenixPhaseName` (duplicate
 *    keys are structurally impossible in JS/TS, not just discouraged).
 */
function assertRegistryConsistency(manifest: PhoenixReleaseManifest, coveredPhases: readonly PhoenixPhaseName[]): void {
  for (const phase of coveredPhases) {
    if (!manifest.phaseOrder.includes(phase)) throw new Error(`RELEASE_BLOCKED:REGISTRY_MANIFEST_PHASE_MISMATCH:${phase}`);
  }
  const orderedCovered = manifest.phaseOrder.filter((name) => coveredPhases.includes(name));
  const expectedOrder = EXECUTABLE_PHASES.filter((name) => coveredPhases.includes(name));
  if (JSON.stringify(orderedCovered) !== JSON.stringify(expectedOrder)) {
    throw new Error(`RELEASE_BLOCKED:REGISTRY_PHASE_ORDER_MISMATCH:${JSON.stringify({ manifest: orderedCovered, registry: expectedOrder })}`);
  }
  // Deliberately checks every manifest phase, not just the ones this
  // registry already knows about — flipping e.g. `businesses` to `READY`
  // without ever adding an adapter for it (see the module doc comment)
  // must still fail closed here, not silently proceed with five of six
  // phases wired.
  for (const phase of manifest.phases) {
    if (phase.status === "READY" && !coveredPhases.includes(phase.name)) {
      throw new Error(`RELEASE_BLOCKED:REGISTRY_ADAPTER_MISSING:${phase.name}`);
    }
  }
}

/**
 * Every entity's cross-entity dependency resolution (Place -> owner User,
 * Offer -> Place [-> Business], Event -> owner User + venue Place) looks
 * up `MigrationLineage` rows scoped by `sourceId` — so every entity in one
 * coherent release MUST share the exact same `MigrationSource` row, or a
 * dependency lookup for a target another entity already created will find
 * nothing (a real integration bug caught by `scripts/phoenix-full-bundle-
 * clean-run.ts`: per-entity `MigrationSource` rows made Places' owner-User
 * lookup search under the wrong `sourceId` and fail closed with
 * `PLACE_OWNER_DEPENDENCY_NOT_FOUND` even though the User had just been
 * created). `MigrationSource.sourceNamespace` is otherwise free-form, so
 * one shared namespace for the whole bundle is exactly as valid as six
 * separate ones — it just has to actually be shared.
 */
const PHOENIX_RELEASE_SOURCE_NAMESPACE = "phoenix-release-bundle";

function withProtectedPlaceAdoption(base: PhoenixPhaseAdapter, prisma: PrismaClient, sourceId: string): PhoenixPhaseAdapter {
  const adoptionHash = "protected-adoption:places-preview-2026-07-30";
  const adopt = async () => {
    const sourceRecordKey = "wordpress-db:places:43023";
    const targets = await prisma.place.findMany({ where: { slug: "atmosfera" }, select: { id: true, title: true, slug: true } });
    if (targets.length !== 1) throw new Error(targets.length ? "FAILED:PROTECTED_PLACE_IDENTITY_AMBIGUOUS" : "FAILED:PROTECTED_PLACE_IDENTITY_NOT_FOUND");
    if (targets[0].title.trim().toLocaleLowerCase("ru") !== "атмосфера") throw new Error("FAILED:PROTECTED_PLACE_IDENTITY_MISMATCH");
    const existing = await prisma.migrationLineage.findUnique({ where: { sourceId_sourceRecordKey_targetType_targetRole: { sourceId, sourceRecordKey, targetType: "PLACE", targetRole: "primary" } } });
    if (existing) {
      if (!existing.isActive || existing.targetId !== targets[0].id || existing.lastSourceHash !== adoptionHash) throw new Error("FAILED:PROTECTED_PLACE_LINEAGE_MISMATCH");
      return;
    }
    await prisma.migrationLineage.create({ data: {
      sourceId, sourceEntityType: "wordpress-db:places", sourceExternalId: "43023", sourceStableKey: sourceRecordKey,
      sourceRecordKey, targetType: "PLACE", targetId: targets[0].id, targetRole: "primary", targetNaturalKey: "slug:atmosfera",
      lastSourceHash: adoptionHash, lastPlanAction: "LINK_EXISTING", isActive: true,
      lastSeenAt: new Date(), lastImportedAt: new Date(),
    } });
  };
  return {
    plan: (phase) => base.plan(phase),
    apply: async (phase) => { const results = await base.apply(phase); if (!results.some((r) => r.outcome === "FAILED")) await adopt(); return results; },
    rerun: async (phase) => { const results = await base.rerun(phase); if (!results.some((r) => r.outcome === "FAILED")) await adopt(); return results; },
    reconcile: (phase, results) => base.reconcile(phase, results),
  };
}

export async function buildPhoenixAdapterRegistry(input: BuildPhoenixAdapterRegistryInput): Promise<Partial<Record<PhoenixPhaseName, PhoenixPhaseAdapter>>> {
  const { prisma, artifactRoot } = input;
  assertRegistryConsistency(input.manifest, EXECUTABLE_PHASES);

  const source = await prisma.migrationSource.upsert({
    where: { adapterKey_sourceNamespace: { adapterKey: "wordpress-db", sourceNamespace: PHOENIX_RELEASE_SOURCE_NAMESPACE } },
    create: { adapterKey: "wordpress-db", sourceNamespace: PHOENIX_RELEASE_SOURCE_NAMESPACE, name: "Phoenix release bundle" },
    update: {},
  });

  const registry: Partial<Record<PhoenixPhaseName, PhoenixPhaseAdapter>> = {};

  // --- Users ---
  {
    const rawSource = new FrozenUserSourceRepository(artifactRoot, scopeArtifactChecksum("users"));
    const deps = createUsersDependencies(prisma, rawSource, source.sourceNamespace);
    registry.users = new SequentialEntityPhaseAdapter(new UsersPhaseExecutor(deps));
  }

  // --- Places (depends on Users lineage) ---
  registry.businesses = new SequentialEntityPhaseAdapter(new BusinessesProductionExecutor(prisma, source.id));

  // --- Places (depends on Users and optional Business lineage) ---
  {
    const rawSource = new FrozenPlaceSourceRepository(artifactRoot, scopeArtifactChecksum("places"));
    const placesAdapter = new SequentialEntityPhaseAdapter(
      new PlacesPhaseExecutor({
        loadCandidate: createPlacesLoadCandidate(rawSource),
        resolveTargetState: createPlacesTargetStateResolver(prisma, source.id),
        resolveDependencies: createPlacesDependencyResolver(prisma, source.id),
        // `PlacesWriteTransactionClient.$transaction` is declared recursively
        // (mirroring `PlaceCommitWriterPrismaClient`, which supports a nested
        // openingHours transaction on other call paths) — a shape real
        // Prisma's interactive-transaction client structurally cannot satisfy,
        // since it never exposes `$transaction` on the tx it hands the
        // callback. This writer's own draft always nulls `openingHours`
        // (placesProductionWiring.ts), so that branch is never taken; the
        // cast only bridges a pre-existing type-modeling gap in
        // `PlaceCommitWriter.ts`, not a runtime behavior change.
        write: createPlacesWriter(prisma as unknown as PlacesWriterPrismaClient, rawSource, source.id),
      }),
    );
    registry.places = withProtectedPlaceAdoption(placesAdapter, prisma, source.id);
  }

  // --- Offers (depends on Places lineage) ---
  {
    const rawSource = new FrozenOfferSourceRepository(artifactRoot, scopeArtifactChecksum("offers"));
    const mediaPolicy = input.mediaPolicy?.offers ?? "METADATA";
    registry.offers = new SequentialEntityPhaseAdapter(
      new OffersPhaseExecutor({
        loadCandidate: createOffersLoadCandidate(rawSource, prisma, source.id),
        resolveTargetState: createOffersTargetStateResolver(prisma, source.id),
        resolveDependencies: createOffersDependencyResolver(prisma, source.id),
        write: createOffersWriter(prisma, rawSource, source.id, mediaPolicy),
      }),
    );
  }

  // --- Routes (no cross-entity dependency; natural-key idempotency on slug) ---
  {
    const rawSource = new FrozenRouteSourceRepository(artifactRoot, scopeArtifactChecksum("routes"));
    registry.routes = new SequentialEntityPhaseAdapter(
      new RoutesPhaseExecutor({
        loadCandidate: createRoutesCandidateLoader(rawSource, domainHashMap("routes")),
        resolveTargetState: createRoutesTargetStateResolver(prisma, source.id),
        write: createRoutesWriter(prisma, rawSource, source.id),
      }),
    );
  }

  // --- Events (depends on Users [owner] + Places [venue] lineage; fresh-target preflight) ---
  {
    const rawSource = new FrozenEventSourceRepository(artifactRoot, scopeArtifactChecksum("events"));
    registry.events = new EventsFreshTargetPhaseAdapter(
      createEventsPhasePreflight(prisma),
      new EventsPhaseExecutor({
        loadCandidate: createEventsCandidateLoader(rawSource, domainHashMap("events")),
        resolveTargetState: createEventsTargetStateResolver(prisma, source.id),
        write: createEventsWriter(prisma, rawSource, source.id),
      }),
    );
  }

  // --- Articles (no cross-entity dependency; author resolution deferred) ---
  {
    const rawSource = new FrozenArticleSourceRepository(artifactRoot, scopeArtifactChecksum("articles"));
    const hashes = domainHashMap("articles");
    registry.articles = new SequentialEntityPhaseAdapter(
      new ArticlesPhaseExecutor({
        loadCandidate: (sourceRecordKey) => {
          const domainHash = hashes.get(sourceRecordKey);
          if (!domainHash) throw new Error("FAILED:ARTICLE_DOMAIN_HASH_MISSING");
          return { sourceRecordKey, domainHash };
        },
        resolveTargetState: createArticlesTargetStateResolver(prisma, source.id),
        write: createArticlesWriter(prisma, rawSource, source.id),
      }),
    );
  }

  return registry;
}
