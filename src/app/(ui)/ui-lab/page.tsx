import Link from "next/link";
import { DesignSystemFoundationSection } from "./_sections/DesignSystemFoundationSection";
import { UiPrimitivesSection } from "./_sections/UiPrimitivesSection";
import { FoundationsSection } from "./_sections/FoundationsSection";
import { PreviewWorkbench } from "./_components/PreviewWorkbench";
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
import { SaveModalSection } from "./_sections/SaveModalSection";
import { LegacyAdminSection } from "./_sections/LegacyAdminSection";
import { QualitySection } from "./_sections/QualitySection";

const tabs = [
  { id: "foundations", label: "Основы" },
  { id: "components", label: "Компоненты" },
  { id: "patterns", label: "Паттерны" },
  { id: "screens", label: "Экраны" },
  { id: "admin", label: "Админка · архив" },
  { id: "audit", label: "Аудит" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export default async function UiLabPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const activeTab: TabId = tabs.some((item) => item.id === tab) ? tab as TabId : "foundations";

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-7 text-foreground sm:px-6 sm:py-10">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-primary">mamaGo / Design System</p>
          <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">DEV · авторизованный доступ · 2.0</span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">UI Lab 2.0</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Единый каталог реальных компонентов, вариантов и сценариев. Сначала согласуем стандарт,
          затем переносим его в публичный сайт, бизнес-кабинет и админку. Исторические образцы пока сохранены в архиве.
        </p>
      </header>
      <nav aria-label="Разделы UI Lab" className="flex flex-wrap gap-2 border-b border-border pb-4">
        {tabs.map((item) => (
          <Link
            key={item.id}
            href={`/ui-lab?tab=${item.id}`}
            aria-current={activeTab === item.id ? "page" : undefined}
            className={`inline-flex min-h-10 items-center justify-center rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${activeTab === item.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:bg-surface-hover"}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {activeTab === "foundations" && <FoundationsSection />}
      {activeTab === "components" && (
        <div className="space-y-12">
          <PreviewWorkbench />
          <DesignSystemFoundationSection />
          <details className="rounded-xl border border-border p-4">
            <summary className="cursor-pointer font-medium">Прежний каталог UI Primitives · сравнение</summary>
            <div className="mt-5"><UiPrimitivesSection /></div>
          </details>
        </div>
      )}
      {activeTab === "patterns" && (
        <div className="space-y-12">
          <p className="text-sm text-muted-foreground">Действующие паттерны показаны как кандидаты на ревью; не копируйте их стили без утверждения.</p>
          <FiltersSection />
          <DiscoverySection />
          <NavigationSection />
          <OpeningHoursSection />
          <DateTimePickerSection />
          <SaveModalSection />
          <LiquidNotificationsSection />
          <div className="rounded-xl border border-border p-5">
            <h2 className="text-lg font-semibold">Мастер создания — интерактивный прототип</h2>
            <p className="my-2 text-sm text-muted-foreground">Отдельный полноэкранный сценарий, под теми же правами доступа.</p>
            <Link className="text-sm font-medium text-primary underline" href="/ui-lab/wizard">Открыть мастер</Link>
          </div>
        </div>
      )}
      {activeTab === "screens" && (
        <div className="space-y-12">
          <p className="text-sm text-muted-foreground">Реальные экраны и старые демонстрации. Карточки доступны в отдельном представлении каталога.</p>
          <div className="rounded-xl border border-border p-5">
            <Link href="/ui-lab/cards" className="font-medium text-primary underline">Карточки событий и предложений — все состояния</Link>
          </div>
          <HeaderSection />
          <AccountDropdownSection />
          <CitySection />
          <NewsSection />
          <ShellSection />
          <OfferPageSection />
        </div>
      )}
      {activeTab === "admin" && <LegacyAdminSection />}
      {activeTab === "audit" && <QualitySection />}
      <footer className="border-t border-border pt-5 text-xs text-muted-foreground">
        Источник правок — production-компоненты и src/app/globals.css, не копии из UI Lab.
        Непроверенные варианты не становятся стандартом автоматически.
      </footer>
    </main>
  );
}
