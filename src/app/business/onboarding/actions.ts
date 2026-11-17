"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { getOwnedBusinessProfile } from "@/server/business/getMyBusiness";
import { canChangeApprovedBusinessRegistration } from "@/server/permissions/business-permissions";
import prisma from "@/lib/prisma";
import {
  notifyAdminsBusinessApplicationCreated,
  notifyBusinessVerificationSubmitted,
} from "@/server/services/notification.service";

/**
 * Fire-and-forget: on-site/telegram уведомления админам и владельцу
 * о поданной заявке. Не блокирует ответ пользователю.
 */
function notifyBusinessVerificationSubmittedBundle(params: {
  businessId: string;
  businessName: string;
  ownerUserId: string;
  ownerEmail: string | null;
}): void {
  notifyAdminsBusinessApplicationCreated({
    businessId: params.businessId,
    businessName: params.businessName,
    ownerEmail: params.ownerEmail,
  }).catch((e) =>
    console.error("[onboarding] notifyAdminsBusinessApplicationCreated failed:", e),
  );
  notifyBusinessVerificationSubmitted(
    params.businessId,
    params.businessName,
    params.ownerUserId,
  ).catch((e) =>
    console.error("[onboarding] notifyBusinessVerificationSubmitted failed:", e),
  );
}
import {
  isBusinessContactPhoneVerifiedForUser,
  normalizeBusinessContactPhone,
} from "@/lib/phone-verification/businessContactVerification";
import { resolveBusinessUnpVerification } from "@/server/egr/resolveUnpVerification";

import { registrationSchema } from "@/lib/business/registrationIdentity";

type ActionState =
  | { ok: true }
  | {
      ok: false;
      message: string;
      code?: "BUSINESS_UNP_ALREADY_EXISTS";
      field?: "unp";
      fieldErrors?: Record<string, string[]>;
    };

const UNP_ALREADY_EXISTS_MESSAGE =
  "Бизнес с таким УНП уже зарегистрирован. Если это ваш бизнес, отправьте запрос на доступ.";

function buildUnpAlreadyExistsError(): ActionState {
  return {
    ok: false,
    message: UNP_ALREADY_EXISTS_MESSAGE,
    code: "BUSINESS_UNP_ALREADY_EXISTS",
    field: "unp",
  };
}


function buildPhoneVerificationFieldError(): ActionState {
  return {
    ok: false,
    message: "Подтвердите номер телефона, чтобы отправить профиль на проверку",
    fieldErrors: {
      phone: ["Подтвердите номер телефона, чтобы отправить профиль на проверку"],
    },
  };
}

function isExistingBusinessPhoneVerified(params: {
  business:
    | { phone: string | null; contactPhoneVerifiedAt: Date | null }
    | null
    | undefined;
  phoneE164: string;
}) {
  return (
    params.business?.phone === params.phoneE164 &&
    params.business.contactPhoneVerifiedAt instanceof Date
  );
}

export async function createBusinessAction(
  prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  // Check authentication
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // Extract and validate form data
  const payload = {
    subjectType: String(formData.get("subjectType") ?? ""),
    registrationFullName: String(formData.get("registrationFullName") ?? ""),
    publicName: String(formData.get("publicName") ?? ""),
    unp: String(formData.get("unp") ?? ""),
    legalName: String(formData.get("legalName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
  };

  try {
    // Validate
    const validated = registrationSchema.parse(payload);
    const phoneE164 = normalizeBusinessContactPhone(validated.phone);

    // Duplicate УНП guard: Business.ownerUserId is unique (one business per owner), so a
    // match owned by a different user always means a different, conflicting business —
    // this single check covers both the create and the update (resubmit) branches below.
    const businessWithSameUnp = await prisma.business.findFirst({
      where: { unp: validated.unp },
      select: { ownerUserId: true },
    });
    if (businessWithSameUnp && businessWithSameUnp.ownerUserId !== user.id) {
      return buildUnpAlreadyExistsError();
    }

    // Check if business already exists
    const existing = await getOwnedBusinessProfile(user.id);
    const existingPhoneStillVerified = isExistingBusinessPhoneVerified({
      business: existing,
      phoneE164,
    });
    const userVerifiedThisPhone = isBusinessContactPhoneVerifiedForUser({
      phoneE164,
      userPhoneE164: user.phoneE164,
      userPhoneVerifiedAt: user.phoneVerifiedAt,
    });
    const businessContactVerifiedThisPhone = isBusinessContactPhoneVerifiedForUser({
      phoneE164,
      userPhoneE164: user.businessContactVerifiedPhoneE164,
      userPhoneVerifiedAt: user.businessContactPhoneVerifiedAt,
    });

    // Client-side hidden inputs or localStorage drafts are not trusted evidence.
    if (!existingPhoneStillVerified && !userVerifiedThisPhone && !businessContactVerifiedThisPhone) {
      return buildPhoneVerificationFieldError();
    }

    // Автоматическая сверка УНП с ГРП. Fail-open: resolveBusinessUnpVerification
    // никогда не бросает исключение — недоступность реестра оседает как
    // unpVerificationStatus: "LOOKUP_FAILED" и не блокирует отправку заявки
    // (модератор видит статус и официальное название в админке).
    const unpVerification = validated.subjectType === "SELF_EMPLOYED_NPD"
      ? { status: "PENDING" as const, verifiedAt: null, officialName: null, checkedAt: null }
      : await resolveBusinessUnpVerification(
      validated.unp,
      validated.legalName,
    );

    // Public display name is independent of registration identity.
    const businessName = validated.publicName;
    const now = new Date();
    const contactPhoneVerifiedAt =
      existingPhoneStillVerified && existing?.contactPhoneVerifiedAt
        ? existing.contactPhoneVerifiedAt
        : businessContactVerifiedThisPhone
          ? user.businessContactPhoneVerifiedAt
          : user.phoneVerifiedAt;

    if (existing) {
      // UPSERT: Update existing business and resubmit
      // Use getEffectiveVerificationStatus to check current status
      const { getEffectiveVerificationStatus } = await import("@/server/services/businessStatusMap");
      const currentStatus = getEffectiveVerificationStatus(existing);
      const isIdentityChange = formData.get("requestIdentityChange") === "true";

      // The identity-change flag is untrusted form data. Active OWNER membership
      // is required; an ownerUserId alone does not grant access after revocation.
      if (currentStatus === "APPROVED" && isIdentityChange) {
        if (!(await canChangeApprovedBusinessRegistration(user.id, existing.id))) {
          return { ok: false, message: "Нет доступа к изменению регистрационных данных" };
        }
      }

      // If APPROVED, redirect to dashboard (shouldn't be editing)
      if (currentStatus === "APPROVED" && !isIdentityChange) {
        redirect("/business/dashboard");
      }

      // If PENDING, redirect to verification (shouldn't be editing)
      if (currentStatus === "PENDING") {
        redirect("/business/verification");
      }

      // DRAFT or REJECTED: Allow update and resubmit
      const updated = await prisma.business.update({
        where: { id: existing.id, updatedAt: existing.updatedAt, verificationStatus: { in: isIdentityChange ? ["APPROVED", "DRAFT", "REJECTED", "NEEDS_INFO"] : ["DRAFT", "REJECTED", "NEEDS_INFO"] } },
        data: {
          name: businessName,
          unp: validated.unp,
          subjectType: validated.subjectType,
          registrationFullName: validated.subjectType === "SELF_EMPLOYED_NPD" ? validated.registrationFullName : null,
          legalName: validated.subjectType === "SELF_EMPLOYED_NPD" ? null : validated.legalName,
          npdCheckStatus: "REVIEW_REQUIRED",
          npdCheckedAt: null, npdCheckedByUserId: null, npdCheckSource: null,
          phone: phoneE164,
          contactPhoneVerifiedAt,
          // CANONICAL: Set verificationStatus to PENDING
          verificationStatus: "PENDING",
          isVerified: false,
          approvedAt: null,
          submittedAt: now,
          // Clear moderation fields on resubmit
          reviewedAt: null,
          reviewedByUserId: null,
          reviewNote: null,
          rejectedAt: null,
          // Legacy: Keep status in sync
          status: "PENDING_VERIFICATION",
          unpVerificationStatus: unpVerification.status,
          unpVerifiedAt: unpVerification.verifiedAt,
          unpOfficialName: unpVerification.officialName,
          unpLastCheckedAt: unpVerification.checkedAt,
        },
      });
      notifyBusinessVerificationSubmittedBundle({
        businessId: updated.id,
        businessName: updated.name,
        ownerUserId: updated.ownerUserId,
        ownerEmail: user.email ?? null,
      });
    } else {
      // CREATE: New business submission
      const created = await prisma.business.create({
        data: {
          ownerUserId: user.id,
          name: businessName,
          unp: validated.unp,
          subjectType: validated.subjectType,
          registrationFullName: validated.subjectType === "SELF_EMPLOYED_NPD" ? validated.registrationFullName : null,
          legalName: validated.subjectType === "SELF_EMPLOYED_NPD" ? null : validated.legalName,
          npdCheckStatus: "REVIEW_REQUIRED",
          npdCheckedAt: null, npdCheckedByUserId: null, npdCheckSource: null,
          phone: phoneE164,
          contactPhoneVerifiedAt,
          // CANONICAL: Set verificationStatus to PENDING
          verificationStatus: "PENDING",
          isVerified: false,
          approvedAt: null,
          submittedAt: now,
          // Legacy: Keep status in sync
          status: "PENDING_VERIFICATION",
          unpVerificationStatus: unpVerification.status,
          unpVerifiedAt: unpVerification.verifiedAt,
          unpOfficialName: unpVerification.officialName,
          unpLastCheckedAt: unpVerification.checkedAt,
        },
      });
      notifyBusinessVerificationSubmittedBundle({
        businessId: created.id,
        businessName: created.name,
        ownerUserId: created.ownerUserId,
        ownerEmail: user.email ?? null,
      });
    }
  } catch (e) {
    unstable_rethrow(e);
    // Handle Zod validation errors
    if (e instanceof ZodError) {
      return {
        ok: false,
        message: "Проверьте поля формы",
        fieldErrors: e.flatten().fieldErrors,
      };
    }

    if (e instanceof Error && e.message === "Неверный формат телефона") {
      return {
        ok: false,
        message: "Проверьте номер телефона",
        fieldErrors: {
          phone: ["Введите корректный номер телефона"],
        },
      };
    }

    // Handle Prisma unique constraint error (P2002) — defense-in-depth against a
    // race condition where two requests pass the findFirst check concurrently.
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      const target = "meta" in e && e.meta && typeof e.meta === "object" && "target" in e.meta
        ? e.meta.target
        : undefined;
      const targetsUnp =
        Array.isArray(target) ? target.includes("unp") : target === "unp";
      if (targetsUnp) {
        return buildUnpAlreadyExistsError();
      }

      console.error("Business creation error (P2002):", e);
      return {
        ok: false,
        message: "Не удалось отправить заявку. Попробуйте ещё раз.",
      };
    }

    // Generic error
    console.error("Business creation error:", e);
    return {
      ok: false,
      message: "Не удалось отправить заявку. Попробуйте ещё раз.",
    };
  }

  // Success - redirect to verification page
  revalidatePath("/business/verification");
  revalidatePath("/business/dashboard");
  redirect("/business/verification");
}
