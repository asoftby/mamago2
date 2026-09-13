-- DropIndex
DROP INDEX "ImportedRecord_sourceId_externalId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "ImportedRecord_sourceId_externalId_key" ON "ImportedRecord"("sourceId", "externalId");
