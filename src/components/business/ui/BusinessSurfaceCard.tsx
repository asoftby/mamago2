import { cn } from "@/lib/utils";

interface BusinessSurfaceCardProps {
  children: React.ReactNode;
  className?: string;
  tone?: "default" | "warm" | "accent" | "success" | "dark";
}

export function BusinessSurfaceCard({
  children,
  className,
  tone = "default",
}: BusinessSurfaceCardProps) {
  return (
    <div
      className={cn(
        "rounded-[28px] border p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_14px_36px_rgba(15,23,42,0.04)]",
        tone === "default" && "border-stone-200/80 bg-white",
        tone === "warm" && "border-amber-200/70 bg-[linear-gradient(180deg,#fffaf3_0%,#ffffff_100%)]",
        tone === "accent" && "border-blue-200/70 bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_100%)]",
        tone === "success" && "border-emerald-200/70 bg-[linear-gradient(180deg,#f5fdf8_0%,#ffffff_100%)]",
        tone === "dark" && "border-slate-800 bg-[linear-gradient(145deg,#111827_0%,#1f2937_100%)] text-white",
        className,
      )}
    >
      {children}
    </div>
  );
}
