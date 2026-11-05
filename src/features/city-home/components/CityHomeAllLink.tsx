import Link from "next/link";
import { cn } from "@/lib/utils";

/** Ссылка «[все …]» в стиле подписи «2.0 beta» (font-mono). */
export function CityHomeAllLink({
  href,
  label,
  className,
}: {
  href: string;
  label: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-8 shrink-0 items-center max-w-full font-mono font-normal lowercase",
        "text-[12px] md:text-[13px] leading-none text-primary whitespace-nowrap",
        "rounded-sm transition-opacity hover:opacity-70",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
    >
      {label}
    </Link>
  );
}
