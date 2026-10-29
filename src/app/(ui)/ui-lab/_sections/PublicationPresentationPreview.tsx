import "@/styles/event-page.css";
import { PublicationPageLayout } from "@/components/publication-page/PublicationPageLayout";
import { PublicationHeroLayout } from "@/components/publication-page/PublicationHeroLayout";
import { PublicationFactsStrip } from "@/components/publication-page/PublicationFactsStrip";
import { PublicationSection } from "@/components/publication-page/PublicationSection";

/** Synthetic content is confined to UI Lab; these are the real Event presentation components. */
export function PublicationPresentationPreview() {
  return (
    <PublicationPageLayout>
      <PublicationHeroLayout
        media={<div className="aspect-[4/3] bg-muted" aria-label="Место галереи" />}
        decision={<div><h1 className="text-foreground">Длинный заголовок публикации для проверки сетки</h1></div>}
      />
      <PublicationFactsStrip facts={[
        { id: "age", label: "Возраст", value: "6–12 лет" },
        { id: "price", label: "Стоимость", value: "От 25 BYN" },
        { id: "date", label: "Дата", value: "30 октября" },
        { id: "duration", label: "Длительность", value: "90 минут" },
      ]} />
      <PublicationFactsStrip facts={[]} />
      <PublicationSection className="py-16 md:py-20">
        <p>Контент секции. Порядок и условия отображения задаёт страница.</p>
      </PublicationSection>
    </PublicationPageLayout>
  );
}
