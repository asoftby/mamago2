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
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  // Check authentication
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?from=business");
  }

  // Check if business already exists
  const existing = await getMyBusiness(user.id);
  if (existing) {
    // If business exists, check status and redirect accordingly
    if (existing.status === "PENDING_VERIFICATION" || existing.status === "PENDING_REVIEW") {
      redirect("/business/verification");
    } else if (existing.status === "APPROVED") {
      redirect("/business/dashboard");
    } else if (existing.status === "REJECTED") {
      redirect("/business/verification");
    }
    redirect("/business/dashboard");
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

    // Create business with PENDING_VERIFICATION status
    // Generate name automatically from legalName or user ID
    const businessName = validated.legalName || `Business ${user.id}`;
    
    await prisma.business.create({
      data: {
        ownerUserId: user.id,
        name: businessName,
        unp: validated.unp,
        legalName: validated.legalName,
        phone: validated.phone,
        status: "PENDING_VERIFICATION",
      },
    });
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
  redirect("/business/verification");
}
