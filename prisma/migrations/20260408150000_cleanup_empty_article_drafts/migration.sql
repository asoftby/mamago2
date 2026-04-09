-- Удаление «мусорных» черновиков: открытие формы без сохранения раньше создавало строку в БД.
-- DRAFT, без slug, пустой или плейсхолдерный заголовок.
DELETE FROM "Article"
WHERE status = 'DRAFT'
  AND "slug" IS NULL
  AND trim(coalesce("title", '')) IN ('', 'Без названия');
