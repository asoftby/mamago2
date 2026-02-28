import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

async function upsertSignal(slug: string, title: string, options: Array<{ value: string; label: string; order: number }>) {
  const def = await prisma.signalDefinition.upsert({
    where: { slug },
    update: { title, isActive: true },
    create: { slug, title, order: 0, isActive: true },
  });

  for (const o of options) {
    await prisma.signalOption.upsert({
      where: { definitionId_value: { definitionId: def.id, value: o.value } },
      update: { label: o.label, order: o.order, isActive: true },
      create: { definitionId: def.id, value: o.value, label: o.label, order: o.order, isActive: true },
    });
  }
}

async function upsertFilter(slug: string, title: string, type: string, ui: string, options: Array<{ value: string; label: string; order: number }>) {
  const def = await prisma.filterDefinition.upsert({
    where: { slug },
    update: { title, type, ui, isActive: true },
    create: { slug, title, type, ui, order: 0, isActive: true },
  });

  for (const o of options) {
    await prisma.filterOption.upsert({
      where: { filterId_value: { filterId: def.id, value: o.value } },
      update: { label: o.label, order: o.order, isActive: true },
      create: { filterId: def.id, value: o.value, label: o.label, order: o.order, isActive: true },
    });
  }
}

export async function POST() {
  // Signals
  await upsertSignal("vibe", "Vibe", [
    { value: "calm", label: "Спокойно", order: 1 },
    { value: "playful", label: "Игриво", order: 2 },
    { value: "active", label: "Активно", order: 3 },
  ]);

  await upsertSignal("tempo", "Tempo", [
    { value: "slow", label: "Медленно", order: 1 },
    { value: "medium", label: "Умеренно", order: 2 },
    { value: "fast", label: "Быстро", order: 3 },
  ]);

  await upsertSignal("energy", "Energy", [
    { value: "low", label: "Низкая", order: 1 },
    { value: "medium", label: "Средняя", order: 2 },
    { value: "high", label: "Высокая", order: 3 },
  ]);

  // Filters
  await upsertFilter("when", "Когда", "single", "tabs", [
    { value: "today", label: "Сегодня", order: 1 },
    { value: "tomorrow", label: "Завтра", order: 2 },
    { value: "weekend", label: "Выходные", order: 3 },
  ]);

  await upsertFilter("age", "Возраст", "multi", "multi_tabs", [
    { value: "0-3", label: "0–3", order: 1 },
    { value: "3-5", label: "3–5", order: 2 },
    { value: "6-8", label: "6–8", order: 3 },
    { value: "9-12", label: "9–12", order: 4 },
  ]);

  const counts = {
    signals: await prisma.signalDefinition.count(),
    filters: await prisma.filterDefinition.count(),
  };

  return NextResponse.json({ ok: true, counts });
}
