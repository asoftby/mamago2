import { DemoSection } from "../_components/DemoSection";

const swatches = [
  { label: "Primary", css: "var(--primary)", value: "primary" },
  { label: "Brand soft", css: "var(--brand-soft)", value: "brand-soft" },
  { label: "Surface", css: "var(--surface)", value: "surface" },
  { label: "Surface muted", css: "var(--surface-muted)", value: "surface-muted" },
  { label: "Success", css: "var(--success)", value: "success" },
  { label: "Warning", css: "var(--warning)", value: "warning" },
  { label: "Danger", css: "var(--danger)", value: "danger" },
  { label: "Border", css: "var(--border)", value: "border" },
] as const;

export function FoundationsSection() {
  return (
    <DemoSection id="foundations" title="Основы" description="Текущие семантические токены из globals.css. Демонстрация не утверждает новые значения.">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {swatches.map((swatch) => (
          <div key={swatch.value} className="overflow-hidden rounded-xl border border-border bg-background">
            <div className="h-16 border-b border-border" style={{ backgroundColor: swatch.css }} />
            <div className="p-3"><div className="text-sm font-medium">{swatch.label}</div><code className="text-xs text-muted-foreground">{swatch.value}</code></div>
          </div>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4 rounded-xl border border-border p-5">
          <h3 className="text-lg font-semibold">Типографика</h3>
          <p style={{ fontFamily: "var(--font-pt-serif), Georgia, serif" }} className="text-3xl">Куда пойти всей семьёй</p>
          <p className="text-base">NT Somic — интерфейс, поля, действия и основной текст</p>
          <p className="text-sm text-muted-foreground">Размеры, веса и интервалы сравниваем с реальным UI до утверждения.</p>
        </div>
        <div className="space-y-4 rounded-xl border border-border p-5">
          <h3 className="text-lg font-semibold">Формы и геометрия</h3>
          <div className="flex flex-wrap items-center gap-3">
            <span className="px-4 py-3 border border-border" style={{ borderRadius: "var(--radius-button)" }}>Button radius token</span>
            <span className="px-4 py-3 border border-border" style={{ borderRadius: "var(--radius-card)" }}>Card radius token</span>
            <span className="rounded-full border border-border px-4 py-3">Pill</span>
          </div>
          <p className="text-sm text-muted-foreground">Скругления и высоты компонентов пока неоднородны: утверждаем после сравнения.</p>
        </div>
      </div>
    </DemoSection>
  );
}
