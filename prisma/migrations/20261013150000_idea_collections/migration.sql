-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" VARCHAR(60) NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionItem" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "ideaId" TEXT,
    "offerIdeaId" TEXT,
    "routeIdeaId" TEXT,
    "placeIdeaId" TEXT,
    "articleIdeaId" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Collection_userId_sort_idx" ON "Collection"("userId", "sort");

-- CreateIndex
CREATE INDEX "CollectionItem_collectionId_addedAt_idx" ON "CollectionItem"("collectionId", "addedAt");

-- CreateIndex
CREATE INDEX "CollectionItem_ideaId_idx" ON "CollectionItem"("ideaId");

-- CreateIndex
CREATE INDEX "CollectionItem_offerIdeaId_idx" ON "CollectionItem"("offerIdeaId");

-- CreateIndex
CREATE INDEX "CollectionItem_routeIdeaId_idx" ON "CollectionItem"("routeIdeaId");

-- CreateIndex
CREATE INDEX "CollectionItem_placeIdeaId_idx" ON "CollectionItem"("placeIdeaId");

-- CreateIndex
CREATE INDEX "CollectionItem_articleIdeaId_idx" ON "CollectionItem"("articleIdeaId");

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_offerIdeaId_fkey" FOREIGN KEY ("offerIdeaId") REFERENCES "OfferIdea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_routeIdeaId_fkey" FOREIGN KEY ("routeIdeaId") REFERENCES "RouteIdea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_placeIdeaId_fkey" FOREIGN KEY ("placeIdeaId") REFERENCES "PlaceIdea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_articleIdeaId_fkey" FOREIGN KEY ("articleIdeaId") REFERENCES "ArticleIdea"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Hand-written (not expressible in schema.prisma):

-- Exactly one idea FK per row (polymorphic membership).
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_exactly_one_idea_chk" CHECK (
    num_nonnulls("ideaId", "offerIdeaId", "routeIdeaId", "placeIdeaId", "articleIdeaId") = 1
);

-- One membership per (collection, idea) for each idea type.
CREATE UNIQUE INDEX "CollectionItem_collectionId_ideaId_key" ON "CollectionItem"("collectionId", "ideaId") WHERE "ideaId" IS NOT NULL;
CREATE UNIQUE INDEX "CollectionItem_collectionId_offerIdeaId_key" ON "CollectionItem"("collectionId", "offerIdeaId") WHERE "offerIdeaId" IS NOT NULL;
CREATE UNIQUE INDEX "CollectionItem_collectionId_routeIdeaId_key" ON "CollectionItem"("collectionId", "routeIdeaId") WHERE "routeIdeaId" IS NOT NULL;
CREATE UNIQUE INDEX "CollectionItem_collectionId_placeIdeaId_key" ON "CollectionItem"("collectionId", "placeIdeaId") WHERE "placeIdeaId" IS NOT NULL;
CREATE UNIQUE INDEX "CollectionItem_collectionId_articleIdeaId_key" ON "CollectionItem"("collectionId", "articleIdeaId") WHERE "articleIdeaId" IS NOT NULL;

-- Collection titles are unique per user, case-insensitive.
CREATE UNIQUE INDEX "Collection_userId_lower_title_key" ON "Collection"("userId", lower("title"));
