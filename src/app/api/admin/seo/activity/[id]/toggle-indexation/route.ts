import { NextRequest } from "next/server";
import { handleEntityToggleIndexation } from "@/lib/admin/seo/entities/http";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handleEntityToggleIndexation(req, "activity", id);
}

