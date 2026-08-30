import prisma from "@/lib/prisma";
import { Page, PageStatus, Prisma } from "@prisma/client";
import type { CreatePageInput, UpdatePageInput, ListPagesQuery } from "./validation";
import { normalizeSlug } from "./validation";
import {
  getPublicPageDetailWhere,
  getPublicPageIndexWhere,
} from "@/server/public/publicContentVisibility";

/**
 * Создание страницы
 */
export async function createPage(
  input: CreatePageInput,
  userId?: string
): Promise<Page> {
  // Нормализуем slug
  const normalizedSlug = normalizeSlug(input.slug);

  // Проверяем уникальность slug
  const existing = await prisma.page.findUnique({
    where: { slug: normalizedSlug },
  });

  if (existing) {
    throw new Error(`Страница с slug "${normalizedSlug}" уже существует`);
  }

  // Если статус PUBLISHED и publishedAt пустой — устанавливаем текущую дату
  const publishedAt =
    input.status === "PUBLISHED" ? new Date() : null;

  // Создаем страницу
  const page = await prisma.page.create({
    data: {
      title: input.title,
      slug: normalizedSlug,
      type: input.type,
      status: input.status || "DRAFT",
      visibility: input.visibility || "PUBLIC",
      excerpt: input.excerpt || null,
      content: input.content || null,
      seoTitle: input.seoTitle || null,
      seoDescription: input.seoDescription || null,
      ogImageUrl: input.ogImageUrl || null,
      publishedAt,
      createdById: userId || null,
      updatedById: userId || null,
    },
  });

  return page;
}

/**
 * Получение страницы по ID
 */
export async function getPageById(id: string): Promise<Page | null> {
  return prisma.page.findUnique({
    where: { id },
    include: {
      createdBy: {
        select: {
          id: true,
          email: true,
          displayName: true,
        },
      },
      updatedBy: {
        select: {
          id: true,
          email: true,
          displayName: true,
        },
      },
    },
  });
}

/**
 * Получение страницы по slug (для публичного отображения)
 */
export async function getPublishedPageBySlug(slug: string): Promise<Page | null> {
  return prisma.page.findFirst({
    where: {
      ...getPublicPageDetailWhere(),
      slug,
    },
  });
}

/**
 * Обновление страницы
 */
export async function updatePage(
  id: string,
  input: UpdatePageInput,
  userId?: string
): Promise<Page> {
  const existing = await prisma.page.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new Error("Страница не найдена");
  }

  // Если меняется slug — нормализуем и проверяем уникальность
  let normalizedSlug: string | undefined;
  if (input.slug && input.slug !== existing.slug) {
    normalizedSlug = normalizeSlug(input.slug);
    const duplicate = await prisma.page.findUnique({
      where: { slug: normalizedSlug },
    });
    if (duplicate && duplicate.id !== id) {
      throw new Error(`Страница с slug "${normalizedSlug}" уже существует`);
    }
  }

  // Логика publishedAt:
  // - Если страница переводится в PUBLISHED впервые (existing.publishedAt === null) — устанавливаем now()
  // - Если страница возвращается в DRAFT — оставляем publishedAt как историческое значение
  let publishedAt = existing.publishedAt;
  if (input.status === "PUBLISHED" && !existing.publishedAt) {
    publishedAt = new Date();
  }

  // Обновляем страницу
  const page = await prisma.page.update({
    where: { id },
    data: {
      ...(input.title && { title: input.title }),
      ...(normalizedSlug && { slug: normalizedSlug }),
      ...(input.type && { type: input.type }),
      ...(input.status && { status: input.status }),
      ...(input.visibility !== undefined && { visibility: input.visibility }),
      ...(input.excerpt !== undefined && { excerpt: input.excerpt }),
      ...(input.content !== undefined && { content: input.content }),
      ...(input.seoTitle !== undefined && { seoTitle: input.seoTitle }),
      ...(input.seoDescription !== undefined && { seoDescription: input.seoDescription }),
      ...(input.ogImageUrl !== undefined && { ogImageUrl: input.ogImageUrl }),
      publishedAt,
      updatedById: userId || null,
    },
  });

  return page;
}

/**
 * Soft delete (архивирование) страницы
 */
export async function archivePage(id: string, userId?: string): Promise<Page> {
  return prisma.page.update({
    where: { id },
    data: {
      status: "ARCHIVED",
      updatedById: userId || null,
    },
  });
}

/**
 * Получение списка страниц с фильтрацией и пагинацией
 */
export async function listPages(query: ListPagesQuery) {
  const { page, pageSize, status, type, search, sortBy, sortOrder } = query;

  // Формируем where условие
  const where: Prisma.PageWhereInput = {
    ...(status && { status }),
    ...(type && { type }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
      ],
    }),
  };

  // Получаем общее количество
  const total = await prisma.page.count({ where });

  // Получаем страницы
  const items = await prisma.page.findMany({
    where,
    orderBy: {
      [sortBy]: sortOrder,
    },
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: {
      createdBy: {
        select: {
          id: true,
          email: true,
          displayName: true,
        },
      },
      updatedBy: {
        select: {
          id: true,
          email: true,
          displayName: true,
        },
      },
    },
  });

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Получение опубликованных страниц для sitemap
 */
export async function getPublishedPagesForSitemap() {
  return prisma.page.findMany({
    where: getPublicPageIndexWhere(),
    select: {
      slug: true,
      type: true,
      updatedAt: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
}
