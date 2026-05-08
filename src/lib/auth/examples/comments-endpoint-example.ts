/**
 * ПРИМЕР: API endpoint для комментариев с phone verification gate
 * 
 * Расположение: src/app/api/articles/[id]/comments/route.ts
 * 
 * Этот файл является примером и не используется в production.
 * Скопируйте код в реальный endpoint когда будете реализовывать комментарии.
 * 
 * ВАЖНО: Модель Comment еще не создана. Перед использованием нужно:
 * 1. Создать модель Comment в prisma/schema.prisma
 * 2. Запустить миграцию
 * 3. Адаптировать код под вашу модель
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePhoneVerifiedUser } from "@/lib/auth/requirePhoneVerifiedUser";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/articles/[id]/comments
 * Создание комментария к статье
 * 
 * Требования:
 * - Авторизация
 * - Подтвержденный телефон (verification gate для UGC)
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    console.log("[create-comment] Starting...");
    
    // Verification gate: проверка авторизации и подтверждения телефона
    const userOrError = await requirePhoneVerifiedUser();
    if (userOrError instanceof NextResponse) {
      console.error("[create-comment] Verification gate failed");
      return userOrError;
    }
    const user = userOrError;

    console.log("[create-comment] User verified:", {
      id: user.id,
      email: user.email,
      phoneVerified: !!user.phoneVerifiedAt,
    });

    const { id: articleId } = await context.params;
    console.log("[create-comment] Article ID:", articleId);

    // Получить данные из запроса
    const body = await request.json();
    const { text, parentCommentId } = body;

    // Валидация
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { error: "INVALID_TEXT", message: "Comment text is required" },
        { status: 400 }
      );
    }

    if (text.trim().length < 3) {
      return NextResponse.json(
        { error: "TEXT_TOO_SHORT", message: "Comment must be at least 3 characters" },
        { status: 400 }
      );
    }

    if (text.trim().length > 2000) {
      return NextResponse.json(
        { error: "TEXT_TOO_LONG", message: "Comment must be less than 2000 characters" },
        { status: 400 }
      );
    }

    // TODO: Проверить что статья существует и опубликована
    // TODO: Если parentCommentId, проверить что родительский комментарий существует
    // TODO: Создать комментарий в базе данных

    // Пример структуры данных для создания комментария:
    // const comment = await prisma.comment.create({
    //   data: {
    //     articleId: articleId,
    //     userId: user.id,
    //     parentCommentId: parentCommentId || null,
    //     text: text.trim(),
    //     authorName: user.displayName || user.email,
    //     authorAvatarUrl: user.avatarUrl,
    //     status: "PENDING", // На модерации
    //     publishedAt: new Date(),
    //   },
    // });

    console.log("[create-comment] ✅ Comment would be created here");

    return NextResponse.json({
      success: true,
      data: {
        message: "Спасибо! Комментарий отправлен на модерацию.",
      },
    });
  } catch (error) {
    console.error("[create-comment] ❌ Error:", error);
    console.error("[create-comment] Error stack:", error instanceof Error ? error.stack : "No stack");
    
    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "An unexpected error occurred",
        details: process.env.NODE_ENV === "development" ? String(error) : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/articles/[id]/comments
 * Получение комментариев к статье
 * 
 * Не требует phone verification (только чтение)
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const { id: articleId } = await context.params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    // TODO: Получить опубликованные комментарии из базы данных
    // const comments = await prisma.comment.findMany({
    //   where: {
    //     articleId: articleId,
    //     status: "PUBLISHED",
    //     parentCommentId: null,
    //   },
    //   orderBy: { publishedAt: "desc" },
    //   take: limit,
    //   skip: offset,
    // });

    return NextResponse.json({
      success: true,
      data: {
        comments: [],
        total: 0,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error("[get-comments] Error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to fetch comments" },
      { status: 500 }
    );
  }
}
