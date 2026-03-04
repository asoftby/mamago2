"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z, ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import prisma from "@/lib/prisma";
import { resolveCompanyByUnp } from "@/server/company/resolveByUnp";

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
  phone: z.string().regex(/^\+\d{7,15}$/, "Неверный формат телефона (E.164)"),
});

export async function createBusinessAction(
  prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  // Check authentication
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?from=business");
  }

  // Extract and validate form data
  const payload = {
    unp: String(formData.get("unp") ?? ""),
    legalName: String(formData.get("legalName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
  };

  try {
    // Validate
    const validated = onboardingSchema.parse(payload);

    // Verify phone is verified
    const userWithPhone = await prisma.user.findUnique({
      where: { id: user.id },
      select: { phoneE164: true, phoneVerifiedAt: true },
    });

    if (!userWithPhone?.phoneVerifiedAt) {
      return {
        ok: false,
        message: "Необходимо подтвердить номер телефона",
      };
    }

    if (userWithPhone.phoneE164 !== validated.phone) {
      return {
        ok: false,
        message: "Номер телефона не совпадает с подтвержденным",
      };
    }

    // Check if business already exists
    const existing = await getMyBusiness(user.id);
    
    // Generate name automatically from legalName or user ID
    const businessName = validated.legalName || `Business ${user.id}`;
    const now = new Date();

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
      await prisma.business.update({
        where: { id: existing.id },
        data: {
          name: businessName,
          unp: validated.unp,
          legalName: validated.legalName,
          phone: validated.phone,
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
    } else {
      // CREATE: New business submission
      await prisma.business.create({
        data: {
          ownerUserId: user.id,
          name: businessName,
          unp: validated.unp,
          legalName: validated.legalName,
          phone: validated.phone,
          // CANONICAL: Set verificationStatus to PENDING
          verificationStatus: "PENDING",
          submittedAt: now,
          // Legacy: Keep status in sync
          status: "PENDING_VERIFICATION",
        },
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
