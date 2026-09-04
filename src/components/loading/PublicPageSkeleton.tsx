import { Container } from "@/components/ui/Container";
import styles from "./PublicPageSkeleton.module.css";

type SkeletonBlockProps = {
  className: string;
};

function SkeletonBlock({ className }: SkeletonBlockProps) {
  return (
    <div
      aria-hidden
      className={`${styles.shimmer} bg-neutral-100 dark:bg-neutral-800 ${className}`}
    />
  );
}

/**
 * Universal public-route loading state.
 *
 * The shape intentionally combines the most common mamaGo layouts (title,
 * media, details and card grid), so route transitions keep a stable visual
 * rhythm instead of flashing a blank page or a centered spinner.
 */
export function PublicPageSkeleton() {
  return (
    <div className="min-h-[68vh] bg-background">
      <Container className="py-5 sm:py-7 lg:py-8">
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          aria-label="Загрузка страницы"
        >
          <span className="sr-only">Загружаем страницу…</span>

          <div className="space-y-3">
            <SkeletonBlock className="h-4 w-24 rounded-full" />
            <SkeletonBlock className="h-9 w-4/5 max-w-2xl rounded-xl sm:h-10 lg:h-11" />
            <SkeletonBlock className="h-4 w-3/5 max-w-md rounded-full" />
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.75fr)] lg:gap-7">
            <SkeletonBlock className="aspect-[4/3] w-full rounded-[24px] sm:aspect-[16/10] lg:aspect-[16/9]" />

            <div className="space-y-3">
              <div className="rounded-[24px] border border-neutral-100 p-4 sm:p-5 dark:border-neutral-800">
                <div className="space-y-3">
                  <SkeletonBlock className="h-5 w-2/5 rounded-lg" />
                  <SkeletonBlock className="h-4 w-4/5 rounded-full" />
                  <SkeletonBlock className="h-4 w-3/5 rounded-full" />
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <SkeletonBlock className="h-11 rounded-xl" />
                  <SkeletonBlock className="h-11 rounded-xl" />
                </div>
              </div>

              <div className="rounded-[24px] border border-neutral-100 p-4 sm:p-5 dark:border-neutral-800">
                <div className="space-y-3">
                  <SkeletonBlock className="h-4 w-1/3 rounded-full" />
                  <SkeletonBlock className="h-4 w-full rounded-full" />
                  <SkeletonBlock className="h-4 w-5/6 rounded-full" />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-7 flex gap-2 overflow-hidden sm:mt-8">
            <SkeletonBlock className="h-9 w-24 shrink-0 rounded-full" />
            <SkeletonBlock className="h-9 w-28 shrink-0 rounded-full" />
            <SkeletonBlock className="h-9 w-20 shrink-0 rounded-full" />
            <SkeletonBlock className="h-9 w-32 shrink-0 rounded-full" />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-4 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="min-w-0 space-y-3">
                <SkeletonBlock className="aspect-[4/3] w-full rounded-[20px]" />
                <SkeletonBlock className="h-4 w-4/5 rounded-full" />
                <SkeletonBlock className="h-4 w-3/5 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </Container>
    </div>
  );
}
