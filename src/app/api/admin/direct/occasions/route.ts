import { NextRequest, NextResponse } from "next/server";
import { PublicationType } from "@prisma/client";
import { requireAdminOrModeratorApiUser } from "@/lib/auth/requireAdminApi";
import { getAdminOccasions, type AdminOccasionFilter } from "@/server/services/direct/directAdmin.service";

const VALID_FILTERS: AdminOccasionFilter[] = ["ALL", "NEW", "ACTIVE", "COMPLETED", "BLOCKED", "ARCHIVE"];
const VALID_PUBLICATION_TYPES: PublicationType[] = [
  PublicationType.OFFER,
  PublicationType.EVENT,
  PublicationType.PLACE,
];

export async function GET(request: NextRequest) {
  const auth = await requireAdminOrModeratorApiUser();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const filterParam = searchParams.get("filter") ?? "ALL";
  const filter = (VALID_FILTERS as string[]).includes(filterParam)
    ? (filterParam as AdminOccasionFilter)
    : "ALL";

  const publicationTypeParam = searchParams.get("publicationType");
  const publicationType = (VALID_PUBLICATION_TYPES as string[]).includes(publicationTypeParam ?? "")
    ? (publicationTypeParam as PublicationType)
    : undefined;

  const search = searchParams.get("q") ?? undefined;

  const occasions = await getAdminOccasions(filter, publicationType, search);
  return NextResponse.json({ items: occasions });
}
