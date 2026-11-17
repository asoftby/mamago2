import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireAdminApiUser } from "@/lib/auth/requireAdminApi";
import {
  createGovernmentRequestSchema,
  isAllowedGovernmentRequestOrigin,
} from "@/server/compliance/governmentRequests.policy";
import {
  createGovernmentRequest,
  listGovernmentRequests,
} from "@/server/compliance/governmentRequests.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export async function GET(request: NextRequest) {
  const actor = await requireAdminApiUser();
  if (actor instanceof NextResponse) return actor;
  const pageString = request.nextUrl.searchParams.get("page") ?? "1";
  if (!/^[1-9]\d{0,3}$/.test(pageString)) return response({ error: "Invalid page" }, 400);
  try {
    return response(await listGovernmentRequests(prisma, actor, Number(pageString)));
  } catch {
    return response({ error: "Registry unavailable" }, 500);
  }
}

export async function POST(request: NextRequest) {
  const actor = await requireAdminApiUser();
  if (actor instanceof NextResponse) return actor;
  if (!isAllowedGovernmentRequestOrigin(
    request.headers.get("origin"),
    request.nextUrl.origin,
    request.headers.get("sec-fetch-site"),
  )) return response({ error: "Forbidden origin" }, 403);

  if (Number(request.headers.get("content-length") || "0") > 8192) {
    return response({ error: "Request too large" }, 413);
  }

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > 8192) return response({ error: "Request too large" }, 413);
    body = JSON.parse(text);
  } catch {
    return response({ error: "Invalid JSON" }, 400);
  }
  const parsed = createGovernmentRequestSchema.safeParse(body);
  if (!parsed.success) return response({ error: "Invalid request fields" }, 400);

  try {
    const created = await createGovernmentRequest(prisma, actor, parsed.data);
    return response({ case: { id: created.id, status: created.status } }, 201);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return response({ error: "This incoming document is already registered" }, 409);
    }
    return response({ error: "Unable to create request" }, 500);
  }
}
