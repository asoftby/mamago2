import { NextResponse } from "next/server";
import { IdeaCollectionError } from "./ideaCollections.service";

/** Ошибка сервиса → JSON-ответ; null — ошибка не наша, пусть обработает вызывающий. */
export function ideaCollectionErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof IdeaCollectionError)) return null;
  return NextResponse.json({ error: error.code }, { status: error.status });
}
