import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrModeratorApiUser } from "@/lib/auth/requireAdminApi";
import { getAdminDialogs, type AdminDialogFilter } from "@/server/services/direct/directAdmin.service";

const VALID_FILTERS: AdminDialogFilter[] = [
  "ALL",
  "ACTIVE",
  "BLOCKED",
  "COMPLETED",
  "ARCHIVE",
  "WITH_COMPLAINTS",
  "NO_BUSINESS_REPLY",
];

export async function GET(request: NextRequest) {
  const auth = await requireAdminOrModeratorApiUser();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const filterParam = searchParams.get("filter") ?? "ALL";
  const filter = (VALID_FILTERS as string[]).includes(filterParam)
    ? (filterParam as AdminDialogFilter)
    : "ALL";
  const search = searchParams.get("q") ?? undefined;

  const dialogs = await getAdminDialogs(filter, search);
  return NextResponse.json({ items: dialogs });
}
