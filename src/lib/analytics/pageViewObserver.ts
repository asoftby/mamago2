/**
 * Pure decision rule for the PAGE_VIEW route observer (`PageViewTracker`).
 * Kept separate from the client component so it can be unit-tested without
 * mounting React — this repo's tests run as plain tsx scripts, not RTL.
 */
export function shouldEmitPageView(
  previousPathname: string | null,
  pathname: string,
): boolean {
  return pathname !== previousPathname;
}
