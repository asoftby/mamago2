import type { PriceItem } from "@/lib/priceItems";

interface PriceListBlockProps {
  items: PriceItem[];
  note?: string;
  updatedAt?: Date | string | null;
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function renderNote(text: string): React.ReactNode {
  const lines = text.split("\n");
  const result: React.ReactNode[] = [];
  let bullets: string[] = [];

  function flushBullets() {
    if (bullets.length === 0) return;
    result.push(
      <ul key={result.length} className="list-disc pl-4 space-y-0.5">
        {bullets.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  }

  for (const line of lines) {
    if (line.startsWith("- ")) {
      bullets.push(line.slice(2));
    } else {
      flushBullets();
      if (line.trim() === "") {
        if (result.length > 0) result.push(<div key={result.length} className="h-1.5" />);
      } else {
        result.push(<p key={result.length}>{renderInline(line)}</p>);
      }
    }
  }
  flushBullets();
  return result;
}

export function PriceListBlock({ items, note, updatedAt }: PriceListBlockProps) {
  if (items.length === 0 && !note?.trim()) return null;

  const dateLabel = updatedAt
    ? new Date(updatedAt).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="my-8 rounded-xl border border-border/70 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 bg-muted/40 border-b border-border/60">
        <span className="text-xs font-semibold uppercase tracking-[0.1em] text-foreground/70">
          Сколько стоит
        </span>
        <span className="text-xs text-muted-foreground">{items.length} позиций</span>
      </div>
      <div className="divide-y divide-border/50">
        {items.map((item, index) => (
          <div key={item.id} className="flex items-baseline gap-3 px-5 py-3">
            <span className="text-xs text-muted-foreground w-4 shrink-0">{index + 1}.</span>
            <span className="flex-1 text-sm text-foreground">{item.label}</span>
            <span className="font-serif text-base font-medium text-foreground tabular-nums">
              {item.price}
            </span>
            {item.unit && (
              <span className="text-xs text-muted-foreground">{item.unit}</span>
            )}
          </div>
        ))}
      </div>
      {note?.trim() ? (
        <div className="px-5 py-3 border-t border-border/50">
          <div className="text-sm text-muted-foreground leading-relaxed space-y-1">
            {renderNote(note.trim())}
          </div>
        </div>
      ) : null}
      {dateLabel && (
        <div className="px-5 py-2.5 bg-muted/20 border-t border-border/40">
          <span className="text-[11px] text-muted-foreground/70">Обновлено: {dateLabel}</span>
        </div>
      )}
    </div>
  );
}
