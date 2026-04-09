import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrModerator } from "@/lib/article/requireAdminOrModerator";
import { PreviewEmailTemplateBodySchema } from "@/features/email-studio/server/email-template.api";
import { renderEmailTemplatePreview } from "@/features/email-studio/server/email-template-preview-render.service";
import {
  jsonInvalidJsonError,
  jsonServiceErrorResponse,
  jsonUnauthorizedError,
  jsonValidationError,
} from "@/features/email-studio/server/email-template.http";

export async function POST(req: NextRequest) {
  const user = await requireAdminOrModerator();
  if (!user) {
    return jsonUnauthorizedError();
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonInvalidJsonError();
  }

  const parsed = PreviewEmailTemplateBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonValidationError(parsed.error);
  }

  try {
    const preview = await renderEmailTemplatePreview(parsed.data);
    return NextResponse.json(preview);
  } catch (error) {
    console.error("[admin/email-templates/preview POST]", error);
    return jsonServiceErrorResponse(error);
  }
}
