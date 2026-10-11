-- ActivitySession: optional per-session title (e.g. the film shown at a screening)
ALTER TABLE "ActivitySession" ADD COLUMN "title" VARCHAR(120);
