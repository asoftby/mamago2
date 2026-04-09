export type EmailTemplateServiceErrorCode =
  | "EMAIL_TEMPLATE_NOT_FOUND"
  | "EMAIL_TEMPLATE_INVALID"
  | "EMAIL_TEMPLATE_CONFLICT"
  | "EMAIL_TEMPLATE_DELIVERY_UNAVAILABLE"
  | "EMAIL_TEMPLATE_SEND_FAILED";

export class EmailTemplateServiceError extends Error {
  readonly code: EmailTemplateServiceErrorCode;

  constructor(code: EmailTemplateServiceErrorCode, message: string) {
    super(message);
    this.name = "EmailTemplateServiceError";
    this.code = code;
  }
}

export function createEmailTemplateNotFoundError(id: string): EmailTemplateServiceError {
  return new EmailTemplateServiceError(
    "EMAIL_TEMPLATE_NOT_FOUND",
    `Email template "${id}" not found.`,
  );
}

export function createEmailTemplateInvalidError(message: string): EmailTemplateServiceError {
  return new EmailTemplateServiceError("EMAIL_TEMPLATE_INVALID", message);
}

export function createEmailTemplateConflictError(message: string): EmailTemplateServiceError {
  return new EmailTemplateServiceError("EMAIL_TEMPLATE_CONFLICT", message);
}

export function createEmailTemplateDeliveryUnavailableError(
  message: string,
): EmailTemplateServiceError {
  return new EmailTemplateServiceError("EMAIL_TEMPLATE_DELIVERY_UNAVAILABLE", message);
}

export function createEmailTemplateSendFailedError(message: string): EmailTemplateServiceError {
  return new EmailTemplateServiceError("EMAIL_TEMPLATE_SEND_FAILED", message);
}
