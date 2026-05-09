/**
 * Картинки из нашего API (/api/media/...) нельзя гонять через оптимизатор next/image
 * без cookies — нужен прямой запрос из браузера (unoptimized / <img>).
 * URL в БД может быть относительным или абсолютным с другим host.
 */
export function isAppMediaUrl(src: string | null | undefined): boolean {
  if (src == null || typeof src !== "string") return false;
  const t = src.trim();
  if (!t) return false;
  if (t.startsWith("/api/media")) return true;
  try {
    const u = new URL(t);
    return u.pathname.startsWith("/api/media");
  } catch {
    return false;
  }
}
