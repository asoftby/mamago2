import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdminApiUser } from "@/lib/auth/requireAdminApi";
import {
  isAllowedGovernmentRequestOrigin,
  updateGovernmentRequestSchema,
} from "@/server/compliance/governmentRequests.policy";
import {
  getGovernmentRequest,
  updateGovernmentRequest,
  GovernmentRequestConflictError,
  GovernmentRequestNotFoundError,
} from "@/server/compliance/governmentRequests.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };
const NO_STORE = { "Cache-Control": "no-store" };
function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}
function validId(id: string) {
  return /^[A-Za-z0-9_-]{8,120}$/.test(id);
}

export async function GET(_request: NextRequest, { params }: Context) {
  const actor = await requireAdminApiUser();
  if (actor instanceof NextResponse) return actor;
  const { id } = await params;
  if (!validId(id)) return response({ error: "Invalid ID" }, 400);
  try {
    return response(await getGovernmentRequest(prisma, actor, id));
  } catch (error) {
    if (error instanceof GovernmentRequestNotFoundError) return response({ error: "Not found" }, 404);
    return response({ error: "Unable to read case" }, 500);
  }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  const actor = await requireAdminApiUser();
  if (actor instanceof NextResponse) return actor;
  if (!isAllowedGovernmentRequestOrigin(
    request.headers.get("origin"),
    request.nextUrl.origin,
    request.headers.get("sec-fetch-site"),
  )) return response({ error: "Forbidden origin" }, 403);

  const { id } = await params;
  if (!validId(id)) return response({ error: "Invalid ID" }, 400);
  if (Number(request.headers.get("content-length") || "0") > 4096) {
    return response({ error: "Request too large" }, 413);
  }
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > 4096) return response({ error: "Request too large" }, 413);
    body = JSON.parse(text);
  } catch {
    return response({ error: "Invalid JSON" }, 400);
  }
  const parsed = updateGovernmentRequestSchema.safeParse(body);
  if (!parsed.success) return response({ error: "Invalid request fields" }, 400);

  try {
    const updated = await updateGovernmentRequest(prisma, actor, id, parsed.data);
    return response({ case: { id: updated.id, status: updated.status } });
  } catch (error) {
    if (error instanceof GovernmentRequestNotFoundError) return response({ error: "Not found" }, 404);
    if (error instanceof GovernmentRequestConflictError) return response({ error: "Invalid status transition" }, 409);
    return response({ error: "Unable to update case" }, 500);
  }
}
