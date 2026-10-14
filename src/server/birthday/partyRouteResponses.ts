import { NextResponse } from "next/server";
import { z } from "zod";
import { PartyApiError } from "./partyDraft.validation";

export function partyRouteError(error: unknown): NextResponse {
  if (error instanceof PartyApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json({
      error: "Проверьте данные", details: error.issues,
    }, { status: 422 });
  }
  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }
  console.error("[party/route] Unexpected failure", error);
  return NextResponse.json({ error: "Временная ошибка сервера" }, { status: 500 });
}

export function privatePartyResponse(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
