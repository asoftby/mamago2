-- AlterEnum: публичная видимость — только ACTIVE; DISABLED и ARCHIVED скрывают контент
ALTER TYPE "BusinessOperationalStatus" ADD VALUE 'ARCHIVED';
