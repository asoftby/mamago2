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
