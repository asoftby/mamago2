-- Базы без применённого 20260407140000 не имеют SCHEDULED/ARCHIVED в enum ContentStatus.
-- Идемпотентно добавляем недостающие значения (Prisma ожидает их по schema.prisma).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'ContentStatus'
      AND e.enumlabel = 'SCHEDULED'
  ) THEN
    ALTER TYPE "ContentStatus" ADD VALUE 'SCHEDULED';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'ContentStatus'
      AND e.enumlabel = 'ARCHIVED'
  ) THEN
    ALTER TYPE "ContentStatus" ADD VALUE 'ARCHIVED';
  END IF;
END;
$$;
