import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrModerator } from "@/lib/article/requireAdminOrModerator";
import { PublishEmailTemplateBodySchema } from "@/features/email-studio/server/email-template.api";
import { publishTemplate } from "@/features/email-studio/server/email-template.service";
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

  const parsed = PublishEmailTemplateBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonValidationError(parsed.error);
  }

  try {
    const result = await publishTemplate(id, {
      createdByUserId: user.id,
    });

    return NextResponse.json({
      template: result.template,
      publishedVersion: result.template.version,
      ...(result.warning ? { warning: result.warning } : {}),
    });
  } catch (error) {
    console.error("[admin/email-templates/:id/publish POST]", error);
    return jsonServiceErrorResponse(error);
  }
}
