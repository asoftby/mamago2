import { ReactNode } from "react";

export function ArticleMetaRow({ items }: { items: (ReactNode | null | undefined)[] }) {
  const visible = items.filter(Boolean);
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      {visible.map((item, i) => (
        <span key={i} className="flex items-center gap-x-2">
          {item}
          {i < visible.length - 1 && <span className="opacity-30">·</span>}
        </span>
      ))}
    </div>
  );
}
