"use client";

/**
 * Хедер для viewport **lg+**. Учитывает `getSiteHeaderVariant` внутри {@link SiteHeaderShell}
 * (режим **landing**: без строки поиска и без кнопки «Фильтры» в десктопной разметке).
 */
import { SiteHeaderShell } from "./SiteHeaderShell";

export function DesktopHeader() {
  return <SiteHeaderShell />;
}
