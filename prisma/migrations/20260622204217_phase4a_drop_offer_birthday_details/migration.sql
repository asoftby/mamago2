-- Phase 4a: снос пустой legacy OfferBirthdayDetails (0 строк на dev/проде, бэкфилл не нужен)

-- 1. Снять FK перед дропом таблицы
ALTER TABLE "OfferBirthdayDetails" DROP CONSTRAINT "OfferBirthdayDetails_offerId_fkey";

-- 2. Дроп таблицы (пуста)
DROP TABLE "OfferBirthdayDetails";

-- 3. Дроп enum BirthdayRole — использовался только в OfferBirthdayDetails.role, больше нигде.
DROP TYPE "BirthdayRole";

-- 4. Переименовать BirthdayLocationType → PartyLocationType — Offer.partyLocationType остаётся
--    каноном и продолжает ссылаться на этот тип; RENAME (не DROP+CREATE) не трогает данные колонки.
ALTER TYPE "BirthdayLocationType" RENAME TO "PartyLocationType";
