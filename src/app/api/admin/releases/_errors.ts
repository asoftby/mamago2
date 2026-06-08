import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ReleaseServiceError } from "@/server/services/release.service";

export function releaseErrorResponse(error: unknown): NextResponse {
  if (error instanceof ReleaseServiceError) {
    const status =
      error.code === "NOT_FOUND"
        ? 404
        : error.code === "DUPLICATE_VERSION"
          ? 409
          : 400;

    return NextResponse.json(
      { success: false, error: error.message, code: error.code },
      { status },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        success: false,
        error: "Некорректные данные",
        details: error.flatten(),
      },
      { status: 400 },
    );
  }

  console.error("[admin/releases] Error:", error);
  return NextResponse.json(
    { success: false, error: "Внутренняя ошибка сервера" },
    { status: 500 },
  );
}
