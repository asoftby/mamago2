"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AddParticipantModal } from "@/components/children/AddParticipantModal";

/* ============================================================
   1:1 port of the Claude Design "Мой аккаунт" page.
   All visual styling lives in the scoped <style> below (every
   selector prefixed with `.mg-acc` so it never leaks globally).
   Data is supplied by the server component via props.
   ============================================================ */

export type AccountFamilyMember = {
  key: string;
  initial: string;
  name: string;
  role: string;
  /** Italic helper line when the member has no interest chips. */
  hint?: string;
  /** Interest chips (children). When present, replaces `hint`. */
  interests?: string[];
};

export type AccountRoute = {
  id: string;
  title: string;
  points: number;
  price: string;
  status: "published" | "draft";
  href: string;
};

export type AccountParty = {
  id: string;
  name: string;
  dateTime: string;
  confirmedOf: number;
  total: number;
  chips: { label: string; confirmed: boolean }[];
  href: string;
};

export type AccountDesignProps = {
  userName: string;
  greeting: string;
  stats: { n: number; label: string }[];
  settingsHref: string;
  homeHref: string;
  family: AccountFamilyMember[];
  manageFamilyHref: string;
  bookingsHref: string;
  routes: AccountRoute[];
  createRouteHref: string;
  parties: AccountParty[];
  partiesHref: string;
  createPartyHref: string;
};

/* ── Reveal-on-scroll (matches the design's IntersectionObserver) ── */
function useReveal() {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.08 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

function Reveal({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useReveal();
  return (
    <div ref={ref} className={`reveal ${className}`} style={style}>
      {children}
    </div>
  );
}

/* ── Icons (verbatim from the design) ── */
const Ic = {
  Settings: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  Cal: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
      <path d="m9 15 2 2 4-4" />
    </svg>
  ),
  Arrow: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
  Plus: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  Check: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  PinSm: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s7-7.5 7-12a7 7 0 1 0-14 0c0 4.5 7 12 7 12z" />
    </svg>
  ),
};

export function AccountDesign(props: AccountDesignProps) {
  const {
    userName,
    greeting,
    stats,
    settingsHref,
    homeHref,
    family,
    manageFamilyHref,
    bookingsHref,
    routes,
    createRouteHref,
    parties,
    partiesHref,
    createPartyHref,
  } = props;

  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);

  return (
    <div className="mg-acc">
      <style>{CSS}</style>

      <div className="mg-acc__content">
        {/* ── Breadcrumbs ── */}
        <div
          className="wrap"
          style={{ paddingTop: 24, paddingBottom: 8, display: "flex", gap: 8, alignItems: "center", color: "var(--ink-3)", fontSize: 13 }}
        >
          <Link href={homeHref} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            ← Главная
          </Link>
          <span style={{ opacity: 0.5 }}>→</span>
          <span style={{ color: "var(--ink)" }}>Мой аккаунт</span>
        </div>

        {/* ── Profile hero ── */}
        <section style={{ paddingTop: 24, paddingBottom: 44 }}>
          <div className="hero-grid wrap">
            <Reveal>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
                <span className="caps" style={{ color: "var(--accent-deep)" }}>● Мой аккаунт</span>
                <span className="caps">{greeting}</span>
              </div>
              <h1 className="serif" style={{ margin: 0, fontSize: "100px", lineHeight: 0.92, letterSpacing: "-.03em" }}>
                {userName}
                <span style={{ fontStyle: "italic", color: "var(--accent-deep)" }}>.</span>
              </h1>
              <p style={{ maxWidth: 520, marginTop: 22, marginBottom: 0, fontSize: 18, lineHeight: 1.5, color: "var(--ink-2)" }}>
                Семья, маршруты и&nbsp;праздники — всё в&nbsp;одном месте. Настройте профиль, чтобы рекомендации были точнее.
              </p>
            </Reveal>

            <Reveal style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "stretch" }}>
              <div
                style={{
                  padding: "16px 18px",
                  background: "var(--paper)",
                  border: "1px solid var(--line)",
                  borderRadius: 14,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                {stats.map((s, i) => (
                  <div key={i} style={{ textAlign: "center", flex: 1 }}>
                    <div className="serif" style={{ fontSize: 30, lineHeight: 1, letterSpacing: "-.02em" }}>{s.n}</div>
                    <div className="mono" style={{ fontSize: 9.5, color: "var(--ink-3)", letterSpacing: ".08em", textTransform: "uppercase", marginTop: 4 }}>
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
              <Link href={settingsHref} className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-end" }}>
                <Ic.Settings /> Настройки
              </Link>
            </Reveal>
          </div>
        </section>

        {/* ── Family ── */}
        <section className="wrap" style={{ marginBottom: 44 }}>
          <Reveal>
            <div className="kicker">
              <span className="caps">Моя семья</span>
              <span className="line" />
              <Link href={manageFamilyHref}>Управлять →</Link>
            </div>
            <div className="member-row" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {family.map((m) => (
                <div key={m.key} className="member-card" style={{ flex: "0 0 auto" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 12,
                        flexShrink: 0,
                        background: "var(--accent-soft)",
                        color: "var(--accent-deep)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: "var(--font-display)",
                        fontSize: 22,
                        fontStyle: "italic",
                      }}
                    >
                      {m.initial}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-.005em" }}>{m.name}</div>
                      <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 1 }}>{m.role}</div>
                    </div>
                  </div>
                  {m.interests && m.interests.length > 0 ? (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                      {m.interests.map((i, idx) => (
                        <span
                          key={idx}
                          style={{ padding: "3px 8px", borderRadius: 99, background: "var(--bg)", border: "1px solid var(--line)", fontSize: 11, color: "var(--ink-3)" }}
                        >
                          {i}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 6, fontStyle: "italic" }}>{m.hint}</div>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="member-add"
                style={{ flex: "0 0 auto", minWidth: 110 }}
                onClick={() => setIsAddMemberOpen(true)}
                aria-label="Добавить участника"
              >
                <div style={{ width: 38, height: 38, borderRadius: 99, border: "1.5px dashed var(--line-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Ic.Plus />
                </div>
                <span style={{ fontSize: 12, color: "var(--ink-3)", textAlign: "center", lineHeight: 1.3 }}>
                  Добавить<br />участника
                </span>
              </button>
            </div>
          </Reveal>
        </section>

        {/* ── Bookings nav row ── */}
        <section className="wrap" style={{ marginBottom: 44 }}>
          <Reveal>
            <div className="kicker">
              <span className="caps">Мои записи</span>
              <span className="line" />
              <Link href={bookingsHref}>Все записи →</Link>
            </div>
            <Link href={bookingsHref} className="card booking-card" style={{ display: "flex", alignItems: "center", gap: 16, padding: "20px 24px" }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, flexShrink: 0, background: "var(--accent-soft)", color: "var(--accent-deep)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Ic.Cal />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="serif" style={{ fontSize: 22, lineHeight: 1.1, letterSpacing: "-.015em" }}>Заявки и&nbsp;бронирования</div>
                <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 3 }}>Следите за&nbsp;статусом записей на&nbsp;занятия и&nbsp;события</div>
              </div>
              <span style={{ color: "var(--ink-3)", fontSize: 22 }}>→</span>
            </Link>
          </Reveal>
        </section>

        {/* ── Routes ── (hidden until section release) */}
        {false && (
        <section className="wrap" style={{ marginBottom: 44 }}>
          <Reveal>
            <div className="kicker">
              <span className="caps">Мои маршруты</span>
              <span className="line" />
              <Link href={createRouteHref}>+ Создать</Link>
            </div>
            <div className="card" style={{ padding: "6px 24px" }}>
              {routes.length === 0 ? (
                <div style={{ padding: "26px 0", textAlign: "center" }}>
                  <div style={{ fontSize: 14, color: "var(--ink-3)", marginBottom: 14 }}>У вас пока нет маршрутов</div>
                  <Link href={createRouteHref} className="btn btn-accent btn-sm" style={{ display: "inline-flex" }}>
                    <Ic.Plus /> Создать первый маршрут
                  </Link>
                </div>
              ) : (
                routes.map((r, i) => (
                  <Link
                    key={r.id}
                    href={r.href}
                    className="route-row"
                    style={{ borderBottom: i < routes.length - 1 ? "1px solid var(--line)" : "none" }}
                  >
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 12,
                        flexShrink: 0,
                        background:
                          "repeating-linear-gradient(135deg, rgba(20,18,16,.05) 0 1px, transparent 1px 10px), linear-gradient(180deg, #E9E2D6, #DDD3C2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--ink-3)",
                      }}
                    >
                      <Ic.PinSm />
                    </div>
                    <div style={{ minWidth: 0, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                      <div style={{ minWidth: 0 }}>
                        <div className="route-title serif" style={{ fontSize: 22, letterSpacing: "-.015em", color: "var(--ink)", lineHeight: 1.1, marginBottom: 7, transition: "color .15s" }}>
                          {r.title}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--ink-3)" }}>
                            <Ic.PinSm /> {r.points} {r.points === 1 ? "точка" : "точки"}
                          </span>
                          <span className="mono" style={{ fontSize: 12, color: "var(--ink-3)" }}>{r.price}</span>
                          <span className={`pill ${r.status === "published" ? "pill-ok" : "pill-draft"}`}>
                            {r.status === "published" ? "Опубликован" : "Черновик"}
                          </span>
                        </div>
                      </div>
                      <span className="nav-arr">›</span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </Reveal>
        </section>
        )}

        {/* ── Parties ── (hidden until section release) */}
        {false && (
        <section className="wrap" style={{ marginBottom: 80 }}>
          <Reveal>
            <div className="kicker">
              <span className="caps">Мои праздники</span>
              <span className="line" />
              <Link href={partiesHref}>Смотреть все →</Link>
            </div>
            <div className="card">
              {parties.length === 0 ? (
                <div style={{ padding: "26px 0", textAlign: "center" }}>
                  <div style={{ fontSize: 14, color: "var(--ink-3)", marginBottom: 14 }}>Здесь появятся ваши праздники</div>
                  <Link href={createPartyHref} className="btn btn-accent btn-sm" style={{ display: "inline-flex" }}>
                    Создать праздник <Ic.Arrow />
                  </Link>
                </div>
              ) : (
                <>
                  {parties.map((p) => {
                    const pct = p.total > 0 ? (p.confirmedOf / p.total) * 100 : 0;
                    const allOk = p.total > 0 && p.confirmedOf === p.total;
                    return (
                      <div key={p.id} className="plan-row">
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                          <div>
                            <div className="caps" style={{ color: "var(--accent-deep)", marginBottom: 4 }}>● {p.dateTime}</div>
                            <div className="serif" style={{ fontSize: 24, lineHeight: 1.05, letterSpacing: "-.015em" }}>{p.name}</div>
                          </div>
                          <Link href={p.href} className="party-open">
                            Открыть <Ic.Arrow />
                          </Link>
                        </div>
                        <div style={{ marginBottom: 10 }}>
                          <div className="prog-bar">
                            <i style={{ width: `${pct}%`, background: allOk ? "var(--ok)" : "var(--accent)" }} />
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontSize: 12, color: "var(--ink-3)" }}>
                            <span style={{ color: allOk ? "var(--ok)" : "var(--accent-deep)", fontWeight: 600 }}>
                              {allOk ? "✓ Все подтвердили" : `Подтвердили ${p.confirmedOf} из ${p.total}`}
                            </span>
                            <span>{p.total} исполнителя</span>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                          {p.chips.map((c, i) => (
                            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <span
                                style={{
                                  padding: "4px 10px",
                                  borderRadius: 99,
                                  background: c.confirmed ? "var(--ok-bg)" : "var(--bg)",
                                  border: `1px solid ${c.confirmed ? "rgba(31,138,91,.2)" : "var(--line)"}`,
                                  fontSize: 12,
                                  color: c.confirmed ? "var(--ok)" : "var(--ink-2)",
                                  fontWeight: c.confirmed ? 600 : 400,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                              >
                                {c.confirmed && <Ic.Check />} {c.label}
                              </span>
                              {i < p.chips.length - 1 && <span style={{ color: "var(--line-2)", fontSize: 12 }}>→</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, color: "var(--ink-3)" }}>Организуйте следующий праздник</span>
                    <Link href={createPartyHref} className="btn btn-accent btn-sm">
                      Создать <Ic.Arrow />
                    </Link>
                  </div>
                </>
              )}
            </div>
          </Reveal>
        </section>
        )}
      </div>

      <AddParticipantModal
        isOpen={isAddMemberOpen}
        onClose={() => setIsAddMemberOpen(false)}
      />
    </div>
  );
}

/* ── Scoped stylesheet (every rule namespaced under `.mg-acc`) ── */
const CSS = `
.mg-acc{
  --font-display:var(--font-pt-serif),Georgia,serif;
  --font-body:var(--font-sans),ui-sans-serif,system-ui,sans-serif;
  --acc-font-mono:var(--font-mono),ui-monospace,monospace;
  --bg:#ffffff; --paper:#FAF7F1; --ink:#141210;
  --ink-2:#3A332B; --ink-3:rgba(20,18,16,.55);
  --line:rgba(20,18,16,.10); --line-2:rgba(20,18,16,.18);
  --accent:#E86A3A; --accent-deep:#C24E22; --accent-soft:#FFE8DC;
  --ok:#1F8A5B; --ok-bg:rgba(31,138,91,.10);
  --warn:#854F0B; --warn-bg:rgba(133,79,11,.10);
  --hot:#D6342B;
  --maxw:1100px;
  position:relative;
  background:var(--bg); color:var(--ink);
  font-family:var(--font-body); font-size:16px; line-height:1.5;
  -webkit-font-smoothing:antialiased; overflow-x:hidden;
}
.mg-acc *{box-sizing:border-box}
.mg-acc::before{display:none}
.mg-acc__content{position:relative;z-index:1;background:#fff}
.mg-acc .serif{font-family:var(--font-display);font-weight:400;letter-spacing:-.01em}
.mg-acc .mono{font-family:var(--acc-font-mono);letter-spacing:.02em}
.mg-acc .caps{font-family:var(--acc-font-mono);text-transform:uppercase;font-size:11px;letter-spacing:.14em;color:var(--ink-3)}
.mg-acc a{color:inherit;text-decoration:none}
.mg-acc button{font-family:inherit;cursor:pointer;border:0;background:none;color:inherit}
.mg-acc ::selection{background:var(--accent);color:#fff}
.mg-acc .wrap{max-width:var(--maxw);margin:0 auto;padding:0 24px}
.mg-acc .reveal{opacity:0;transform:translateY(14px);transition:opacity .9s cubic-bezier(.2,.7,.2,1),transform .9s cubic-bezier(.2,.7,.2,1)}
.mg-acc .reveal.in{opacity:1;transform:none}
.mg-acc .hero-grid{display:grid;grid-template-columns:1fr 280px;gap:48px;align-items:flex-end}

/* Kicker divider */
.mg-acc .kicker{display:flex;align-items:center;gap:14px;color:var(--ink-3);margin-bottom:18px}
.mg-acc .kicker .line{flex:1;height:1px;background:var(--line)}
.mg-acc .kicker a{font-size:12px;color:var(--accent-deep);font-weight:600;transition:opacity .15s}
.mg-acc .kicker a:hover{opacity:.7}

/* Buttons */
.mg-acc .btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;height:50px;padding:0 20px;border-radius:999px;font-weight:600;font-size:14px;letter-spacing:.005em;border:1px solid transparent;transition:transform .18s ease, background .2s, color .2s, border-color .2s}
.mg-acc .btn:active{transform:translateY(1px)}
.mg-acc .btn-sm{height:40px;padding:0 16px;font-size:13px}
.mg-acc .btn-primary{background:var(--ink);color:#FAF7F1}
.mg-acc .btn-primary:hover{background:#000}
.mg-acc .btn-accent{background:var(--accent);color:#fff}
.mg-acc .btn-accent:hover{background:var(--accent-deep)}
.mg-acc .btn-ghost{background:transparent;color:var(--ink);border-color:var(--line-2)}
.mg-acc .btn-ghost:hover{border-color:var(--ink);background:rgba(20,18,16,.04)}

/* Card */
.mg-acc .card{background:var(--paper);border:1px solid var(--line);border-radius:22px;padding:24px}
.mg-acc .booking-card{transition:transform .18s, border-color .18s}
.mg-acc .booking-card:hover{border-color:var(--ink);transform:translateY(-2px)}

/* Pills */
.mg-acc .pill{display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 9px;border-radius:99px;font-family:var(--acc-font-mono);font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap}
.mg-acc .pill-ok{background:var(--ok-bg);color:var(--ok)}
.mg-acc .pill-draft{background:rgba(20,18,16,.07);color:var(--ink-3)}
.mg-acc .pill-warn{background:var(--warn-bg);color:var(--warn)}
.mg-acc .pill-accent{background:var(--accent-soft);color:var(--accent-deep)}

/* Family member card */
.mg-acc .member-card{
  display:flex;flex-direction:column;gap:6px;padding:14px;
  background:var(--paper);border:1px solid var(--line);border-radius:16px;
  cursor:pointer;transition:all .18s;min-width:160px;
}
.mg-acc .member-card:hover{border-color:var(--ink);transform:translateY(-2px)}
.mg-acc .member-add{
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:8px;padding:14px;min-width:120px;
  background:var(--paper);
  border:1.5px dashed var(--line-2);border-radius:16px;
  cursor:pointer;transition:all .18s;color:var(--ink-3);
}
.mg-acc .member-add:hover{border-color:var(--ink);color:var(--ink)}

/* Row nav arrow */
.mg-acc .nav-arr{transition:transform .2s;color:var(--ink-3);font-size:18px}

/* Route row */
.mg-acc .route-row{
  display:grid;grid-template-columns:56px 1fr;gap:14px;
  padding:14px 0;border-bottom:1px solid var(--line);
  cursor:pointer;align-items:center;transition:all .15s;
}
.mg-acc .route-row:last-child{border-bottom:none}
.mg-acc .route-row:hover .route-title{color:var(--accent-deep)}
.mg-acc .route-row:hover .nav-arr{transform:translateX(4px)}

/* Plan / party row */
.mg-acc .plan-row{padding:16px 0;border-bottom:1px solid var(--line)}
.mg-acc .plan-row:last-child{border-bottom:none}

/* Progress bar */
.mg-acc .prog-bar{height:3px;background:rgba(20,18,16,.08);border-radius:99px;overflow:hidden}
.mg-acc .prog-bar>i{display:block;height:100%;background:var(--accent);border-radius:inherit}

/* Party "open" button */
.mg-acc .party-open{
  height:34px;padding:0 14px;border-radius:99px;
  border:1px solid var(--line-2);background:transparent;
  font-size:13px;font-weight:500;color:var(--accent-deep);
  display:inline-flex;align-items:center;gap:6px;flex-shrink:0;transition:all .15s;
}
.mg-acc .party-open:hover{border-color:var(--accent);background:var(--accent-soft)}

.mg-acc :focus{outline:none}
.mg-acc :focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:6px}

@media(max-width:760px){
  .mg-acc .hero-grid{grid-template-columns:1fr;gap:28px;align-items:stretch}
}
@media(max-width:640px){
  .mg-acc .wrap{padding:0 16px}
  .mg-acc .member-row{overflow-x:auto}
}
`;
