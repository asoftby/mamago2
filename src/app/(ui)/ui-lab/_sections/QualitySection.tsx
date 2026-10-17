import Link from "next/link";
import { CatalogSection } from "./CatalogSection";

export function QualitySection() {
  return (
    <div className="space-y-10">
      <CatalogSection />
      <section className="space-y-3 rounded-xl border border-border p-5">
        <h2 className="text-xl font-semibold">Аудит кода</h2>
        <p className="text-sm text-muted-foreground">Здесь не показываем выдуманную статистику. Актуальный полный инвентарь формируется CI по конкретному SHA и прикладывается к GitHub Actions как артефакт.</p>
        <pre className="overflow-x-auto rounded-lg bg-surface-muted p-4 text-sm"><code>pnpm ui:design-audit{"\n"}pnpm ui:audit{"\n"}pnpm test:design-system-audit</code></pre>
        <p className="text-sm">Полный отчёт первой версии: <Link className="text-primary underline" href="https://github.com/asoftby/mamago2/actions/workflows/design-system-inventory.yml">Design System Inventory — GitHub Actions</Link></p>
        <p className="text-sm text-muted-foreground">Нативные HTML-элементы, цвета и размеры — кандидаты на ревью, не автоматически ошибки.</p>
      </section>
    </div>
  );
}
