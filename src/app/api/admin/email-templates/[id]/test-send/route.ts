import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrModerator } from "@/lib/article/requireAdminOrModerator";
import { TestSendEmailTemplateBodySchema } from "@/features/email-studio/server/email-template.api";
import { sendTestEmail } from "@/features/email-studio/server/email-template-test-send.service";
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
    body = await req.json();
  } catch {
    return jsonInvalidJsonError();
  }

  const parsed = TestSendEmailTemplateBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonValidationError(parsed.error);
  }

  try {
    const result = await sendTestEmail({
      templateId: id,
      to: parsed.data.email,
      previewPreset: parsed.data.previewPreset,
      renderContext: parsed.data.renderContext,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[admin/email-templates/:id/test-send POST]", error);
    return jsonServiceErrorResponse(error);
  }
}
