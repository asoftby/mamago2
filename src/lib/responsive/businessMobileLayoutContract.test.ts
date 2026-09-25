/** Responsive contract for the operational Business workspace. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

const shell = read("src/components/business/layout/BusinessShell.tsx");
const header = read("src/components/business/layout/BusinessHeader.tsx");
const bookings = read("src/app/business/(protected)/bookings/BookingsPageClient.tsx");
const balance = read("src/components/business/billing/HeroBalanceCard.tsx");
const history = read("src/app/business/(protected)/billing/history/page.tsx");
const reviews = read("src/app/business/(protected)/reviews/page.tsx");

assert.match(shell, /min-h-dvh/, "Business shell must use the dynamic viewport height");
assert.match(shell, /px-4 py-5 sm:px-6/, "Business content must keep the 16/24px mobile gutter contract");
assert.match(header, /h-11 w-11[^\n]*lg:hidden/, "Business mobile navigation must expose a 44px target");
assert.match(bookings, /grid grid-cols-2 gap-3 lg:grid-cols-5/, "Booking stats must use a compact two-column mobile layout");
assert.match(bookings, /aria-label="Выбор дня месяца"/, "Bookings must provide a compact mobile day selector");
assert.match(bookings, /hidden overflow-hidden[^\n]*sm:block/, "The dense seven-column month grid must be tablet/desktop only");
assert.match(bookings, /min-h-11 shrink-0 snap-start/, "Booking filter rails must keep 44px snap targets");
assert.match(bookings, /h-\[92dvh\]/, "Booking detail sheet must use dynamic viewport height");
assert.match(bookings, /grid grid-cols-1 gap-3 sm:flex/, "Booking detail actions must stack on phones");
assert.match(balance, /break-words text-3xl[^\n]*sm:text-5xl/, "Long balance values must wrap and scale on phones");
assert.match(history, /divide-y divide-stone-100 md:hidden/, "Billing history must use operational cards on phones");
assert.match(history, /hidden md:block/, "Billing table must remain available from tablet width");
assert.match(reviews, /grid grid-cols-2 gap-3 md:grid-cols-3/, "Review summary must use a two-column mobile layout");
assert.match(reviews, /max-h-\[92dvh\]/, "Review reply flow must use a dynamic-height mobile sheet");
assert.match(reviews, /safe-area-inset-bottom/, "Review reply actions must account for the bottom safe area");
assert.doesNotMatch(reviews, /max-h-\[90vh\]/, "Review modal must not regress to a fixed desktop viewport height");

console.log("businessMobileLayoutContract.test.ts: OK");
