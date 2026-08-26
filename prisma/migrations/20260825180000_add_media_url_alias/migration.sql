CREATE TABLE "MediaUrlAlias" (
    "id" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "legacyPath" TEXT NOT NULL,
    "reason" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaUrlAlias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MediaUrlAlias_legacyPath_key" ON "MediaUrlAlias"("legacyPath");
CREATE INDEX "MediaUrlAlias_mediaId_idx" ON "MediaUrlAlias"("mediaId");

ALTER TABLE "MediaUrlAlias"
ADD CONSTRAINT "MediaUrlAlias_mediaId_fkey"
FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
