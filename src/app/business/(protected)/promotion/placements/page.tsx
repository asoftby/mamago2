import { BusinessPlaceholderPage } from "@/components/business/sections/BusinessPlaceholderPage";
import {
  BUSINESS_EVENTS_HREF,
  BUSINESS_OFFERS_HREF,
  BUSINESS_PROMOTION_OVERVIEW_HREF,
} from "@/lib/business/navigation";

export default function BusinessPromotionPlacementsPage() {
  return (
    <BusinessPlaceholderPage
      eyebrow="Promotion"
      title="Placements"
      description="Доступные поверхности продвижения будут описаны как понятные продуктовые размещения, а не как набор рекламных слотов."
      summary="Для бизнеса это должен быть каталог простых вариантов усиления спроса: лента, рекомендации, заметные блоки в ключевых местах продукта. Раздел уже подготовлен под эту модель, даже если часть размещений ещё не подключена."
      nextActionLabel="Вернуться к обзору продвижения"
      nextActionHref={BUSINESS_PROMOTION_OVERVIEW_HREF}
      bullets={[
        "Feed placements — когда нужно увеличить охват события или предложения.",
        "Recommendation blocks — когда важнее получить целевые сохранения и переходы.",
        "Top placements — когда нужен короткий заметный импульс для важной публикации.",
      ]}
      secondaryLinks={[
        { label: "Events", href: BUSINESS_EVENTS_HREF },
        { label: "Offers", href: BUSINESS_OFFERS_HREF },
      ]}
    />
  );
}
