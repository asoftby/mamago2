import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function upsertSignal(slug: string, title: string, options: Array<{ value: string; label: string; order: number }>) {
  // Try to find first to get ID for options update
  // Since we don't have update/create logic nested easily with upsert for relations in this specific way without complex includes,
  // we'll do parent first then children.
  
  const def = await prisma.signalDefinition.upsert({
    where: { slug },
    update: { title, isActive: true },
    create: { slug, title, order: 0, isActive: true },
  })

  for (const o of options) {
    await prisma.signalOption.upsert({
      where: { definitionId_value: { definitionId: def.id, value: o.value } },
      update: { label: o.label, order: o.order, isActive: true },
      create: { definitionId: def.id, value: o.value, label: o.label, order: o.order, isActive: true },
    })
  }
}

async function upsertFilter(slug: string, title: string, type: string, ui: string, options: Array<{ value: string; label: string; order: number }>) {
  const def = await prisma.filterDefinition.upsert({
    where: { slug },
    update: { title, type, ui, isActive: true },
    create: { slug, title, type, ui, order: 0, isActive: true },
  })

  for (const o of options) {
    await prisma.filterOption.upsert({
      where: { filterId_value: { filterId: def.id, value: o.value } },
      update: { label: o.label, order: o.order, isActive: true },
      create: { filterId: def.id, value: o.value, label: o.label, order: o.order, isActive: true },
    })
  }
}

async function main() {
  console.log('Seeding database...')

  // Signals
  console.log('Seeding Signals...')
  await upsertSignal("vibe", "Vibe", [
    { value: "calm", label: "Спокойно", order: 1 },
    { value: "playful", label: "Игриво", order: 2 },
    { value: "active", label: "Активно", order: 3 },
  ])

  await upsertSignal("tempo", "Tempo", [
    { value: "slow", label: "Медленно", order: 1 },
    { value: "medium", label: "Умеренно", order: 2 },
    { value: "fast", label: "Быстро", order: 3 },
  ])

  await upsertSignal("energy", "Energy", [
    { value: "low", label: "Низкая", order: 1 },
    { value: "medium", label: "Средняя", order: 2 },
    { value: "high", label: "Высокая", order: 3 },
  ])

  /** Birthday Builder + ranking: taxonomy `signals.age` (public API `/api/public/signals/age`) */
  await upsertSignal("age", "Возраст", [
    { value: "0-3", label: "0–3 года", order: 1 },
    { value: "3-5", label: "3–5 лет", order: 2 },
    { value: "5-8", label: "6–10 лет", order: 3 },
    { value: "8-12", label: "10+ лет", order: 4 },
  ])

  // Filters
  console.log('Seeding Filters...')
  await upsertFilter("when", "Когда", "single", "tabs", [
    { value: "today", label: "Сегодня", order: 1 },
    { value: "tomorrow", label: "Завтра", order: 2 },
    { value: "weekend", label: "Выходные", order: 3 },
  ])

  await upsertFilter("age", "Возраст", "multi", "multi_tabs", [
    { value: "0-3", label: "0–3", order: 1 },
    { value: "3-5", label: "3–5", order: 2 },
    { value: "6-8", label: "6–8", order: 3 },
    { value: "9-12", label: "9–12", order: 4 },
  ])
  
  // Cities & Districts
  console.log('Seeding Cities & Districts...')
  
  const minsk = await prisma.city.upsert({
    where: { slug: "minsk" },
    update: {},
    create: {
      name: "Минск",
      slug: "minsk",
      lat: 53.9006,
      lng: 27.5590,
    }
  })

  const minskDistricts = [
    "Центральный",
    "Советский",
    "Первомайский",
    "Партизанский",
    "Заводской",
    "Ленинский",
    "Октябрьский",
    "Московский",
    "Фрунзенский",
  ]

  for (const name of minskDistricts) {
    await prisma.district.upsert({
      where: { cityId_name: { cityId: minsk.id, name } },
      update: {},
      create: {
        cityId: minsk.id,
        name,
      }
    })
  }

  console.log('Seeding finished.')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
