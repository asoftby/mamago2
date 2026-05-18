import { notFound } from "next/navigation";
import { UiPrimitivesSection } from "./_sections/UiPrimitivesSection";
import { FiltersSection } from "./_sections/FiltersSection";
import { DiscoverySection } from "./_sections/DiscoverySection";
import { NavigationSection } from "./_sections/NavigationSection";
import { CitySection } from "./_sections/CitySection";
import { NewsSection } from "./_sections/NewsSection";
import { ShellSection } from "./_sections/ShellSection";
import { HeaderSection } from "./_sections/HeaderSection";
import { AccountDropdownSection } from "./_sections/AccountDropdownSection";
import { OpeningHoursSection } from "./_sections/OpeningHoursSection";
import { DateTimePickerSection } from "./_sections/DateTimePickerSection";
import { LiquidNotificationsSection } from "./_sections/LiquidNotificationsSection";
import { OfferPageSection } from "./_sections/OfferPageSection";
import Link from "next/link";

export default function UiLabPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <div className="text-foreground">
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
          <div>
            <Link
              href="/ui-lab/cards"
              className="inline-flex rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Open Activity Cards Lab
            </Link>
          </div>
        </header>

        <div className="space-y-16 pb-8 [&_section]:scroll-mt-36">
          <HeaderSection />
          <AccountDropdownSection />
          <UiPrimitivesSection />
          <FiltersSection />
          <DiscoverySection />
          <NavigationSection />
          <CitySection />
          <NewsSection />
          <ShellSection />
          <OpeningHoursSection />
          <DateTimePickerSection />
          <LiquidNotificationsSection />
          <OfferPageSection />
        </div>
      </div>
    </div>
  );
}
