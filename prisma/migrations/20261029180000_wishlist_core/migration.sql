-- Wishlist core (PR 1): additive only, no backfill, no changes to existing rows.
CREATE TYPE "WishlistOccasion" AS ENUM ('BIRTHDAY', 'OTHER');
CREATE TYPE "WishlistVisibility" AS ENUM ('PRIVATE', 'LINK', 'PROFILE');
CREATE TYPE "WishlistStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "WishlistItemPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH');
CREATE TYPE "WishlistReservationStatus" AS ENUM ('RESERVED', 'PURCHASED', 'CANCELLED', 'ITEM_REMOVED');

CREATE TABLE "Wishlist" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "familyId" TEXT,
  "recipientChildId" TEXT,
  "recipientName" VARCHAR(60),
  "occasion" "WishlistOccasion" NOT NULL DEFAULT 'BIRTHDAY',
  "eventDate" DATE,
  "title" VARCHAR(120) NOT NULL,
  "note" VARCHAR(1000),
  "shareToken" TEXT NOT NULL,
  "visibility" "WishlistVisibility" NOT NULL DEFAULT 'LINK',
  "hideReservationsFromOwner" BOOLEAN NOT NULL DEFAULT false,
  "showReserverNamesToGuests" BOOLEAN NOT NULL DEFAULT false,
  "status" "WishlistStatus" NOT NULL DEFAULT 'ACTIVE',
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Wishlist_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WishlistItem" (
  "id" TEXT NOT NULL,
  "wishlistId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "title" VARCHAR(200) NOT NULL,
  "url" VARCHAR(2048),
  "comment" VARCHAR(1000),
  "priceApprox" DECIMAL(10,2),
  "currency" VARCHAR(3) NOT NULL DEFAULT 'BYN',
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "priority" "WishlistItemPriority" NOT NULL DEFAULT 'NORMAL',
  "imageUrl" VARCHAR(2048),
  "offerId" TEXT,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WishlistItem_quantity_check" CHECK ("quantity" BETWEEN 1 AND 99),
  CONSTRAINT "WishlistItem_priceApprox_check" CHECK ("priceApprox" IS NULL OR "priceApprox" >= 0)
);

CREATE TABLE "WishlistReservation" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "userId" TEXT,
  "displayName" VARCHAR(60) NOT NULL,
  "contactEmail" VARCHAR(254),
  "telegramChatId" TEXT,
  "claimTokenHash" TEXT NOT NULL,
  "status" "WishlistReservationStatus" NOT NULL DEFAULT 'RESERVED',
  "consentAt" TIMESTAMP(3),
  "consentTextVersion" VARCHAR(32),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WishlistReservation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WishlistReservation_quantity_check" CHECK ("quantity" BETWEEN 1 AND 99)
);

CREATE UNIQUE INDEX "Wishlist_shareToken_key" ON "Wishlist"("shareToken");
CREATE INDEX "Wishlist_ownerUserId_status_idx" ON "Wishlist"("ownerUserId", "status");
CREATE INDEX "Wishlist_familyId_status_idx" ON "Wishlist"("familyId", "status");
CREATE INDEX "Wishlist_recipientChildId_idx" ON "Wishlist"("recipientChildId");
CREATE INDEX "WishlistItem_wishlistId_sortOrder_idx" ON "WishlistItem"("wishlistId", "sortOrder");
CREATE INDEX "WishlistItem_offerId_idx" ON "WishlistItem"("offerId");
CREATE UNIQUE INDEX "WishlistReservation_claimTokenHash_key" ON "WishlistReservation"("claimTokenHash");
CREATE INDEX "WishlistReservation_itemId_status_idx" ON "WishlistReservation"("itemId", "status");
CREATE INDEX "WishlistReservation_userId_idx" ON "WishlistReservation"("userId");

ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_recipientChildId_fkey" FOREIGN KEY ("recipientChildId") REFERENCES "Child"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_wishlistId_fkey" FOREIGN KEY ("wishlistId") REFERENCES "Wishlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WishlistReservation" ADD CONSTRAINT "WishlistReservation_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "WishlistItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WishlistReservation" ADD CONSTRAINT "WishlistReservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
