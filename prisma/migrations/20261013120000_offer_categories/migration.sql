-- Offer categories: up to 3 per offer (new offer wizard, step 1).
-- Additive only: new table + idempotent seed of EventCategory(publicationType=OFFER).

CREATE TABLE "OfferCategory" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfferCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OfferCategory_offerId_categoryId_key" ON "OfferCategory"("offerId", "categoryId");
CREATE INDEX "OfferCategory_offerId_sortOrder_idx" ON "OfferCategory"("offerId", "sortOrder");
CREATE INDEX "OfferCategory_categoryId_idx" ON "OfferCategory"("categoryId");

ALTER TABLE "OfferCategory" ADD CONSTRAINT "OfferCategory_offerId_fkey"
    FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OfferCategory" ADD CONSTRAINT "OfferCategory_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "EventCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Party services (values of PartyCategory)
INSERT INTO "EventCategory" ("id", "nameRu", "nameEn", "slug", "sortOrder", "isActive", "publicationType", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'Площадка', 'Venue', 'party-venue', 10, true, 'OFFER', now()),
  (gen_random_uuid()::text, 'Аниматоры', 'Animators', 'party-animator', 20, true, 'OFFER', now()),
  (gen_random_uuid()::text, 'Шоу', 'Show', 'party-show', 30, true, 'OFFER', now()),
  (gen_random_uuid()::text, 'Мастер-классы', 'Master classes', 'party-master-class', 40, true, 'OFFER', now()),
  (gen_random_uuid()::text, 'Торты', 'Cakes', 'party-cake', 50, true, 'OFFER', now()),
  (gen_random_uuid()::text, 'Угощения', 'Food', 'party-food', 60, true, 'OFFER', now()),
  (gen_random_uuid()::text, 'Декор', 'Decor', 'party-decor', 70, true, 'OFFER', now()),
  (gen_random_uuid()::text, 'Фото и видео', 'Photo and video', 'party-photo', 80, true, 'OFFER', now()),
  (gen_random_uuid()::text, 'Программы', 'Programs', 'party-program', 90, true, 'OFFER', now()),
  (gen_random_uuid()::text, 'Другое', 'Other', 'party-other', 100, true, 'OFFER', now())
ON CONFLICT ("publicationType", "slug") DO NOTHING;

-- Camps
INSERT INTO "EventCategory" ("id", "nameRu", "nameEn", "slug", "sortOrder", "isActive", "publicationType", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'Городской лагерь', 'Day camp', 'camp-city', 10, true, 'OFFER', now()),
  (gen_random_uuid()::text, 'Выездной лагерь', 'Overnight camp', 'camp-out-of-town', 20, true, 'OFFER', now()),
  (gen_random_uuid()::text, 'Спортивный', 'Sports', 'camp-sport', 30, true, 'OFFER', now()),
  (gen_random_uuid()::text, 'Языковой', 'Language', 'camp-language', 40, true, 'OFFER', now()),
  (gen_random_uuid()::text, 'IT и робототехника', 'IT and robotics', 'camp-it-robotics', 50, true, 'OFFER', now()),
  (gen_random_uuid()::text, 'Творческий', 'Creative', 'camp-creative', 60, true, 'OFFER', now())
ON CONFLICT ("publicationType", "slug") DO NOTHING;

-- Classes: copied from existing active DiscoveryClassChip rows (slug prefixed with "class-")
INSERT INTO "EventCategory" ("id", "nameRu", "nameEn", "slug", "sortOrder", "isActive", "publicationType", "updatedAt")
SELECT gen_random_uuid()::text, c."title", c."title", 'class-' || c."slug", c."sortOrder", true, 'OFFER', now()
FROM "DiscoveryClassChip" c
WHERE c."isActive" = true
ON CONFLICT ("publicationType", "slug") DO NOTHING;
