/**
 * GET /api/public/event-categories
 * 
 * Возвращает категории и жанры для Event (publicationType = EVENT).
 * Структура: корневые категории с вложенными жанрами.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Получаем все активные категории EVENT (только корневые)
    const categories = await prisma.eventCategory.findMany({
      where: {
        publicationType: "EVENT",
        isActive: true,
        parentId: null, // только корневые
      },
      select: {
        id: true,
        nameRu: true,
        nameEn: true,
        slug: true,
        icon: true,
        sortOrder: true,
      },
      orderBy: {
        sortOrder: "asc",
      },
    });

    // Получаем жанры для каждой категории
    const categoriesWithGenres = await Promise.all(
      categories.map(async (category) => {
        const genres = await prisma.genre.findMany({
          where: {
            categoryId: category.id,
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            slug: true,
            sortOrder: true,
          },
          orderBy: {
            sortOrder: "asc",
          },
        });

        return {
          id: category.id,
          nameRu: category.nameRu,
          nameEn: category.nameEn,
          slug: category.slug,
          icon: category.icon,
          sortOrder: category.sortOrder,
          genres: genres.map((genre) => ({
            id: genre.id,
            nameRu: genre.name,
            slug: genre.slug,
            sortOrder: genre.sortOrder,
          })),
        };
      })
    );

    return NextResponse.json({ categories: categoriesWithGenres });
  } catch (error) {
    console.error("[event-categories] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch event categories" },
      { status: 500 }
    );
  }
}
