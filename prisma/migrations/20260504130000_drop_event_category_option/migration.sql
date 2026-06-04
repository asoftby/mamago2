-- Migration: drop_event_category_option
-- Removes the EventCategoryOption table which is no longer used in the product.

DROP TABLE IF EXISTS "EventCategoryOption";
