-- ТЗ «Аналитика админки», A2: класс клиента продуктовой телеметрии.
-- Сырой User-Agent не хранится — только класс. Колонка nullable, без
-- backfill: старые строки (и события, записанные сервером) остаются NULL,
-- по первой непустой строке отчёты определяют дату исправления трекинга (A4).
-- Миграция аддитивная, без блокирующих перестроек таблицы.

-- CreateEnum
CREATE TYPE "UserEventClientClass" AS ENUM ('browser', 'bot', 'unknown');

-- AlterTable
ALTER TABLE "UserEvent" ADD COLUMN "clientClass" "UserEventClientClass";
