import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrModeratorApiUser } from "@/lib/auth/requireAdminApi";
import {
  editorialRequestInputSchema,
  editorialRequestListQuerySchema,
} from "@/lib/editorial/schemas";
import {
  createEditorialRequest,
  listEditorialRequests,
} from "@/server/editorial/editorialRequestService";

export async function GET(request: NextRequest) {
  const auth = await requireAdminOrModeratorApiUser();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const parsed = editorialRequestListQuerySchema.safeParse(
    Object.fromEntries(searchParams.entries()),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const items = await listEditorialRequests(parsed.data);
  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminOrModeratorApiUser();
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = editorialRequestInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation error", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const created = await createEditorialRequest(parsed.data, auth.id);
  return NextResponse.json({ item: created }, { status: 201 });
}
