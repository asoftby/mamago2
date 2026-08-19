import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrModeratorApiUser } from "@/lib/auth/requireAdminApi";
import {
  getDirectAuditLogsForAdmin,
  type DirectAuditEntityTypeFilter,
} from "@/server/services/direct/directAdmin.service";

const VALID_ENTITY_TYPES: DirectAuditEntityTypeFilter[] = [
  "ALL",
  "DIRECT_THREAD",
  "DIRECT_MESSAGE",
  "DIRECT_COMPLAINT",
];

export async function GET(request: NextRequest) {
  const auth = await requireAdminOrModeratorApiUser();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const entityTypeParam = searchParams.get("entityType") ?? "ALL";
  const entityType = (VALID_ENTITY_TYPES as string[]).includes(entityTypeParam)
    ? (entityTypeParam as DirectAuditEntityTypeFilter)
    : "ALL";

  const logs = await getDirectAuditLogsForAdmin(entityType);
  return NextResponse.json({ items: logs });
}
