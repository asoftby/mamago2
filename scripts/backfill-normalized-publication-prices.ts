import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { prismaBase as prisma } from "../src/lib/prisma";
import type { PublicationPriceMode } from "../src/domain/pricing/normalizedPrice";

type Entity = "Activity" | "Offer" | "Place";
type Classification = "AUTO_SAFE" | "RECOVERABLE" | "MANUAL_REVIEW" | "NONE";
type Proposal = { mode: PublicationPriceMode; min: number | null; max: number | null; currency: string };
type PreviewRow = { entity: Entity; id: string; classification: Classification; proposed: Proposal };
type CurrentState = { id: string; priceMode: PublicationPriceMode; priceFrom: number | null; priceTo: number | null; currency: string };
type PlanItem = { entity: Entity; id: string; proposed: Proposal; current: CurrentState; action: "UPDATE" | "SKIP" | "CONFLICT"; reason: string };

const WRITABLE = new Set<Classification>(["AUTO_SAFE", "RECOVERABLE", "NONE"]);

function flagValue(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function assertLocalDatabase() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is required");
  const url = new URL(raw);
  if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname)) throw new Error(`Refusing non-local database host: ${url.hostname}`);
}

function canonical(proposed: Proposal): Proposal {
  if (proposed.mode === "FREE") return { ...proposed, min: 0, max: 0 };
  if (proposed.mode === "EXACT") return { ...proposed, max: proposed.min };
  if (proposed.mode === "FROM") return { ...proposed, max: null };
  if (proposed.mode === "NONE") return { ...proposed, min: null, max: null };
  return proposed;
}

export function planBackfill(rows: PreviewRow[], currentByEntity: Record<Entity, CurrentState[]>): PlanItem[] {
  const lookup = new Map<string, CurrentState>();
  (Object.entries(currentByEntity) as [Entity, CurrentState[]][]).forEach(([entity, states]) => states.forEach((state) => lookup.set(`${entity}:${state.id}`, state)));
  return rows.filter((row) => WRITABLE.has(row.classification)).map((row) => {
    const current = lookup.get(`${row.entity}:${row.id}`);
    if (!current) throw new Error(`Missing target ${row.entity}:${row.id}`);
    const proposed = canonical(row.proposed);
    const exact = current.priceMode === proposed.mode && current.priceFrom === proposed.min && current.priceTo === proposed.max && current.currency === proposed.currency;
    if (exact) return { entity: row.entity, id: row.id, proposed, current, action: "SKIP", reason: "already-canonical" };
    if (current.priceMode !== "UNKNOWN") return { entity: row.entity, id: row.id, proposed, current, action: "CONFLICT", reason: "conflicting-normalized-target" };
    return { entity: row.entity, id: row.id, proposed, current, action: "UPDATE", reason: "legacy-neutral-target" };
  });
}

async function loadCurrent(): Promise<Record<Entity, CurrentState[]>> {
  const select = { id: true, priceMode: true, priceFrom: true, priceTo: true, currency: true } as const;
  const [Activity, Offer, Place] = await Promise.all([prisma.activity.findMany({ select }), prisma.offer.findMany({ select }), prisma.place.findMany({ select })]);
  return { Activity, Offer, Place };
}

function summarize(plan: PlanItem[]) {
  const counts = { UPDATE: 0, SKIP: 0, CONFLICT: 0 };
  plan.forEach((item) => { counts[item.action] += 1; });
  return counts;
}

async function applyPlan(plan: PlanItem[]) {
  await prisma.$transaction(async (tx) => {
    for (const item of plan.filter((candidate) => candidate.action === "UPDATE")) {
      const model = item.entity === "Activity" ? tx.activity : item.entity === "Offer" ? tx.offer : tx.place;
      const result = await model.updateMany({
        where: { id: item.id, priceMode: "UNKNOWN", priceFrom: item.current.priceFrom, priceTo: item.current.priceTo, currency: item.current.currency },
        data: { priceMode: item.proposed.mode, priceFrom: item.proposed.min, priceTo: item.proposed.max, currency: item.proposed.currency },
      });
      if (result.count !== 1) throw new Error(`Concurrent conflict for ${item.entity}:${item.id}`);
    }
  });
}

async function main() {
  assertLocalDatabase();
  const previewPath = flagValue("--preview");
  if (!previewPath) throw new Error("--preview <fresh-preview.json> is required");
  const preview = JSON.parse(readFileSync(previewPath, "utf8")) as { readOnly?: boolean; rows?: PreviewRow[] };
  if (preview.readOnly !== true || !Array.isArray(preview.rows)) throw new Error("Invalid read-only preview artifact");
  const plan = planBackfill(preview.rows, await loadCurrent());
  const counts = summarize(plan);
  const expectedCount = Number(flagValue("--expected-count") ?? "135");
  if (!Number.isInteger(expectedCount) || expectedCount < 1) throw new Error("--expected-count must be a positive integer");
  if (plan.length !== expectedCount) throw new Error(`Approved writable count is ${expectedCount}, got ${plan.length}`);
  if (counts.CONFLICT > 0) {
    console.log(JSON.stringify({ mode: "STOPPED", counts, conflicts: plan.filter((item) => item.action === "CONFLICT") }, null, 2));
    process.exitCode = 2;
    return;
  }
  const apply = process.argv.includes("--apply");
  if (apply) await applyPlan(plan);
  console.log(JSON.stringify({ mode: apply ? "APPLIED" : "DRY_RUN", counts, effectiveWrites: apply ? counts.UPDATE : 0, rows: plan }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main().finally(() => prisma.$disconnect());
