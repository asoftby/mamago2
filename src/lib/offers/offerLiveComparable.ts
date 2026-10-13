import { normalizeRichTextCurrency } from "@/lib/formatters/format-price";
import { normalizeRichTextEditorValue, plainTextToRichTextHtml } from "@/lib/richtext/utils";

/**
 * Мастер не показывает живые значения «как есть»: описание, подпись к цене и акция проходят нормализацию
 * (rich text, валюта), а при отсутствии rich-текста синтезируются из старых полей (`priceText`,
 * `promotionalOffer`). Полный снимок формы, отправленный без правок, поэтому не равен строке в БД.
 *
 * Чтобы такая «правка» не считалась правкой автора, сравнение идёт с живыми значениями в том же виде,
 * в каком их получает форма.
 */
export function liveOfferComparableOverlay(live: {
  description?: string | null;
  priceCaption?: string | null;
  priceText?: string | null;
  promotionDetails?: string | null;
  promotionalOffer?: string | null;
  campProgramType?: string | null;
}): Record<string, unknown> {
  const isCamp = Boolean(live.campProgramType);
  return {
    description: normalizeRichTextEditorValue(live.description),
    priceCaption: isCamp
      ? ""
      : live.priceCaption
        ? normalizeRichTextCurrency(live.priceCaption)
        : live.priceText
          ? plainTextToRichTextHtml(normalizeRichTextCurrency(live.priceText))
          : "",
    promotionDetails: isCamp
      ? ""
      : live.promotionDetails
        ? normalizeRichTextCurrency(live.promotionDetails)
        : live.promotionalOffer
          ? plainTextToRichTextHtml(normalizeRichTextCurrency(live.promotionalOffer))
          : "",
  };
}
