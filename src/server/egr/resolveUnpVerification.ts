import type { BusinessUnpVerificationStatus } from "@prisma/client";
import { companyNamesLikelyMatch } from "@/lib/verification/companyNameMatch";
import { lookupUnpInEgr } from "./verifyUnp";

export interface UnpVerificationResult {
  status: BusinessUnpVerificationStatus;
  officialName: string | null;
  verifiedAt: Date | null;
  checkedAt: Date;
}

/**
 * Сверяет УНП с ГРП и сравнивает введённое название с официальным.
 * Никогда не бросает исключение — недоступность реестра/невалидный УНП
 * трактуются как явные, не блокирующие регистрацию статусы
 * (LOOKUP_FAILED / NOT_FOUND), см. STOP-отчёт Фазы 1 и Фазы 2.
 */
export async function resolveBusinessUnpVerification(
  unp: string,
  legalName: string,
): Promise<UnpVerificationResult> {
  const checkedAt = new Date();
  const notFound = (): UnpVerificationResult => ({
    status: "NOT_FOUND",
    officialName: null,
    verifiedAt: null,
    checkedAt,
  });

  let egr;
  try {
    egr = await lookupUnpInEgr(unp);
  } catch (error) {
    // Невалидная контрольная сумма — по построению не может быть реально
    // зарегистрированным УНП в ГРП, сетевой вызов даже не выполнялся.
    console.warn(`[UnpVerification] Invalid УНП checksum for ${unp}:`, error);
    return notFound();
  }

  if (!egr.found) {
    if (egr.networkFailed) {
      return { status: "LOOKUP_FAILED", officialName: null, verifiedAt: null, checkedAt };
    }
    return notFound();
  }

  const officialName = egr.officialNameFull ?? egr.officialNameShort ?? null;

  if (egr.status !== "ACTIVE") {
    const status: BusinessUnpVerificationStatus = "INACTIVE";
    return { status, officialName, verifiedAt: null, checkedAt };
  }

  const nameMatches = companyNamesLikelyMatch(legalName, [
    egr.officialNameShort,
    egr.officialNameFull,
  ]);

  if (!nameMatches) {
    return { status: "NAME_MISMATCH", officialName, verifiedAt: null, checkedAt };
  }

  return { status: "VERIFIED", officialName, verifiedAt: checkedAt, checkedAt };
}
