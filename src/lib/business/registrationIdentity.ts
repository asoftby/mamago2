import { z } from "zod";

export const subjectTypes = ["COMPANY", "SOLE_PROPRIETOR", "SELF_EMPLOYED_NPD"] as const;
export const registrationSchema = z.object({
  subjectType: z.enum(subjectTypes),
  unp: z.string().trim().regex(/^\d{9}$/, "УНП должен содержать 9 цифр"),
  legalName: z.string().trim().max(200).default(""),
  registrationFullName: z.string().trim().max(200).default(""),
  publicName: z.string().trim().min(2).max(200),
  phone: z.string().min(1),
}).superRefine((value, ctx) => {
  const field = value.subjectType === "SELF_EMPLOYED_NPD" ? "registrationFullName" : "legalName";
  if (value[field].length < 2) ctx.addIssue({ code: "custom", path: [field], message: "Минимум 2 символа" });
});
export type RegistrationIdentity = {
  subjectType: string; unp: string | null; legalName: string | null; registrationFullName: string | null;
};
export function businessPayerIdentity(business: RegistrationIdentity) {
  return {
    payerType: business.subjectType === "COMPANY" ? "LEGAL_ENTITY" : business.subjectType === "SOLE_PROPRIETOR" ? "SOLE_PROPRIETOR" : business.subjectType === "SELF_EMPLOYED_NPD" ? "SELF_EMPLOYED" : "UNSPECIFIED",
    legalName: business.subjectType === "SELF_EMPLOYED_NPD" ? business.registrationFullName ?? "" : business.legalName ?? "",
    unp: business.unp,
  };
}
export const NPD_SOURCE = "https://lkfl.portal.nalog.gov.by/web/guest/check_registration";
