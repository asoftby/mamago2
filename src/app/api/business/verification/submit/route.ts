import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { isEmailVerified, jsonEmailNotVerified } from "@/lib/auth/requireVerifiedEmail";
import { submitForVerification } from "@/server/services/businessVerification.service";
import {
  getPartnerCabinetBusiness,
  nextResponseFromBusinessAccessError,
} from "@/server/permissions/business-permissions";

export const runtime = "nodejs";

/**
 * POST /api/business/verification/submit
 * Submit business for verification
 */
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Требуется авторизация" },
        { status: 401 }
      );
    }

    if (!isEmailVerified(user)) {
      return jsonEmailNotVerified();
    }

    // Resolve the partner business only through canonical active membership.
    const business = await getPartnerCabinetBusiness(user.id);
    if (!business) {
      return NextResponse.json(
        { ok: false, error: "Нет доступа к бизнесу" },
        { status: 403 }
      );
    }

    await submitForVerification(business.id, user);

    return NextResponse.json({
      ok: true,
      message: "Заявка отправлена на проверку",
    });
  } catch (error) {
    console.error("[verification/submit] Error:", error);

    const accessResponse = nextResponseFromBusinessAccessError(error);
    if (accessResponse) return accessResponse;

    const errorMessage =
      error instanceof Error ? error.message : "Внутренняя ошибка сервера";

    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 400 }
    );
  }
}
