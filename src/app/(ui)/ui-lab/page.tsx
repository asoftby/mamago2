import { notFound } from "next/navigation";
import { UiPrimitivesSection } from "./_sections/UiPrimitivesSection";
import { FiltersSection } from "./_sections/FiltersSection";
import { DiscoverySection } from "./_sections/DiscoverySection";
import { NavigationSection } from "./_sections/NavigationSection";
import { CitySection } from "./_sections/CitySection";
import { ActivitySection } from "./_sections/ActivitySection";
import { NewsSection } from "./_sections/NewsSection";
import { ShellSection } from "./_sections/ShellSection";
import { PlanCardSection } from "./_sections/PlanCardSection";
import { HeaderSection } from "./_sections/HeaderSection";
import { PlaceCardSection } from "./_sections/PlaceCardSection";
import { OpeningHoursSection } from "./_sections/OpeningHoursSection";
import { DateTimePickerSection } from "./_sections/DateTimePickerSection";

export default function UiLabPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-12 max-w-7xl">
        <header className="mb-12 space-y-4">
          <div className="inline-block rounded-md bg-destructive/10 px-3 py-1 text-sm font-medium text-destructive">
            DEV ONLY
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
            UI Lab — Inventory
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl">
            Single page inventory of UI components. Fix visual issues by editing the SOURCE component file, not this page.
          </p>
          <div className="text-sm font-mono text-muted-foreground bg-muted/30 inline-block px-3 py-1.5 rounded border">
            Run: <span className="font-bold text-foreground">pnpm ui:audit</span> to update usage stats
          </div>
        </header>

        <main className="space-y-16 pb-32">
          <HeaderSection />
          <UiPrimitivesSection />
          <FiltersSection />
          <DiscoverySection />
          <NavigationSection />
          <CitySection />
          <ActivitySection />
          <NewsSection />
          <ShellSection />
          <PlanCardSection />
          <PlaceCardSection />
          <OpeningHoursSection />
          <DateTimePickerSection />
        </main>
      </div>
    </div>
  );
}
