-- Add explicit public pricing state. No existing prices or rows are changed.
ALTER TYPE "PublicationPriceMode" ADD VALUE IF NOT EXISTS 'ON_REQUEST';
