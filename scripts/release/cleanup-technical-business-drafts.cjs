#!/usr/bin/env node
"use strict";

/**
 * Clean up phantom Business DRAFT records created by eventOrganizer.
 *
 * Default mode: STRICTLY READ ONLY.
 *
 * Run (in app container, using the production Prisma Client):
 *   node scripts/release/cleanup-technical-business-drafts.cjs
 *
 * APPLY requires explicit operator approval, independently verified backup,
 * audited ADMIN id, exact count + dry-run digest, and deployed prevention fix.
 * The whole batch is atomic; any protected reference blocks the entire batch.
 *
 * Does NOT delete technical User accounts or Organizer rows.
 */
const { createHash } = require("node:crypto");
const { PrismaClient, Prisma } = require("@prisma/client");

const TECH_EMAIL = /^organizer-unp-([0-9]{9})@mamago\.local$/i;
const argv = process.argv.slice(2);
const applying = argv.includes("--apply");

function flag(name) {
  const prefix = "--" + name + "=";
  const match = argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

function quoteIdent(value) {
  return '"' + value.replace(/"/g, '""') + '"';
}

/** Inspects ALL actual production FK constraints referencing Business.id. */
async function businessForeignKeys(db) {
  return db.$queryRawUnsafe(
    "SELECT ns.nspname AS \"schemaName\", child.relname AS \"tableName\", " +
    "attr.attname AS \"columnName\", con.confdeltype::text AS \"deleteRule\" " +
    "FROM pg_constraint con " +
    "JOIN pg_class parent ON parent.oid = con.confrelid " +
    "JOIN pg_namespace pns ON pns.oid = parent.relnamespace " +
    "JOIN pg_class child ON child.oid = con.conrelid " +
    "JOIN pg_namespace ns ON ns.oid = child.relnamespace " +
    "JOIN pg_attribute attr ON attr.attrelid = child.oid AND attr.attnum = con.conkey[1] " +
    "WHERE con.contype = 'f' AND pns.nspname = 'public' " +
    "AND parent.relname = 'Business' AND cardinality(con.conkey) = 1 " +
    "ORDER BY ns.nspname, child.relname, attr.attname",
  );
}

async function referencedRows(db, ids) {
  if (!ids.length) return [];
  const fks = await businessForeignKeys(db);
  const placeholders = ids.map((_, i) => "$" + (i + 1)).join(",");
  const references = [];
  for (const fk of fks) {
    const qualifiedTable = quoteIdent(fk.schemaName) + "." + quoteIdent(fk.tableName);
    const column = quoteIdent(fk.columnName);
    const matches = await db.$queryRawUnsafe(
      "SELECT " + column + " AS \"businessId\", COUNT(*)::int AS \"count\" " +
      "FROM " + qualifiedTable + " WHERE " + column + " IN (" + placeholders +
      ") GROUP BY " + column,
      ...ids,
    );
    for (const match of matches) {
      references.push({
        businessId: String(match.businessId),
        tableName: fk.tableName,
        columnName: fk.columnName,
        deleteRule: fk.deleteRule,
        count: Number(match.count),
      });
    }
  }
  return references;
}

async function inspect(db) {
  const drafts = await db.business.findMany({
    where: { verificationStatus: "DRAFT" },
    select: {
      id: true,
      unp: true,
      status: true,
      submittedAt: true,
      approvedAt: true,
      reviewedAt: true,
      isVerified: true,
      ownerUserId: true,
      owner: { select: { email: true, phoneE164: true, lastLoginAt: true } },
      members: {
        select: { userId: true, role: true, isActive: true },
      },
    },
    orderBy: { id: "asc" },
  });
  const technicalDrafts = drafts.filter((b) => TECH_EMAIL.test(b.owner.email));
  const references = await referencedRows(db, technicalDrafts.map((b) => b.id));
  const rows = technicalDrafts.map((business) => {
    const blocked = [];
    if (!business.unp ||
        business.owner.email.toLowerCase() !==
        ("organizer-unp-" + business.unp + "@mamago.local")) {
      blocked.push("UNP_DOES_NOT_MATCH_TECHNICAL_EMAIL");
    }
    if (business.status !== "DRAFT" || business.submittedAt ||
        business.reviewedAt || business.approvedAt || business.isVerified) {
      blocked.push("REGISTRATION_OR_REVIEW_ACTIVITY");
    }
    if (business.owner.phoneE164 || business.owner.lastLoginAt) {
      blocked.push("TECHNICAL_OWNER_USED_FOR_LOGIN_OR_PHONE");
    }
    if (business.members.some((m) =>
      m.userId !== business.ownerUserId || m.role !== "OWNER" || !m.isActive
    )) {
      blocked.push("NON_TECHNICAL_OR_INACTIVE_MEMBERSHIP");
    }

    const refs = references.filter((ref) => ref.businessId === business.id);
    for (const ref of refs) {
      const organizer = ref.tableName === "Organizer" &&
        ref.columnName === "linkedBusinessId" &&
        ref.deleteRule === "n"; // ON DELETE SET NULL
      const technicalMembership = ref.tableName === "BusinessMember" &&
        ref.columnName === "businessId" &&
        ref.deleteRule === "c" && // ON DELETE CASCADE
        ref.count === business.members.length &&
        business.members.every((m) =>
          m.userId === business.ownerUserId && m.role === "OWNER" && m.isActive
        );
      if (!organizer && !technicalMembership) {
        blocked.push("PROTECTED_REFERENCE:" + ref.tableName + "." + ref.columnName);
      }
    }
    return {
      businessId: business.id,
      unp: business.unp,
      technicalOwnerId: business.ownerUserId,
      organizerReferences: refs.filter((ref) => ref.tableName === "Organizer")
        .reduce((sum, ref) => sum + ref.count, 0),
      membershipCount: business.members.length,
      protectedReasons: [...new Set(blocked)].sort(),
    };
  });

  // Identical digest on dry-run and in the commit transaction ensures exact
  // Business ids, owner ids, UNPs, membership counts and safety criteria.
  const digest = createHash("sha256").update(JSON.stringify(rows)).digest("hex");
  return {
    totalDrafts: drafts.length,
    technicalDrafts: technicalDrafts.length,
    eligible: rows.filter((row) => !row.protectedReasons.length).length,
    blocked: rows.filter((row) => row.protectedReasons.length),
    rows,
    digest,
  };
}

function publicReport(result) {
  console.log(JSON.stringify({
    mode: applying ? "APPLY" : "DRY_RUN_READ_ONLY",
    totalDrafts: result.totalDrafts,
    technicalDrafts: result.technicalDrafts,
    eligible: result.eligible,
    blocked: result.blocked,
    digest: result.digest,
    rows: result.rows,
  }, null, 2));
}

async function main() {
  const db = new PrismaClient();
  try {
    const snapshot = await inspect(db);
    publicReport(snapshot);

    if (!applying) {
      console.log("NO_CHANGES_MADE; production Business, User and Organizer records unchanged");
      return;
    }

    const actorId = flag("admin-id");
    const backupRef = flag("backup-ref");
    const reason = flag("reason");
    const digest = flag("expected-digest");
    const count = flag("expected-count");
    const confirm = flag("confirm");

    if (confirm !== "DELETE_TECHNICAL_DRAFT_BUSINESSES" ||
        !actorId || !backupRef || backupRef.length < 8 ||
        !reason || reason.length < 20 ||
        digest !== snapshot.digest ||
        count !== String(snapshot.technicalDrafts) ||
        snapshot.blocked.length || snapshot.eligible !== snapshot.technicalDrafts) {
      throw new Error("APPLY_GUARD_FAILED: confirmation, admin, backup, count, digest, reason or blockers");
    }

    const actor = await db.user.findUnique({
      where: { id: actorId },
      select: { id: true, role: true, status: true },
    });
    if (!actor || actor.role !== "ADMIN" || actor.status !== "ACTIVE") {
      throw new Error("APPLY_GUARD_FAILED: actor must be active ADMIN");
    }

    await db.$transaction(async (tx) => {
      const ids = snapshot.rows.map((row) => row.businessId);
      if (ids.length) {
        // Lock rows to keep FK-dependent writes from racing during final checks.
        await tx.$queryRawUnsafe(
          "SELECT id FROM \"Business\" WHERE id IN (" +
          ids.map((_, i) => "$" + (i + 1)).join(",") + ") FOR UPDATE",
          ...ids,
        );
      }
      const again = await inspect(tx);
      if (again.digest !== snapshot.digest ||
          again.technicalDrafts !== snapshot.technicalDrafts ||
          again.blocked.length) {
        throw new Error("APPLY_GUARD_FAILED: data changed after initial dry-run");
      }
      for (const item of snapshot.rows) {
        // Atomic, permanent admin log: audit survives Business deletion.
        await tx.adminAuditLog.create({
          data: {
            actorId,
            actorRole: "ADMIN",
            action: "DELETE_PHANTOM_TECHNICAL_BUSINESS",
            entityType: "Business",
            entityId: item.businessId,
            before: {
              id: item.businessId,
              unp: item.unp,
              technicalOwnerId: item.technicalOwnerId,
              verificationStatus: "DRAFT",
              organizerReferences: item.organizerReferences,
            },
            after: { deleted: true, unpReleased: true },
            reason,
            metadata: { backupRef, digest, procedure: "technical-draft-cleanup-v1" },
          },
        });
      }
      const removed = await tx.business.deleteMany({
        where: { id: { in: ids }, verificationStatus: "DRAFT", status: "DRAFT" },
      });
      if (removed.count !== ids.length) {
        throw new Error("APPLY_GUARD_FAILED: deleted row count mismatch");
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120000 });

    const remaining = await db.business.count({
      where: { id: { in: snapshot.rows.map((row) => row.businessId) } },
    });
    console.log(JSON.stringify({
      result: "APPLIED",
      deletedBusinesses: snapshot.rows.length,
      remainingBusinessRows: remaining,
      technicalUserAccountsDeleted: 0,
      organizerRowsDeleted: 0,
      backupReference: backupRef,
    }, null, 2));
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error("CLEANUP_FAILED:", error && error.message ? error.message : "unknown");
  process.exitCode = 1;
});
