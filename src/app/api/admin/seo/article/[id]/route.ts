import { NextRequest } from "next/server";
import { handleEntitySeoGet, handleEntitySeoPatch } from "@/lib/admin/seo/entities/http";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleEntitySeoGet("article", id);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleEntitySeoPatch(req, "article", id);
}

