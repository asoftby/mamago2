import { z } from "zod";

export type StructuredValidationErrorResponse = {
  ok: false;
  code: "VALIDATION_ERROR";
  error: "Validation error";
  message: string;
  fieldErrors: Record<string, string[]>;
  formErrors: string[];
  details: z.ZodIssue[];
};

function toPathKey(path: PropertyKey[]): string {
  return path.map(String).join(".");
}

export function formatZodErrorResponse(
  error: z.ZodError,
  fallbackMessage = "Проверьте поля формы",
): StructuredValidationErrorResponse {
  const fieldErrors = error.issues.reduce<Record<string, string[]>>((acc, issue) => {
    const key = toPathKey(issue.path);
    if (!key) return acc;
    const bucket = acc[key] ?? [];
    bucket.push(issue.message);
    acc[key] = bucket;
    return acc;
  }, {});

  const flattened = error.flatten();
  const formErrors = [...flattened.formErrors];
  const message =
    formErrors[0] ??
    Object.values(fieldErrors).flat()[0] ??
    fallbackMessage;

  return {
    ok: false,
    code: "VALIDATION_ERROR",
    error: "Validation error",
    message,
    fieldErrors,
    formErrors,
    details: error.issues,
  };
}
