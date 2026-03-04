import { SiteHeaderDesktop, SiteHeaderMobile } from "@/components/site/header";

export function HeaderSection() {
  return (
    <section id="header" className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight mb-2">Site Header</h2>
        <p className="text-muted-foreground">
          Responsive header with separate Desktop and Mobile implementations.
          City label visible on both versions.
        </p>
      </div>

      <div className="space-y-12">
        {/* Desktop Header */}
        <div className="space-y-4">
          <div>
            <h3 className="text-xl font-semibold mb-1">Desktop Header</h3>
            <p className="text-sm text-muted-foreground">
              Single row: Logo + City | Search (centered, max 520px) | Heart + Profile
            </p>
          </div>
          <div className="border rounded-lg overflow-hidden">
            <SiteHeaderDesktop />
          </div>
        </div>

        {/* Mobile Header */}
        <div className="space-y-4">
          <div>
            <h3 className="text-xl font-semibold mb-1">Mobile Header</h3>
            <p className="text-sm text-muted-foreground">
              Two rows: Row 1 (Logo + City | Heart + Profile Icon), Row 2 (Full-width Search)
            </p>
          </div>
          <div className="border rounded-lg overflow-hidden max-w-[390px]">
            <SiteHeaderMobile />
          </div>
        </div>

        {/* Long City Name Test */}
        <div className="space-y-4">
          <div>
            <h3 className="text-xl font-semibold mb-1">Long City Name Test</h3>
            <p className="text-sm text-muted-foreground">
              Testing with "Санкт-Петербург" to ensure no wrapping issues
            </p>
          </div>
          <div className="border rounded-lg overflow-hidden max-w-[390px]">
            <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
              <div className="mx-auto w-full px-4">
                <div className="flex h-14 items-center justify-between gap-3">
                  <div className="flex items-center flex-shrink-0 min-w-0">
                    <div className="h-[32px] w-[32px] bg-primary/10 rounded flex-shrink-0" />
                    <span className="ml-3 text-sm border-b border-dashed border-muted-foreground/40 whitespace-nowrap">
                      Санкт-Петербург
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="h-5 w-5 bg-muted rounded" />
                    <div className="h-5 w-5 bg-muted rounded" />
                  </div>
                </div>
                <div className="pb-3">
                  <div className="flex items-center gap-2 w-full rounded-full border px-4 py-2 text-sm text-muted-foreground">
                    <div className="h-4 w-4 bg-muted rounded flex-shrink-0" />
                    <span className="truncate">Найти событие</span>
                  </div>
                </div>
              </div>
            </header>
          </div>
        </div>
      </div>
    </section>
  );
}
