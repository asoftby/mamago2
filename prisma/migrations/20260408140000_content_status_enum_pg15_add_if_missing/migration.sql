-- Дублируем расширение enum без PL/pgSQL: ADD VALUE внутри DO $$ на части инсталляций PG не добавляет значения.
-- PostgreSQL 15+: IF NOT EXISTS на верхнем уровне — надёжно и идемпотентно.
-- Если литералы уже есть (после 20260407140000 или 20260408130000), строки no-op.

ALTER TYPE "ContentStatus" ADD VALUE IF NOT EXISTS 'SCHEDULED';
ALTER TYPE "ContentStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';
