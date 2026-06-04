-- PostgreSQL allows multiple NULL values in a regular UNIQUE index.
-- This functional unique index guarantees that the global llms.txt row
-- (`citySlug IS NULL`) can exist only once.
CREATE UNIQUE INDEX "SeoLlmsTxt_global_singleton_idx"
ON "SeoLlmsTxt" ((COALESCE("citySlug", '__mamago_global_llms_txt__')));
