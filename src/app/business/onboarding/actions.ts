"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z, ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { getOwnedBusinessProfile } from "@/server/business/getMyBusiness";
import prisma from "@/lib/prisma";
import { resolveCompanyByUnp } from "@/server/company/resolveByUnp";
import { notifyAdminBusinessVerificationPending } from "@/lib/admin/notifyAdminBusinessVerification";
import {
  isBusinessContactPhoneVerifiedForUser,
  normalizeBusinessContactPhone,
} from "@/lib/phone-verification/businessContactVerification";

// Server action for UNP lookup
export async function lookupLegalNameByUnp(unp: string) {
  const result = await resolveCompanyByUnp(unp);
  // Return only legalName and source (no debug info to client)
  return {
    legalName: result.legalName,
    source: result.source,
  };
}

type ActionState =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

const onboardingSchema = z.object({
  unp: z.string().regex(/^[0-9]{9}$/, "УНП должен содержать 9 цифр"),
  legalName: z.string().min(2, "Минимум 2 символа").max(200, "Максимум 200 символов"),
  phone: z.string().min(1, "Укажите номер телефона"),
});

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
    unp: String(formData.get("unp") ?? ""),
    legalName: String(formData.get("legalName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
  };
  const clientVerifiedPhone = String(formData.get("phoneVerificationPhone") ?? "");

  try {
    // Validate
    const validated = onboardingSchema.parse(payload);
    const phoneE164 = normalizeBusinessContactPhone(validated.phone);

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
    const clientConfirmedCurrentPhone = clientVerifiedPhone === phoneE164;

    if (
      !existingPhoneStillVerified &&
      !(clientConfirmedCurrentPhone && userVerifiedThisPhone)
    ) {
      return buildPhoneVerificationFieldError();
    }
    
    // Generate name automatically from legalName or user ID
    const businessName = validated.legalName || `Business ${user.id}`;
    const now = new Date();
    const contactPhoneVerifiedAt =
      existingPhoneStillVerified && existing?.contactPhoneVerifiedAt
        ? existing.contactPhoneVerifiedAt
        : user.phoneVerifiedAt;

    if (existing) {
      // UPSERT: Update existing business and resubmit
      // Use getEffectiveVerificationStatus to check current status
      const { getEffectiveVerificationStatus } = await import("@/server/services/businessStatusMap");
      const currentStatus = getEffectiveVerificationStatus(existing);

      // If APPROVED, redirect to dashboard (shouldn't be editing)
      if (currentStatus === "APPROVED") {
        redirect("/business/dashboard");
      }

      // If PENDING, redirect to verification (shouldn't be editing)
      if (currentStatus === "PENDING") {
        redirect("/business/verification");
      }

      // DRAFT or REJECTED: Allow update and resubmit
      const updated = await prisma.business.update({
        where: { id: existing.id },
        data: {
          name: businessName,
          unp: validated.unp,
          legalName: validated.legalName,
          phone: phoneE164,
          contactPhoneVerifiedAt,
          // CANONICAL: Set verificationStatus to PENDING
          verificationStatus: "PENDING",
          submittedAt: now,
          // Clear moderation fields on resubmit
          reviewedAt: null,
          reviewedByUserId: null,
          reviewNote: null,
          rejectedAt: null,
          // Legacy: Keep status in sync
          status: "PENDING_VERIFICATION",
        },
      });
      notifyAdminBusinessVerificationPending({
        businessId: updated.id,
        name: updated.name,
        legalName: updated.legalName,
        unp: updated.unp,
        ownerEmail: user.email ?? null,
      });
    } else {
      // CREATE: New business submission
      const created = await prisma.business.create({
        data: {
          ownerUserId: user.id,
          name: businessName,
          unp: validated.unp,
          legalName: validated.legalName,
          phone: phoneE164,
          contactPhoneVerifiedAt,
          // CANONICAL: Set verificationStatus to PENDING
          verificationStatus: "PENDING",
          submittedAt: now,
          // Legacy: Keep status in sync
          status: "PENDING_VERIFICATION",
        },
      });
      notifyAdminBusinessVerificationPending({
        businessId: created.id,
        name: created.name,
        legalName: created.legalName,
        unp: created.unp,
        ownerEmail: user.email ?? null,
      });
    }
  } catch (e) {
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

    // Handle Prisma unique constraint error (P2002)
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      // UNP already exists - redirect to verification
      redirect("/business/verification");
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
