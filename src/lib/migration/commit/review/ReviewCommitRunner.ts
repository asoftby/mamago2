import type { MigrationLineage, MigrationRecord, PlaceReview, PrismaClient, User } from "@prisma/client";

import type { CreateLineageResult } from "../../lineage/types";
import type { NormalizedReviewCandidate } from "../../adapters/wordpress-db/normalizeReview";
import { classifyImportedTargetUpdateSafety } from "../shared/classifyImportedTargetUpdateSafety";
import type { CommitOperation } from "../types";

export type ReviewSkipReason =
  | "REVIEW_SKIP_MISSING_USER"
  | "REVIEW_SKIP_MISSING_PLACE"
  | "REVIEW_SKIP_UNPUBLISHED_PLACE"
  | "REVIEW_SKIP_INVALID_SCORE"
  | "REVIEW_SKIP_INVALID_DATE";

export type ReviewCommitAction = "CREATE" | "SKIP_UNCHANGED" | "UPDATE" | "SKIP";

export interface ReviewCommitRunnerPrismaClient {
  migrationRecord: Pick<PrismaClient["migrationRecord"], "update">;
  migrationLineage: Pick<PrismaClient["migrationLineage"], "findFirst" | "update">;
  placeReview: Pick<PrismaClient["placeReview"], "findUnique" | "create" | "update">;
  user: Pick<PrismaClient["user"], "findUnique">;
}

export interface ReviewLineageLookup {
  findActive(input: {
    sourceRecordKey: string;
    targetType: "USER" | "PLACE" | "PLACE_REVIEW";
  }): Promise<Pick<MigrationLineage, "id" | "targetId" | "lastSourceHash" | "lastImportedAt" | "sourceRecordKey" | "targetType"> | null>;
}

export interface ReviewLineageWriterLike {
  createLineage(input: {
    sourceId: string;
    sourceEntityType: string;
    sourceStableKey: string;
    sourceRecordKey: string;
    targetType: "PLACE_REVIEW";
    targetId: string;
    targetStableKey?: string | null;
    lastSourceHash: string;
    runId?: string | null;
    recordId?: string | null;
  }): Promise<CreateLineageResult>;
}

export interface ExecuteReviewCommitRunInput {
  operation: CommitOperation;
  candidate: NormalizedReviewCandidate;
  migrationRecord: MigrationRecord;
}

export type ExecuteReviewCommitRunResult =
  | { ok: true; reviewId: string; lineageId: string; recordId: string; status: "LINKED"; action: ReviewCommitAction }
  | {
      ok: false;
      recordId: string;
      status: "FAILED" | "BLOCKED";
      errorCode: string;
      errorMessage: string;
      action: ReviewCommitAction;
    };

function parsePublishedAt(value: string): Date | null {
  const raw = value.trim();
  const mysql = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/.exec(raw);
  const normalized = mysql ? `${mysql[1]}T${mysql[2]}.000Z` : raw;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function authorNameFromUser(user: Pick<User, "displayName" | "email">, legacyUserId: number): string {
  const name = user.displayName?.trim();
  if (name) return name;
  return `legacy-user:${legacyUserId}`;
}

export class PrismaReviewLineageLookup implements ReviewLineageLookup {
  constructor(private readonly prisma: Pick<PrismaClient, "migrationLineage">) {}

  async findActive(input: {
    sourceRecordKey: string;
    targetType: "USER" | "PLACE" | "PLACE_REVIEW";
  }) {
    return this.prisma.migrationLineage.findFirst({
      where: {
        sourceRecordKey: input.sourceRecordKey,
        targetType: input.targetType,
        isActive: true,
        targetId: { not: null },
      },
      orderBy: { lastImportedAt: "desc" },
      select: {
        id: true,
        targetId: true,
        lastSourceHash: true,
        lastImportedAt: true,
        sourceRecordKey: true,
        targetType: true,
      },
    });
  }
}

export class ReviewCommitRunner {
  constructor(
    private readonly deps: {
      prisma: ReviewCommitRunnerPrismaClient;
      lineageLookup: ReviewLineageLookup;
      lineageWriter: ReviewLineageWriterLike;
      now?: () => Date;
    },
  ) {}

  private now(): Date {
    return (this.deps.now ?? (() => new Date()))();
  }

  private async fail(
    recordId: string,
    errorCode: string,
    errorMessage: string,
    action: ReviewCommitAction,
    status: "FAILED" | "BLOCKED" = "BLOCKED",
  ): Promise<ExecuteReviewCommitRunResult> {
    await this.deps.prisma.migrationRecord.update({
      where: { id: recordId },
      data: { status: status === "BLOCKED" ? "QUARANTINED" : "FAILED", lastErrorCode: errorCode, lastErrorMessage: errorMessage },
    });
    return { ok: false, recordId, status, errorCode, errorMessage, action };
  }

  async execute(input: ExecuteReviewCommitRunInput): Promise<ExecuteReviewCommitRunResult> {
    const { candidate, migrationRecord, operation } = input;

    if (candidate.rating === null) {
      return this.fail(migrationRecord.id, "REVIEW_SKIP_INVALID_SCORE", "Review has no mappable Voxel score.", "SKIP");
    }
    if (candidate.placeStatus && candidate.placeStatus !== "publish") {
      return this.fail(
        migrationRecord.id,
        "REVIEW_SKIP_UNPUBLISHED_PLACE",
        `Legacy Place ${candidate.legacyPlaceId} is not published (${candidate.placeStatus}).`,
        "SKIP",
      );
    }
    const publishedAt = parsePublishedAt(candidate.publishedAt);
    if (!publishedAt) {
      return this.fail(migrationRecord.id, "REVIEW_SKIP_INVALID_DATE", "Review created_at is not a valid datetime.", "SKIP");
    }

    const [userLineage, placeLineage] = await Promise.all([
      this.deps.lineageLookup.findActive({ sourceRecordKey: candidate.userSourceRecordKey, targetType: "USER" }),
      this.deps.lineageLookup.findActive({ sourceRecordKey: candidate.placeSourceRecordKey, targetType: "PLACE" }),
    ]);
    if (!userLineage?.targetId) {
      return this.fail(
        migrationRecord.id,
        "REVIEW_SKIP_MISSING_USER",
        `No migrated User lineage for ${candidate.userSourceRecordKey}.`,
        "SKIP",
      );
    }
    if (!placeLineage?.targetId) {
      return this.fail(
        migrationRecord.id,
        "REVIEW_SKIP_MISSING_PLACE",
        `No migrated Place lineage for ${candidate.placeSourceRecordKey}.`,
        "SKIP",
      );
    }

    const user = await this.deps.prisma.user.findUnique({
      where: { id: userLineage.targetId },
      select: { id: true, displayName: true, email: true },
    });
    if (!user) {
      return this.fail(
        migrationRecord.id,
        "REVIEW_SKIP_MISSING_USER",
        `User lineage target ${userLineage.targetId} is missing.`,
        "SKIP",
      );
    }

    const existingReviewLineage = await this.deps.lineageLookup.findActive({
      sourceRecordKey: candidate.sourceRecordKey,
      targetType: "PLACE_REVIEW",
    });

    const reviewData = {
      placeId: placeLineage.targetId,
      source: "MAMAGO" as const,
      sourceReviewId: candidate.sourceReviewId,
      authorName: authorNameFromUser(user, candidate.legacyUserId),
      rating: candidate.rating,
      text: candidate.body,
      publishedAt,
      status: "PUBLISHED" as const,
    };

    if (existingReviewLineage?.targetId) {
      const existing = await this.deps.prisma.placeReview.findUnique({ where: { id: existingReviewLineage.targetId } });
      if (!existing) {
        return this.fail(
          migrationRecord.id,
          "REVIEW_UPDATE_TARGET_MISSING",
          "PlaceReview lineage target is missing.",
          "SKIP",
          "FAILED",
        );
      }
      if (operation.action !== "UPDATE" && migrationRecord.sourceHash === existingReviewLineage.lastSourceHash) {
        await this.deps.prisma.migrationRecord.update({
          where: { id: migrationRecord.id },
          data: { status: "LINKED", lastErrorCode: null, lastErrorMessage: null },
        });
        return {
          ok: true,
          reviewId: existing.id,
          lineageId: existingReviewLineage.id,
          recordId: migrationRecord.id,
          status: "LINKED",
          action: "SKIP_UNCHANGED",
        };
      }

      const safety = classifyImportedTargetUpdateSafety({
        targetType: "PLACE_REVIEW",
        sourceRecordKey: candidate.sourceRecordKey,
        lineage: existingReviewLineage as MigrationLineage,
        target: existing,
      });
      if (safety.classification === "UPDATE_CONFLICT") {
        return this.fail(
          migrationRecord.id,
          `REVIEW_UPDATE_CONFLICT_${safety.reason}`,
          "Refusing to overwrite a PlaceReview that changed after import.",
          "SKIP",
        );
      }

      const updated: PlaceReview = await this.deps.prisma.placeReview.update({
        where: { id: existing.id },
        data: {
          rating: reviewData.rating,
          text: reviewData.text,
          publishedAt: reviewData.publishedAt,
          authorName: reviewData.authorName,
        },
      });
      await this.deps.prisma.migrationLineage.update({
        where: { id: existingReviewLineage.id },
        data: {
          lastSourceHash: migrationRecord.sourceHash!,
          runId: migrationRecord.runId,
          recordId: migrationRecord.id,
          lastImportedAt: this.now(),
          isActive: true,
        },
      });
      await this.deps.prisma.migrationRecord.update({
        where: { id: migrationRecord.id },
        data: { status: "LINKED", lastErrorCode: null, lastErrorMessage: null },
      });
      return {
        ok: true,
        reviewId: updated.id,
        lineageId: existingReviewLineage.id,
        recordId: migrationRecord.id,
        status: "LINKED",
        action: "UPDATE",
      };
    }

    const duplicate = await this.deps.prisma.placeReview.findUnique({
      where: {
        placeId_source_sourceReviewId: {
          placeId: reviewData.placeId,
          source: "MAMAGO",
          sourceReviewId: reviewData.sourceReviewId,
        },
      },
    });
    if (duplicate) {
      return this.fail(
        migrationRecord.id,
        "REVIEW_DUPLICATE_SOURCE",
        "A PlaceReview with this sourceReviewId already exists for the mapped Place.",
        "SKIP",
        "FAILED",
      );
    }

    const created = await this.deps.prisma.placeReview.create({ data: reviewData });
    const lineage = await this.deps.lineageWriter.createLineage({
      sourceId: migrationRecord.sourceId,
      sourceEntityType: migrationRecord.sourceEntityType,
      sourceStableKey: migrationRecord.sourceStableKey,
      sourceRecordKey: candidate.sourceRecordKey,
      targetType: "PLACE_REVIEW",
      targetId: created.id,
      targetStableKey: created.id,
      lastSourceHash: migrationRecord.sourceHash!,
      runId: migrationRecord.runId,
      recordId: migrationRecord.id,
    });
    await this.deps.prisma.migrationRecord.update({
      where: { id: migrationRecord.id },
      data: { status: "LINKED", lastErrorCode: null, lastErrorMessage: null },
    });
    return {
      ok: true,
      reviewId: created.id,
      lineageId: lineage.lineageId,
      recordId: migrationRecord.id,
      status: "LINKED",
      action: "CREATE",
    };
  }
}
