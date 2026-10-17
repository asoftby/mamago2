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
          <h3 className="text-lg font-semibold">Типографика · 3 шрифта</h3>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Google Sans · основной интерфейс</p>
            <p className="text-xl" style={{ fontFamily: "var(--font-google-sans), ui-sans-serif, system-ui, sans-serif" }}>
              Куда пойти с ребёнком в Минске
            </p>
            <p className="text-sm" style={{ fontFamily: "var(--font-google-sans), ui-sans-serif, system-ui, sans-serif" }}>
              Карточки, кнопки, формы, описания и навигация
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">PT Serif · заголовки и редакционные акценты</p>
            <p className="text-3xl" style={{ fontFamily: "var(--font-pt-serif), ui-serif, serif" }}>
              Куда пойти всей семьёй
            </p>
            <p className="text-xl italic" style={{ fontFamily: "var(--font-pt-serif), ui-serif, serif" }}>
              Лучшие идеи для выходных
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Menlo · цифры, технические подписи и код</p>
            <p className="text-base font-mono">17.10.2026 · 14:30 · 80 BYN</p>
            <p className="text-xs font-mono">mamaGo / UI Lab 2.0</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Все три — единственные утверждённые семейства. Системные fallback нужны только при отсутствии шрифта на устройстве.
          </p>
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
