import React from "react";

export function DemoSection({
  title,
  description,
  children,
  id,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="space-y-6 py-8 border-b border-border/40">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        {description && (
          <p className="text-muted-foreground text-lg">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}
