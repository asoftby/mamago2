import { NextRequest } from "next/server";
import {
  handleEntitySetIndexation,
  handleEntityToggleIndexation,
} from "@/lib/admin/seo/entities/http";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleEntityToggleIndexation(req, "article", id);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleEntitySetIndexation(req, "article", id);
}

