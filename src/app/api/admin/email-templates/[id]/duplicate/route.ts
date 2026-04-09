import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrModerator } from "@/lib/article/requireAdminOrModerator";
import { DuplicateEmailTemplateBodySchema } from "@/features/email-studio/server/email-template.api";
import { duplicateTemplate } from "@/features/email-studio/server/email-template.service";
import {
  jsonInvalidJsonError,
  jsonServiceErrorResponse,
  jsonUnauthorizedError,
  jsonValidationError,
} from "@/features/email-studio/server/email-template.http";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireAdminOrModerator();
  if (!user) {
    return jsonUnauthorizedError();
  }

  const { id } = await params;

  let body: unknown;
  try {
    const rawBody = await req.text();
    body = rawBody.trim() ? JSON.parse(rawBody) : {};
  } catch {
    return jsonInvalidJsonError();
  }

  const parsed = DuplicateEmailTemplateBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonValidationError(parsed.error);
  }

  try {
    const template = await duplicateTemplate(id);
    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error("[admin/email-templates/:id/duplicate POST]", error);
    return jsonServiceErrorResponse(error);
  }
}
