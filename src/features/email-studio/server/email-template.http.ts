import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  EmailTemplateServiceError,
} from "@/features/email-studio/server/email-template.errors";

export function jsonValidationError(error: ZodError) {
  return NextResponse.json({ error: error.flatten() }, { status: 400 });
}

export function jsonInvalidJsonError() {
  return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
}

export function jsonUnauthorizedError() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function jsonServiceErrorResponse(error: unknown) {
  if (error instanceof EmailTemplateServiceError) {
    switch (error.code) {
      case "EMAIL_TEMPLATE_NOT_FOUND":
        return NextResponse.json({ error: error.code, message: error.message }, { status: 404 });
      case "EMAIL_TEMPLATE_CONFLICT":
        return NextResponse.json({ error: error.code, message: error.message }, { status: 409 });
      case "EMAIL_TEMPLATE_DELIVERY_UNAVAILABLE":
        return NextResponse.json({ error: error.code, message: error.message }, { status: 503 });
      case "EMAIL_TEMPLATE_SEND_FAILED":
        return NextResponse.json({ error: error.code, message: error.message }, { status: 502 });
      case "EMAIL_TEMPLATE_INVALID":
      default:
        return NextResponse.json({ error: error.code, message: error.message }, { status: 400 });
    }
  }

  return NextResponse.json(
    { error: "INTERNAL_SERVER_ERROR", message: "Internal server error" },
    { status: 500 },
  );
}
