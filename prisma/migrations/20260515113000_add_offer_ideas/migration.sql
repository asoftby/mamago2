-- CreateTable
CREATE TABLE "OfferIdea" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfferIdea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OfferIdea_userId_offerId_key" ON "OfferIdea"("userId", "offerId");

-- CreateIndex
CREATE INDEX "OfferIdea_userId_idx" ON "OfferIdea"("userId");

-- CreateIndex
CREATE INDEX "OfferIdea_offerId_idx" ON "OfferIdea"("offerId");

-- AddForeignKey
ALTER TABLE "OfferIdea" ADD CONSTRAINT "OfferIdea_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferIdea" ADD CONSTRAINT "OfferIdea_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
