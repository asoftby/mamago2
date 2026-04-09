import { headers } from "next/headers";
import prisma from "@/lib/prisma";

/**
 * Учитывать просмотр только для реального запроса публичной страницы `/blog/[slug]`.
 * Не считаем prefetch RSC (например наведение на ссылку в админке) — иначе счётчик раздувается.
 * Предпросмотр `/preview/articles/[id]` не вызывает инкремент (см. эту функцию только из blog page).
 */
export async function shouldCountPublishedArticleViewRequest(): Promise<boolean> {
  const h = await headers();
  if (h.get("Next-Router-Prefetch") === "1") return false;
  if (h.get("Sec-Purpose") === "prefetch") return false;
  if (h.get("Purpose") === "prefetch") return false;
  return true;
}

/** Один инкремент на опубликованную статью (вызывать после shouldCountPublishedArticleViewRequest). */
export async function incrementPublishedArticleViews(articleId: string): Promise<void> {
  await prisma.article.updateMany({
    where: { id: articleId, status: "PUBLISHED" },
    data: { views: { increment: 1 } },
  });
}
