-- CreateTable
CREATE TABLE "SearchSynonym" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "targets" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchSynonym_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SearchSynonym_source_key" ON "SearchSynonym"("source");

-- CreateIndex
CREATE INDEX "SearchSynonym_isActive_idx" ON "SearchSynonym"("isActive");

-- CreateIndex
CREATE INDEX "SearchSynonym_source_idx" ON "SearchSynonym"("source");
