/**
 * Canonical audience identity — DB-fixture truth table (§ canonical
 * audience contract). Запуск: npx tsx src/server/services/analytics/canonicalAudience.integration.test.ts
 *
 * Every fixture uses an isolated, non-overlapping UTC time slice so
 * cases can't contaminate each other, and every row/user this file
 * creates is deleted in `finally` regardless of pass/fail.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

async function main(): Promise<void> {
  const { prisma } = await import("@/lib/prisma");
  const { computeCanonicalAudience } = await import("./canonicalAudience");
  const { getTrafficViewModel } = await import("@/server/admin/getTrafficViewModel");
  const { collectAudienceDau } = await import("@/server/ops/metrics/collectors/audienceDaily");

  const marker = randomUUID().slice(0, 8);
  const sid = (label: string) => `fx-${marker}-${label}`;
  const userIds: string[] = [];

  async function makeUser(role: "USER" | "ADMIN" | "MODERATOR" | "BUSINESS_OWNER"): Promise<string> {
    const user = await prisma.user.create({
      data: { email: `canonical-audience-${marker}-${role.toLowerCase()}-${randomUUID().slice(0, 6)}@example.invalid`, role },
    });
    userIds.push(user.id);
    return user.id;
  }

  async function pageView(opts: { at: Date; sessionId?: string | null; userId?: string | null }): Promise<void> {
    await prisma.userEvent.create({
      data: {
        eventType: "PAGE_VIEW",
        createdAt: opts.at,
        sessionId: opts.sessionId ?? undefined,
        userId: opts.userId ?? undefined,
      },
    });
  }
  async function nonPageView(eventType: "CARD_VIEW" | "SAVE", opts: { at: Date; sessionId?: string | null }): Promise<void> {
    await prisma.userEvent.create({
      data: { eventType, createdAt: opts.at, sessionId: opts.sessionId ?? undefined },
    });
  }

  // 2020-06-15: cases 1-15, one isolated minute-window per case.
  const day = (m: number) => new Date(Date.UTC(2020, 5, 15, 0, m, 0));
  const win = (m: number) => ({ start: day(m), end: day(m + 1) });

  try {
    const userU = await makeUser("USER");
    const userAdmin = await makeUser("ADMIN");
    const userModerator = await makeUser("MODERATOR");
    const userBusiness = await makeUser("BUSINESS_OWNER");

    // 1. anonymous session A => 1 visitor
    {
      const w = win(0);
      await pageView({ at: new Date(w.start.getTime() + 1000), sessionId: sid("c1-A") });
      const r = await computeCanonicalAudience(prisma, w.start, w.end);
      assert.equal(r.visitors, 1, "case 1: anonymous session A => 1 visitor");
      assert.equal(r.anonymousOnlyVisitors, 1);
      assert.equal(r.authenticatedVisitors, 0);
    }

    // 2. A has 10 PAGE_VIEW => still 1 visitor
    {
      const w = win(1);
      for (let i = 0; i < 10; i += 1) {
        await pageView({ at: new Date(w.start.getTime() + i * 1000), sessionId: sid("c2-A") });
      }
      const r = await computeCanonicalAudience(prisma, w.start, w.end);
      assert.equal(r.visitors, 1, "case 2: 10 PAGE_VIEW from the same session => still 1 visitor");
    }

    // 3. anonymous A then login as user U => 1 visitor total, not 2
    {
      const w = win(2);
      await pageView({ at: new Date(w.start.getTime() + 1000), sessionId: sid("c3-A") });
      await pageView({ at: new Date(w.start.getTime() + 2000), sessionId: sid("c3-A"), userId: userU });
      const r = await computeCanonicalAudience(prisma, w.start, w.end);
      assert.equal(r.visitors, 1, "case 3: anon-then-login same session => 1 visitor, not 2");
      assert.equal(r.authenticatedVisitors, 1);
      assert.equal(r.anonymousOnlyVisitors, 0, "the now-linked session must not also count as anonymous");
    }

    // 4. user U across sessions A+B => 1 visitor
    {
      const w = win(3);
      await pageView({ at: new Date(w.start.getTime() + 1000), sessionId: sid("c4-A"), userId: userU });
      await pageView({ at: new Date(w.start.getTime() + 2000), sessionId: sid("c4-B"), userId: userU });
      const r = await computeCanonicalAudience(prisma, w.start, w.end);
      assert.equal(r.visitors, 1, "case 4: same user across two sessions => 1 visitor");
    }

    // 5. anonymous A + anonymous B => 2 visitors
    {
      const w = win(4);
      await pageView({ at: new Date(w.start.getTime() + 1000), sessionId: sid("c5-A") });
      await pageView({ at: new Date(w.start.getTime() + 2000), sessionId: sid("c5-B") });
      const r = await computeCanonicalAudience(prisma, w.start, w.end);
      assert.equal(r.visitors, 2, "case 5: two distinct anonymous sessions => 2 visitors");
    }

    // 6. user U + unrelated anonymous B => 2 visitors
    {
      const w = win(5);
      await pageView({ at: new Date(w.start.getTime() + 1000), sessionId: sid("c6-A"), userId: userU });
      await pageView({ at: new Date(w.start.getTime() + 2000), sessionId: sid("c6-B") });
      const r = await computeCanonicalAudience(prisma, w.start, w.end);
      assert.equal(r.visitors, 2, "case 6: authenticated user + unrelated anonymous session => 2 visitors");
    }

    // 7 + 8. ADMIN page views => 0 product visitors, and the ADMIN session
    // must not fall back and count anonymously either.
    {
      const w = win(6);
      await pageView({ at: new Date(w.start.getTime() + 1000), sessionId: sid("c7-admin"), userId: userAdmin });
      const r = await computeCanonicalAudience(prisma, w.start, w.end);
      assert.equal(r.visitors, 0, "case 7: ADMIN-only activity => 0 product visitors");
      assert.equal(r.authenticatedVisitors, 0, "case 7: ADMIN excluded from authenticated bucket");
      assert.equal(r.anonymousOnlyVisitors, 0, "case 8: ADMIN's session must not fall back to anonymous");
    }

    // 9. MODERATOR — same exclusion behavior as ADMIN
    {
      const w = win(7);
      await pageView({ at: new Date(w.start.getTime() + 1000), sessionId: sid("c9-mod"), userId: userModerator });
      const r = await computeCanonicalAudience(prisma, w.start, w.end);
      assert.equal(r.visitors, 0, "case 9: MODERATOR-only activity => 0 product visitors");
      assert.equal(r.anonymousOnlyVisitors, 0, "case 9: MODERATOR's session must not fall back to anonymous");
    }

    // 10. USER counts normally
    {
      const w = win(8);
      await pageView({ at: new Date(w.start.getTime() + 1000), sessionId: sid("c10-user"), userId: userU });
      const r = await computeCanonicalAudience(prisma, w.start, w.end);
      assert.equal(r.visitors, 1, "case 10: ordinary USER counts normally");
      assert.equal(r.authenticatedVisitors, 1);
    }

    // 11. BUSINESS_OWNER public PAGE_VIEW => counts as a normal visitor
    // (default recommendation: BUSINESS_OWNER browsing public pages is
    // legitimate public traffic; their /business/* activity isn't
    // PAGE_VIEW-tracked at all, so nothing double-counts).
    {
      const w = win(9);
      await pageView({ at: new Date(w.start.getTime() + 1000), sessionId: sid("c11-biz"), userId: userBusiness });
      const r = await computeCanonicalAudience(prisma, w.start, w.end);
      assert.equal(r.visitors, 1, "case 11: BUSINESS_OWNER public PAGE_VIEW counts as a normal visitor");
      assert.equal(r.authenticatedVisitors, 1);
    }

    // 12. CARD_VIEW only => 0 active visitors (audience is PAGE_VIEW-only)
    {
      const w = win(10);
      await nonPageView("CARD_VIEW", { at: new Date(w.start.getTime() + 1000), sessionId: sid("c12-A") });
      const r = await computeCanonicalAudience(prisma, w.start, w.end);
      assert.equal(r.visitors, 0, "case 12: CARD_VIEW-only session => 0 visitors");
    }

    // 13. SAVE only => 0 active visitors
    {
      const w = win(11);
      await nonPageView("SAVE", { at: new Date(w.start.getTime() + 1000), sessionId: sid("c13-A") });
      const r = await computeCanonicalAudience(prisma, w.start, w.end);
      assert.equal(r.visitors, 0, "case 13: SAVE-only session => 0 visitors");
    }

    // 14. PAGE_VIEW with null sessionId + authenticated userId => user counts
    {
      const w = win(12);
      await pageView({ at: new Date(w.start.getTime() + 1000), sessionId: null, userId: userU });
      const r = await computeCanonicalAudience(prisma, w.start, w.end);
      assert.equal(r.visitors, 1, "case 14: null sessionId + authenticated userId => still counts");
      assert.equal(r.authenticatedVisitors, 1);
    }

    // 15. PAGE_VIEW with both IDs null => does not create a visitor
    {
      const w = win(13);
      await pageView({ at: new Date(w.start.getTime() + 1000), sessionId: null, userId: null });
      const r = await computeCanonicalAudience(prisma, w.start, w.end);
      assert.equal(r.visitors, 0, "case 15: both userId and sessionId null => no visitor");
    }

    // 16. DAU == Traffic visitor count for the same `now` — proven by
    // calling the actual production entry points (getTrafficViewModel,
    // collectAudienceDau), not just the shared helper directly.
    {
      const now16 = new Date(Date.UTC(2020, 5, 16, 15, 0, 0)); // 2020-06-16 18:00 Europe/Minsk
      await pageView({ at: new Date(Date.UTC(2020, 5, 16, 10, 0, 0)), sessionId: sid("c16"), userId: userU });
      const traffic = await getTrafficViewModel(prisma, now16);
      const [dauSample] = await collectAudienceDau({ prisma, now: now16 });
      assert.equal(traffic.uniqueVisitorsToday, 1, "case 16: Traffic uniqueVisitorsToday");
      assert.equal(dauSample.value, 1, "case 16: audience.dau");
      assert.equal(
        traffic.uniqueVisitorsToday,
        dauSample.value,
        "case 16: Traffic.uniqueVisitorsToday must equal audience.dau for the same window",
      );
    }

    // 17 + 18. WAU >= DAU >= 0 and MAU >= WAU for a deterministic nested
    // fixture: one visitor added per window, each window strictly nested
    // inside the next (day ⊂ week ⊂ month).
    {
      const monthStart = new Date(Date.UTC(2020, 6, 1, 0, 0, 0));
      const monthEnd = new Date(Date.UTC(2020, 6, 31, 0, 0, 0));
      const weekStart = new Date(Date.UTC(2020, 6, 24, 0, 0, 0));
      const dayStart = new Date(Date.UTC(2020, 6, 30, 0, 0, 0));

      const dayEnd = new Date(Date.UTC(2020, 6, 31, 0, 0, 0));

      await pageView({ at: new Date(Date.UTC(2020, 6, 10, 12, 0, 0)), sessionId: sid("c17-month-only") });
      await pageView({ at: new Date(Date.UTC(2020, 6, 25, 12, 0, 0)), sessionId: sid("c17-week") });
      await pageView({ at: new Date(Date.UTC(2020, 6, 30, 12, 0, 0)), sessionId: sid("c17-day") });

      const dauCount = (await computeCanonicalAudience(prisma, dayStart, dayEnd)).visitors;
      const wauCount = (await computeCanonicalAudience(prisma, weekStart, dayEnd)).visitors;
      const mauCount = (await computeCanonicalAudience(prisma, monthStart, monthEnd)).visitors;

      assert.equal(dauCount, 1, "case 17: day window sees only the day-window visitor");
      assert.equal(wauCount, 2, "case 17: week window sees day + week visitors");
      assert.equal(mauCount, 3, "case 18: month window sees day + week + month visitors");
      assert.ok(wauCount >= dauCount, "case 17: WAU >= DAU");
      assert.ok(mauCount >= wauCount, "case 18: MAU >= WAU");
    }

    // --- Product page views: SAME eligibility contract as visitors ---
    // (§ align product page views with canonical audience exclusions)

    // pv1. anonymous A, 3 PAGE_VIEW => visitors 1, pageViews 3
    {
      const w = win(14);
      for (let i = 0; i < 3; i += 1) {
        await pageView({ at: new Date(w.start.getTime() + i * 1000), sessionId: sid("pv1-A") });
      }
      const r = await computeCanonicalAudience(prisma, w.start, w.end);
      assert.equal(r.visitors, 1, "pv1: anonymous A => 1 visitor");
      assert.equal(r.pageViews, 3, "pv1: all 3 anonymous PAGE_VIEW rows are eligible");
    }

    // pv2. USER U, session A, 3 PAGE_VIEW => visitors 1, pageViews 3
    {
      const w = win(15);
      for (let i = 0; i < 3; i += 1) {
        await pageView({ at: new Date(w.start.getTime() + i * 1000), sessionId: sid("pv2-A"), userId: userU });
      }
      const r = await computeCanonicalAudience(prisma, w.start, w.end);
      assert.equal(r.visitors, 1, "pv2: USER U => 1 visitor");
      assert.equal(r.pageViews, 3, "pv2: all 3 authenticated PAGE_VIEW rows are eligible");
    }

    // pv3. anonymous A then login USER U => visitors 1, ALL rows in A count
    // (2 pre-login anonymous rows + 1 post-login authenticated row = 3 eligible page views)
    {
      const w = win(16);
      await pageView({ at: new Date(w.start.getTime() + 1000), sessionId: sid("pv3-A") });
      await pageView({ at: new Date(w.start.getTime() + 2000), sessionId: sid("pv3-A") });
      await pageView({ at: new Date(w.start.getTime() + 3000), sessionId: sid("pv3-A"), userId: userU });
      const r = await computeCanonicalAudience(prisma, w.start, w.end);
      assert.equal(r.visitors, 1, "pv3: anon-then-login => 1 visitor");
      assert.equal(r.pageViews, 3, "pv3: pre-login anonymous rows count too — they're that visitor's journey");
    }

    // pv4. ADMIN only => visitors 0, pageViews 0
    {
      const w = win(17);
      await pageView({ at: new Date(w.start.getTime() + 1000), sessionId: sid("pv4-admin"), userId: userAdmin });
      const r = await computeCanonicalAudience(prisma, w.start, w.end);
      assert.equal(r.visitors, 0, "pv4: ADMIN-only => 0 visitors");
      assert.equal(r.pageViews, 0, "pv4: ADMIN-only => 0 product page views");
    }

    // pv5. anonymous A then login ADMIN => visitors 0, pageViews 0
    // INCLUDING the pre-login anonymous-looking row — the whole session is tainted.
    {
      const w = win(18);
      await pageView({ at: new Date(w.start.getTime() + 1000), sessionId: sid("pv5-A") });
      await pageView({ at: new Date(w.start.getTime() + 2000), sessionId: sid("pv5-A"), userId: userAdmin });
      const r = await computeCanonicalAudience(prisma, w.start, w.end);
      assert.equal(r.visitors, 0, "pv5: anon-then-ADMIN-login => 0 visitors");
      assert.equal(r.pageViews, 0, "pv5: pre-login row on an ADMIN-tainted session must also be excluded");
    }

    // pv6. MODERATOR — same as pv5
    {
      const w = win(19);
      await pageView({ at: new Date(w.start.getTime() + 1000), sessionId: sid("pv6-A") });
      await pageView({ at: new Date(w.start.getTime() + 2000), sessionId: sid("pv6-A"), userId: userModerator });
      const r = await computeCanonicalAudience(prisma, w.start, w.end);
      assert.equal(r.visitors, 0, "pv6: anon-then-MODERATOR-login => 0 visitors");
      assert.equal(r.pageViews, 0, "pv6: pre-login row on a MODERATOR-tainted session must also be excluded");
    }

    // pv7. BUSINESS_OWNER public browsing => visitors 1, pageViews counted normally
    {
      const w = win(20);
      await pageView({ at: new Date(w.start.getTime() + 1000), sessionId: sid("pv7-biz"), userId: userBusiness });
      await pageView({ at: new Date(w.start.getTime() + 2000), sessionId: sid("pv7-biz"), userId: userBusiness });
      const r = await computeCanonicalAudience(prisma, w.start, w.end);
      assert.equal(r.visitors, 1, "pv7: BUSINESS_OWNER => 1 visitor");
      assert.equal(r.pageViews, 2, "pv7: BUSINESS_OWNER page views count normally");
    }

    // pv8. eligible anonymous A + ADMIN session B => totals contain only A
    {
      const w = win(21);
      await pageView({ at: new Date(w.start.getTime() + 1000), sessionId: sid("pv8-A") });
      await pageView({ at: new Date(w.start.getTime() + 2000), sessionId: sid("pv8-A") });
      await pageView({ at: new Date(w.start.getTime() + 3000), sessionId: sid("pv8-B"), userId: userAdmin });
      const r = await computeCanonicalAudience(prisma, w.start, w.end);
      assert.equal(r.visitors, 1, "pv8: only session A is an eligible visitor");
      assert.equal(r.pageViews, 2, "pv8: only session A's 2 rows are eligible page views");
    }

    // pv9. null userId + null sessionId PAGE_VIEW => no visitor, no product page view
    {
      const w = win(22);
      await pageView({ at: new Date(w.start.getTime() + 1000), sessionId: null, userId: null });
      const r = await computeCanonicalAudience(prisma, w.start, w.end);
      assert.equal(r.visitors, 0, "pv9: both IDs null => no visitor");
      assert.equal(r.pageViews, 0, "pv9: both IDs null => no product page view");
    }

    // pv10. CARD_VIEW/SAVE => no audience/page-view contribution
    {
      const w = win(23);
      await nonPageView("CARD_VIEW", { at: new Date(w.start.getTime() + 1000), sessionId: sid("pv10-A") });
      await nonPageView("SAVE", { at: new Date(w.start.getTime() + 2000), sessionId: sid("pv10-A") });
      const r = await computeCanonicalAudience(prisma, w.start, w.end);
      assert.equal(r.visitors, 0, "pv10: no PAGE_VIEW => 0 visitors");
      assert.equal(r.pageViews, 0, "pv10: no PAGE_VIEW => 0 product page views");
    }

    // pv11. Traffic DAU == canonical visitors — already proven end-to-end by
    // case 16 above (getTrafficViewModel + collectAudienceDau on the same
    // fixture/window); not duplicated here.

    // pv12. viewsPerVisitor = canonical product pageViews / canonical visitors,
    // proven end-to-end via the real getTrafficViewModel entry point: 1
    // eligible USER visitor with 3 eligible page views + 1 ADMIN session
    // (2 more raw rows, all ineligible) => pageViews must stay 3, not 5.
    {
      const now12 = new Date(Date.UTC(2020, 5, 20, 15, 0, 0));
      const dayStart12 = new Date(Date.UTC(2020, 5, 19, 21, 0, 0)); // 00:00 Europe/Minsk
      await pageView({ at: new Date(dayStart12.getTime() + 1000), sessionId: sid("pv12-user"), userId: userU });
      await pageView({ at: new Date(dayStart12.getTime() + 2000), sessionId: sid("pv12-user"), userId: userU });
      await pageView({ at: new Date(dayStart12.getTime() + 3000), sessionId: sid("pv12-user"), userId: userU });
      await pageView({ at: new Date(dayStart12.getTime() + 4000), sessionId: sid("pv12-admin"), userId: userAdmin });
      await pageView({ at: new Date(dayStart12.getTime() + 5000), sessionId: sid("pv12-admin"), userId: userAdmin });
      const traffic = await getTrafficViewModel(prisma, now12);
      assert.equal(traffic.uniqueVisitorsToday, 1, "pv12: 1 eligible visitor (ADMIN excluded)");
      assert.equal(traffic.pageViewsToday, 3, "pv12: only the eligible visitor's 3 page views count");
      assert.equal(traffic.pageViewsPerVisitor, 3, "pv12: viewsPerVisitor = 3 eligible pageViews / 1 eligible visitor");
    }

    // pv13. zero visitors + internal-only traffic => pageViews 0, viewsPerVisitor null
    {
      const now13 = new Date(Date.UTC(2020, 5, 21, 15, 0, 0));
      const dayStart13 = new Date(Date.UTC(2020, 5, 20, 21, 0, 0)); // 00:00 Europe/Minsk
      await pageView({ at: new Date(dayStart13.getTime() + 1000), sessionId: sid("pv13-admin"), userId: userAdmin });
      const traffic = await getTrafficViewModel(prisma, now13);
      assert.equal(traffic.uniqueVisitorsToday, 0, "pv13: internal-only traffic => 0 visitors");
      assert.equal(traffic.pageViewsToday, 0, "pv13: internal-only traffic => 0 product page views");
      assert.equal(traffic.pageViewsPerVisitor, null, "pv13: 0-visitor guard => null, never Infinity/NaN");
    }

    console.log("canonicalAudience.integration.test.ts: OK");
  } finally {
    await prisma.userEvent.deleteMany({
      where: {
        OR: [
          { sessionId: { startsWith: `fx-${marker}-` } },
          { userId: { in: userIds } },
        ],
      },
    });
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("canonicalAudience.integration.test.ts: FAILED", error);
  process.exitCode = 1;
});
