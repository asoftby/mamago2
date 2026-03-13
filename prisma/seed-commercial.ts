/**
 * Commercial Layer Seed Data
 * 
 * Seeds:
 * - Business contracts (active, expiring, expired)
 * - Business placements (active, expiring, expired)
 * - Service placements (promo, stories, featured)
 * - Commercial notifications (expiring/expired alerts)
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedCommercialLayer() {
  console.log("🏢 Seeding Commercial Layer...\n");

  // Get all businesses (any status that's not DRAFT)
  const businesses = await prisma.business.findMany({
    where: {
      status: {
        not: "DRAFT",
      },
    },
    include: {
      billingAccount: {
        include: {
          subscriptions: {
            where: {
              status: "ACTIVE",
            },
            include: {
              plan: true,
            },
          },
        },
      },
    },
  });

  if (businesses.length === 0) {
    console.log("⚠️  No active businesses found. Run main seed first.");
    return;
  }

  console.log(`Found ${businesses.length} businesses\n`);

  // Get plans for placements
  const plans = await prisma.plan.findMany();

  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const in365Days = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const ago30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ago7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Seed contracts for each business
  console.log("📄 Creating contracts...");
  let contractCount = 0;

  for (const [index, business] of businesses.entries()) {
    const contractNumber = `DOG-2024-${String(index + 1).padStart(4, "0")}`;

    // Determine contract status based on index
    let status: "ACTIVE" | "EXPIRING" | "EXPIRED";
    let startsAt: Date;
    let endsAt: Date;
    let signedAt: Date;

    if (index === 0) {
      // First business: expiring in 7 days
      status = "EXPIRING";
      startsAt = ago30Days;
      endsAt = in7Days;
      signedAt = ago30Days;
    } else if (index === 1) {
      // Second business: expiring in 30 days
      status = "EXPIRING";
      startsAt = new Date(now.getTime() - 335 * 24 * 60 * 60 * 1000);
      endsAt = in30Days;
      signedAt = new Date(now.getTime() - 335 * 24 * 60 * 60 * 1000);
    } else if (index === 2) {
      // Third business: expired 7 days ago
      status = "EXPIRED";
      startsAt = new Date(now.getTime() - 397 * 24 * 60 * 60 * 1000);
      endsAt = ago7Days;
      signedAt = new Date(now.getTime() - 397 * 24 * 60 * 60 * 1000);
    } else {
      // Rest: active contracts
      status = "ACTIVE";
      startsAt = ago30Days;
      endsAt = in365Days;
      signedAt = ago30Days;
    }

    await prisma.businessContract.create({
      data: {
        businessId: business.id,
        contractNumber,
        type: "MASTER",
        status,
        signedAt,
        startsAt,
        endsAt,
        autoRenew: index % 2 === 0, // Every other contract auto-renews
        renewalTerms: "Автоматическое продление на 12 месяцев при отсутствии уведомления об отказе за 30 дней до окончания срока действия",
        renewalPeriod: 365,
        documentUrl: `/documents/contracts/${contractNumber}.pdf`,
        notes: `Договор на оказание услуг размещения на платформе mamaGo`,
      },
    });

    contractCount++;
  }

  console.log(`✅ Created ${contractCount} contracts\n`);

  // Seed placements
  console.log("🎯 Creating placements...");
  let placementCount = 0;

  for (const [index, business] of businesses.entries()) {
    const subscription = business.billingAccount?.subscriptions[0];
    const plan = subscription?.plan || plans[0];

    let status: "ACTIVE" | "EXPIRING" | "EXPIRED";
    let startsAt: Date;
    let endsAt: Date;
    let graceUntil: Date | null = null;

    if (index === 0) {
      // First business: expiring in 7 days
      status = "EXPIRING";
      startsAt = ago30Days;
      endsAt = in7Days;
      graceUntil = new Date(in7Days.getTime() + 14 * 24 * 60 * 60 * 1000);
    } else if (index === 1) {
      // Second business: expiring in 30 days
      status = "EXPIRING";
      startsAt = new Date(now.getTime() - 335 * 24 * 60 * 60 * 1000);
      endsAt = in30Days;
      graceUntil = new Date(in30Days.getTime() + 14 * 24 * 60 * 60 * 1000);
    } else if (index === 2) {
      // Third business: expired
      status = "EXPIRED";
      startsAt = new Date(now.getTime() - 397 * 24 * 60 * 60 * 1000);
      endsAt = ago7Days;
      graceUntil = now; // Grace period also expired
    } else {
      // Rest: active placements
      status = "ACTIVE";
      startsAt = ago30Days;
      endsAt = in90Days;
      graceUntil = new Date(in90Days.getTime() + 14 * 24 * 60 * 60 * 1000);
    }

    await prisma.businessPlacement.create({
      data: {
        businessId: business.id,
        sourceType: subscription ? "SUBSCRIPTION" : "MANUAL",
        status,
        planId: plan?.id,
        startsAt,
        endsAt,
        graceUntil,
        notes: subscription
          ? `Размещение по подписке ${plan?.name}`
          : "Размещение предоставлено вручную администратором",
      },
    });

    placementCount++;
  }

  console.log(`✅ Created ${placementCount} placements\n`);

  // Seed service placements
  console.log("⭐ Creating service placements...");
  let servicePlacementCount = 0;

  for (const [index, business] of businesses.entries()) {
    // Create 2-3 service placements per business
    const serviceCount = 2 + (index % 2);

    for (let i = 0; i < serviceCount; i++) {
      let entityType: "PLACE" | "EVENT" | "OFFER" | "STORY" | "PROMO";
      let status: "ACTIVE" | "EXPIRING" | "EXPIRED";
      let startsAt: Date;
      let endsAt: Date;
      let notes: string;

      if (i === 0) {
        // First service: active promo
        entityType = "PROMO";
        status = "ACTIVE";
        startsAt = ago7Days;
        endsAt = in30Days;
        notes = "Промо-размещение на главной странице";
      } else if (i === 1 && index === 0) {
        // Expiring story for first business
        entityType = "STORY";
        status = "EXPIRING";
        startsAt = new Date(now.getTime() - 23 * 24 * 60 * 60 * 1000);
        endsAt = in7Days;
        notes = "Пакет сторис (30 дней)";
      } else if (i === 1 && index === 2) {
        // Expired event for third business
        entityType = "EVENT";
        status = "EXPIRED";
        startsAt = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
        endsAt = ago7Days;
        notes = "Продвижение мероприятия";
      } else {
        // Other services: active
        entityType = i % 2 === 0 ? "PLACE" : "OFFER";
        status = "ACTIVE";
        startsAt = ago7Days;
        endsAt = in30Days;
        notes = entityType === "PLACE" ? "Продвижение места" : "Продвижение предложения";
      }

      await prisma.businessServicePlacement.create({
        data: {
          businessId: business.id,
          entityType,
          entityId: null, // Would be actual Place/Event/Offer ID in production
          status,
          startsAt,
          endsAt,
          notes,
        },
      });

      servicePlacementCount++;
    }
  }

  console.log(`✅ Created ${servicePlacementCount} service placements\n`);

  // Seed commercial notifications
  console.log("🔔 Creating commercial notifications...");
  let notificationCount = 0;

  for (const [index, business] of businesses.entries()) {
    // Get business contracts and placements
    const contracts = await prisma.businessContract.findMany({
      where: { businessId: business.id },
    });

    const placements = await prisma.businessPlacement.findMany({
      where: { businessId: business.id },
    });

    const servicePlacements = await prisma.businessServicePlacement.findMany({
      where: { businessId: business.id },
    });

    // Create notifications for expiring/expired items
    for (const contract of contracts) {
      if (contract.status === "EXPIRING") {
        await prisma.commercialNotification.create({
          data: {
            businessId: business.id,
            type: "CONTRACT_EXPIRING",
            status: "SENT",
            title: "Договор истекает",
            message: `Ваш договор ${contract.contractNumber} истекает ${contract.endsAt.toLocaleDateString("ru-RU")}. Пожалуйста, свяжитесь с нами для продления.`,
            relatedContractId: contract.id,
            scheduledFor: new Date(contract.endsAt.getTime() - 7 * 24 * 60 * 60 * 1000),
            sentAt: new Date(contract.endsAt.getTime() - 7 * 24 * 60 * 60 * 1000),
          },
        });
        notificationCount++;
      } else if (contract.status === "EXPIRED") {
        await prisma.commercialNotification.create({
          data: {
            businessId: business.id,
            type: "CONTRACT_EXPIRED",
            status: "READ",
            title: "Договор истек",
            message: `Ваш договор ${contract.contractNumber} истек ${contract.endsAt.toLocaleDateString("ru-RU")}. Для возобновления услуг необходимо заключить новый договор.`,
            relatedContractId: contract.id,
            scheduledFor: contract.endsAt,
            sentAt: contract.endsAt,
            readAt: new Date(contract.endsAt.getTime() + 2 * 60 * 60 * 1000),
          },
        });
        notificationCount++;
      }
    }

    for (const placement of placements) {
      if (placement.status === "EXPIRING") {
        await prisma.commercialNotification.create({
          data: {
            businessId: business.id,
            type: "PLACEMENT_EXPIRING",
            status: "SENT",
            title: "Размещение заканчивается",
            message: `Ваше коммерческое размещение заканчивается ${placement.endsAt.toLocaleDateString("ru-RU")}. После окончания доступ к премиум-функциям будет ограничен.`,
            relatedPlacementId: placement.id,
            scheduledFor: new Date(placement.endsAt.getTime() - 7 * 24 * 60 * 60 * 1000),
            sentAt: new Date(placement.endsAt.getTime() - 7 * 24 * 60 * 60 * 1000),
          },
        });
        notificationCount++;
      } else if (placement.status === "EXPIRED") {
        await prisma.commercialNotification.create({
          data: {
            businessId: business.id,
            type: "PLACEMENT_EXPIRED",
            status: "READ",
            title: "Размещение завершено",
            message: `Ваше коммерческое размещение завершено. Премиум-функции отключены. Для продления свяжитесь с нами.`,
            relatedPlacementId: placement.id,
            scheduledFor: placement.endsAt,
            sentAt: placement.endsAt,
            readAt: new Date(placement.endsAt.getTime() + 1 * 60 * 60 * 1000),
          },
        });
        notificationCount++;
      }
    }

    // Create notifications for some service placements
    for (const [i, servicePlacement] of servicePlacements.entries()) {
      if (i === 0 && servicePlacement.status === "EXPIRING") {
        await prisma.commercialNotification.create({
          data: {
            businessId: business.id,
            type: "SERVICE_EXPIRING",
            status: "PENDING",
            title: "Услуга заканчивается",
            message: `Ваша услуга "${servicePlacement.notes}" заканчивается ${servicePlacement.endsAt.toLocaleDateString("ru-RU")}.`,
            relatedServicePlacementId: servicePlacement.id,
            scheduledFor: new Date(servicePlacement.endsAt.getTime() - 3 * 24 * 60 * 60 * 1000),
          },
        });
        notificationCount++;
      }
    }
  }

  console.log(`✅ Created ${notificationCount} commercial notifications\n`);

  console.log("✅ Commercial Layer seeding completed!\n");
  console.log("Summary:");
  console.log(`  - ${contractCount} contracts`);
  console.log(`  - ${placementCount} placements`);
  console.log(`  - ${servicePlacementCount} service placements`);
  console.log(`  - ${notificationCount} notifications`);
}

// Run seed
seedCommercialLayer()
  .catch((error) => {
    console.error("❌ Error seeding commercial layer:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
