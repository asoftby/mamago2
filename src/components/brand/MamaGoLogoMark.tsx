import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

const DEFAULT_LOGO_SRC = "/favico_mamago.webp";

type MamaGoLogoMarkProps = {
  href?: string;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  /** Screen readers: defaults to "MamaGo" or home link label when `href` is set. */
  ariaLabel?: string;
  /** Branding logo override; falls back to the static asset when unset. */
  src?: string | null;
};

/**
 * Круглый favicon + подпись «beta» (Menlo через `font-mono` / `--font-mono`).
 */
export function MamaGoLogoMark({
  href,
  className,
  imageClassName = "h-8 w-auto md:h-9",
  priority,
  ariaLabel,
  src,
}: MamaGoLogoMarkProps) {
  const mark = (
    <>
      <Image
        src={src || DEFAULT_LOGO_SRC}
        alt=""
        width={100}
        height={100}
        priority={priority}
        className={imageClassName}
      />
      <span
        className="font-mono text-[9px] font-normal lowercase leading-none text-[#737373] md:text-[10px]"
        aria-hidden
      >
        2.0 beta
      </span>
    </>
  );

  const rootClass = cn(
    "inline-flex shrink-0 items-start gap-1.5 rounded-lg p-0.5",
    className,
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(rootClass, "transition-opacity hover:opacity-90")}
        aria-label={ariaLabel ?? "MamaGo — на главную"}
      >
        {mark}
      </Link>
    );
  }

  return (
    <span className={rootClass} aria-label={ariaLabel ?? "MamaGo"}>
      {mark}
    </span>
  );
}
