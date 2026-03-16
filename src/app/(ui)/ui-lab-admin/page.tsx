import { AdminUIRulesSection } from "./_sections/AdminUIRulesSection";
import { LayoutContractSection } from "./_sections/LayoutContractSection";
import { TypographySection } from "./_sections/TypographySection";
import { HeaderSection } from "./_sections/HeaderSection";
import { PageStructureSection } from "./_sections/PageStructureSection";
import { ToolbarsSection } from "./_sections/ToolbarsSection";
import { KpiCardsSection } from "./_sections/KpiCardsSection";
import { ContentShellsSection } from "./_sections/ContentShellsSection";
import { TablesSection } from "./_sections/TablesSection";
import { ListsQueuesSection } from "./_sections/ListsQueuesSection";
import { StatesSection } from "./_sections/StatesSection";
import { FormsSection } from "./_sections/FormsSection";
import { OverlaysSection } from "./_sections/OverlaysSection";
import { EventScheduleSection } from "./_sections/EventScheduleSection";
import { BookingModuleSection } from "./_sections/BookingModuleSection";
import { ScheduleEditorSection } from "./_sections/ScheduleEditorSection";
import { ActivityFormBuilderSection } from "./_sections/ActivityFormBuilderSection";

export default function AdminUILabPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Lab Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Admin UI Laboratory</h1>
          <p className="text-sm text-gray-600 mt-1">
            Reusable admin interface patterns with desktop and mobile variants
          </p>
        </div>
      </div>

      {/* Lab Content */}
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-12">
        <AdminUIRulesSection />
        <LayoutContractSection />
        <TypographySection />
        <HeaderSection />
        <PageStructureSection />
        <ToolbarsSection />
        <KpiCardsSection />
        <ContentShellsSection />
        <TablesSection />
        <ListsQueuesSection />
        <StatesSection />
        <FormsSection />
        <OverlaysSection />
        <EventScheduleSection />
        <BookingModuleSection />
        <ScheduleEditorSection />
        <ActivityFormBuilderSection />
      </div>
    </div>
  );
}
