import Link from "next/link";
import Image from "next/image";
import type { CityBlogCategory } from "@/server/article/cityBlogCategories";
import { JOURNAL_CHIP, JOURNAL_CHIP_THUMB } from "@/components/journal/journalCategoryChipStyles";

/** Home-only presentation of the same live categories and pill styling as BlogPersistentNav. */
export function HomeJournalCategoryChips({ citySlug, categories }: {
  citySlug: string;
  categories: CityBlogCategory[];
}) {
  const covers = categories.map(category => category.thumbnailUrl).filter((url): url is string => Boolean(url)).slice(0, 4);
  return (
    <nav aria-label="Категории журнала" className="no-scrollbar mb-[23px] flex w-full gap-2 overflow-x-auto overflow-y-hidden pb-[9px] pt-1 whitespace-nowrap [scrollbar-width:none]">
      <Link href={`/${citySlug}/blog`} className={`${JOURNAL_CHIP} border-primary bg-primary text-primary-foreground`}>
        <span className={`${JOURNAL_CHIP_THUMB} grid grid-cols-2 grid-rows-2 gap-px bg-background`} aria-hidden>
          {covers.length ? Array.from({ length: 4 }, (_, i) => (
            <span key={i} className="min-h-0 min-w-0 overflow-hidden">
              <Image src={covers[i % covers.length]} width={32} height={32} unoptimized alt="" className="size-full object-cover" />
            </span>
          )) : <span className="col-span-2 row-span-2 flex items-center justify-center bg-primary-foreground/20">М</span>}
        </span>
        Все
      </Link>
      {categories.map(category => (
        <Link key={category.id} href={`/${citySlug}/blog/category/${category.slug}`}
          className={`${JOURNAL_CHIP} border-border bg-background text-foreground hover:border-primary/50 hover:bg-muted`}>
          <span className={JOURNAL_CHIP_THUMB} aria-hidden>
            {category.thumbnailUrl ? <Image src={category.thumbnailUrl} width={32} height={32} unoptimized alt="" className="size-full object-cover" />
              : <span className="flex size-full items-center justify-center text-sm font-semibold">{category.name.slice(0, 1)}</span>}
          </span>
          {category.name}
        </Link>
      ))}
    </nav>
  );
}
