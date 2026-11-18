import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import {
  businessAccessRequestSchema,
  createBusinessAccessRequest,
} from "@/server/business/businessAccessRequest.service";

export const runtime = "nodejs";

/**
 * POST /api/business/access-requests — request access to a Business already
 * registered by another owner (matched by УНП). Created after the onboarding
 * form returns BUSINESS_UNP_ALREADY_EXISTS.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED", message: "Требуется авторизация" },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: "INVALID_BODY", message: "Некорректный запрос" },
      { status: 400 },
    );
  }

  let input;
  try {
    input = businessAccessRequestSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          message: "Проверьте поля формы",
          fieldErrors: e.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }
    throw e;
  }

  const result = await createBusinessAccessRequest(user.id, input);

  if (!result.ok) {
    const status =
      result.code === "BUSINESS_NOT_FOUND_BY_UNP" ? 404 : 409;
    return NextResponse.json(result, { status });
  }

  if ("alreadyPending" in result) {
    return NextResponse.json(
      {
        ok: true,
        alreadyPending: true,
        requestId: result.request.id,
        message: "Заявка уже отправлена и ожидает проверки.",
      },
      { status: 200 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      message: "Заявка отправлена. Мы проверим данные и свяжемся с вами.",
      requestId: result.request.id,
    },
    { status: 201 },
  );
}

/**
 * GET /api/business/access-requests?unp=... — authenticated requester checks
 * their own latest access request. Never looks up or reveals other owners,
 * business records, or other applicants by the supplied УНП.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED", message: "Требуется авторизация" },
      { status: 401 },
    );
  }

  const unp = request.nextUrl.searchParams.get("unp") ?? "";
  if (!/^[0-9]{9}$/.test(unp)) {
    return NextResponse.json(
      { ok: false, code: "INVALID_UNP", message: "Проверьте УНП" },
      { status: 400 },
    );
  }

  const existing = await prisma.businessAccessRequest.findFirst({
    where: { requesterUserId: user.id, unp },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, request: existing });
}
