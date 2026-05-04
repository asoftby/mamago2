#!/usr/bin/env tsx

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkSignalsStructure() {
  console.log("🔍 Проверка полной структуры сигналов...\n");

  const allSignals = await prisma.signalDefinition.findMany({
    orderBy: [
      { order: "asc" },
      { slug: "asc" },
    ],
  });

  console.log(`📊 Всего сигналов: ${allSignals.length}\n`);

  // Группируем по доменам
  const domainSignals = allSignals.filter(s => s.slug.startsWith("domain-"));
  const profileSignals = allSignals.filter(s => s.domain === "PROFILE");
  const discoverySignals = allSignals.filter(s => s.domain === "DISCOVERY");
  const recommendationSignals = allSignals.filter(s => s.domain === "RECOMMENDATION");
  const noDomainSignals = allSignals.filter(s => !s.domain && !s.slug.startsWith("domain-"));

  console.log("🏗️  ДОМЕННАЯ СТРУКТУРА:");
  console.log(`   📍 Доменные корневые узлы: ${domainSignals.length}`);
  console.log(`   📍 PROFILE сигналы: ${profileSignals.length}`);
  console.log(`   📍 DISCOVERY сигналы: ${discoverySignals.length}`);
  console.log(`   📍 RECOMMENDATION сигналы: ${recommendationSignals.length}`);
  console.log(`   📍 Без домена: ${noDomainSignals.length}\n`);

  console.log("🌳 ДОМЕННЫЕ КОРНЕВЫЕ УЗЛЫ:");
  domainSignals.forEach(signal => {
    console.log(`   📍 ${signal.slug} (${signal.title})`);
    console.log(`      Домен: ${signal.domain}`);
    console.log(`      Порядок: ${signal.order}`);
    console.log(`      Статус: ${signal.status}`);
    console.log("");
  });

  if (noDomainSignals.length > 0) {
    console.log("⚠️  СИГНАЛЫ БЕЗ ДОМЕНА (требуют миграции):");
    noDomainSignals.forEach(signal => {
      const hasChildren = allSignals.some(s => s.parentId === signal.id);
      const isChild = signal.parentId !== null;
      
      console.log(`   📍 ${signal.slug} (${signal.title})`);
      console.log(`      Тип: ${isChild ? "дочерний" : "корневой"}`);
      console.log(`      Порядок: ${signal.order}`);
      console.log(`      Статус: ${signal.status}`);
      if (hasChildren) {
        const children = allSignals.filter(s => s.parentId === signal.id);
        console.log(`      Дочерние (${children.length}): ${children.map(c => c.slug).join(", ")}`);
      }
      console.log("");
    });
  }

  // Проверим иерархию
  const rootSignals = allSignals.filter(s => !s.parentId);
  const childSignals = allSignals.filter(s => s.parentId);

  console.log("📈 ИЕРАРХИЧЕСКАЯ СТРУКТУРА:");
  console.log(`   📍 Корневые сигналы: ${rootSignals.length}`);
  console.log(`   📍 Дочерние сигналы: ${childSignals.length}\n`);

  // Проверим orphaned сигналы
  const orphanedSignals = childSignals.filter(s => 
    !allSignals.find(parent => parent.id === s.parentId)
  );

  if (orphanedSignals.length > 0) {
    console.log("❌ ORPHANED СИГНАЛЫ (без родителя):");
    orphanedSignals.forEach(signal => {
      console.log(`   📍 ${signal.slug} - parentId: ${signal.parentId}`);
    });
  } else {
    console.log("✅ Все дочерние сигналы имеют корректных родителей");
  }
}

async function main() {
  try {
    await checkSignalsStructure();
  } catch (error) {
    console.error("❌ Ошибка при проверке:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}