import { AdminUIRulesSection } from "../../ui-lab-admin/_sections/AdminUIRulesSection";
import { LayoutContractSection } from "../../ui-lab-admin/_sections/LayoutContractSection";
import { TypographySection } from "../../ui-lab-admin/_sections/TypographySection";
import { HeaderSection } from "../../ui-lab-admin/_sections/HeaderSection";
import { PageStructureSection } from "../../ui-lab-admin/_sections/PageStructureSection";
import { ToolbarsSection } from "../../ui-lab-admin/_sections/ToolbarsSection";
import { KpiCardsSection } from "../../ui-lab-admin/_sections/KpiCardsSection";
import { ContentShellsSection } from "../../ui-lab-admin/_sections/ContentShellsSection";
import { ListsQueuesSection } from "../../ui-lab-admin/_sections/ListsQueuesSection";
import { StatesSection } from "../../ui-lab-admin/_sections/StatesSection";
import { FormsSection } from "../../ui-lab-admin/_sections/FormsSection";
import { OverlaysSection } from "../../ui-lab-admin/_sections/OverlaysSection";
import { EventScheduleSection } from "../../ui-lab-admin/_sections/EventScheduleSection";
import { ActivityFormBuilderSection } from "../../ui-lab-admin/_sections/ActivityFormBuilderSection";

/** Keep existing admin examples reviewable without treating legacy styles as normative. */
export function LegacyAdminSection() {
  return (
    <div className="space-y-10">
      <div className="rounded-xl border border-warning bg-warning-soft p-5">
        <h2 className="text-xl font-semibold">Архив административных паттернов</h2>
        <p className="mt-2 text-sm">
          Ниже сохранены исходные примеры из /ui-lab-admin. Их старые синие/серые стили, отдельные отступы
          и исторические заявления «single source of truth» не утверждены в mamaGo Design System 2.0.
          Реальные компоненты переносятся в единый каталог только после ревью.
        </p>
      </div>
      <AdminUIRulesSection />
      <LayoutContractSection />
      <TypographySection />
      <HeaderSection />
      <PageStructureSection />
      <ToolbarsSection />
      <KpiCardsSection />
      <ContentShellsSection />
      <ListsQueuesSection />
      <StatesSection />
      <FormsSection />
      <OverlaysSection />
      <EventScheduleSection />
      <ActivityFormBuilderSection />
    </div>
  );
}
