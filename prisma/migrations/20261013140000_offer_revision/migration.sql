-- OfferRevision: content edits of a published offer wait for moderation instead of overwriting the live row.
-- Additive only.

CREATE TYPE "OfferRevisionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "OfferRevision" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "authorId" TEXT,
    "status" "OfferRevisionStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "changedFields" TEXT[],
    "baseOfferUpdatedAt" TIMESTAMP(3),
    "moderatorComment" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfferRevision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OfferRevision_offerId_status_idx" ON "OfferRevision"("offerId", "status");
CREATE INDEX "OfferRevision_status_createdAt_idx" ON "OfferRevision"("status", "createdAt");

-- At most one PENDING revision per offer (partial unique index: not expressible in schema.prisma).
CREATE UNIQUE INDEX "OfferRevision_one_pending_per_offer" ON "OfferRevision"("offerId") WHERE "status" = 'PENDING';

ALTER TABLE "OfferRevision" ADD CONSTRAINT "OfferRevision_offerId_fkey"
    FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OfferRevision" ADD CONSTRAINT "OfferRevision_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OfferRevision" ADD CONSTRAINT "OfferRevision_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
