import { NextResponse } from "next/server";
import { requireAdminOrModerator } from "@/lib/article/requireAdminOrModerator";
import { listTemplateVersions } from "@/features/email-studio/server/email-template-version.service";
import {
  jsonServiceErrorResponse,
  jsonUnauthorizedError,
} from "@/features/email-studio/server/email-template.http";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireAdminOrModerator();
  if (!user) {
    return jsonUnauthorizedError();
  }

  const { id } = await params;

  try {
    const versions = await listTemplateVersions(id);
    return NextResponse.json({ versions });
  } catch (error) {
    console.error("[admin/email-templates/:id/versions GET]", error);
    return jsonServiceErrorResponse(error);
  }
}
