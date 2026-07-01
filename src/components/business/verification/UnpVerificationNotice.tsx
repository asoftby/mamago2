import type { Business } from "@prisma/client";

const CONTAINER_CLASS_BY_TONE: Record<"info" | "warn" | "success", string> = {
  info: "mt-2 rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-800",
  warn: "mt-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800",
  success: "mt-2 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-800",
};

/**
 * Ненавязчивое уведомление о результате автоматической сверки УНП с ГРП.
 * Никогда не блокирует прохождение модерации — это доп. сигнал для
 * пользователя, окончательное решение всё равно принимает модератор.
 */
export function UnpVerificationNotice({
  business,
}: {
  business: Pick<Business, "unpVerificationStatus" | "unpOfficialName">;
}) {
  switch (business.unpVerificationStatus) {
    case "VERIFIED":
      return (
        <div className={CONTAINER_CLASS_BY_TONE.success}>
          УНП автоматически подтверждён в реестре ГРП.
        </div>
      );
    case "NAME_MISMATCH":
      return (
        <div className={CONTAINER_CLASS_BY_TONE.warn}>
          Указанное название отличается от официального в реестре ГРП
          {business.unpOfficialName ? `: «${business.unpOfficialName}»` : ""}. Если это ваша
          компания — всё в порядке, данные сверят при модерации.
        </div>
      );
    case "INACTIVE":
      return (
        <div className={CONTAINER_CLASS_BY_TONE.warn}>
          По данным ГРП организация не имеет статуса «Действующий» (в процессе ликвидации или
          исключена из реестра). Это не блокирует заявку — модератор проверит данные вручную.
        </div>
      );
    case "NOT_FOUND":
      return (
        <div className={CONTAINER_CLASS_BY_TONE.warn}>
          УНП не найден в реестре ГРП. Проверьте корректность номера — заявка всё равно отправлена
          и будет проверена модератором.
        </div>
      );
    case "LOOKUP_FAILED":
      return (
        <div className={CONTAINER_CLASS_BY_TONE.info}>
          Не удалось автоматически сверить УНП с реестром (сервис временно недоступен). Данные
          проверит модератор вручную.
        </div>
      );
    case "PENDING":
    default:
      return null;
  }
}
