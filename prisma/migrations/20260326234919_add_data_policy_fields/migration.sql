-- AlterTable
ALTER TABLE "DiscoveryTaxonomyEntry" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "EventCategory" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "FilterDefinition" ADD COLUMN     "isSystem" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SignalDefinition" ADD COLUMN     "isSystem" BOOLEAN NOT NULL DEFAULT false;
