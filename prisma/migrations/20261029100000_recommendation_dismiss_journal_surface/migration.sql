-- ТЗ «Для вашей семьи», PR 1 (аналитика): additive enum values only.
-- UserEventType.DISMISS — пользователь скрыл рекомендацию.
-- RecommendationSurface.JOURNAL — поверхность «Журнал».
ALTER TYPE "UserEventType" ADD VALUE IF NOT EXISTS 'DISMISS';
ALTER TYPE "RecommendationSurface" ADD VALUE IF NOT EXISTS 'JOURNAL';
