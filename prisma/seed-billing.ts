import { PrismaClient, BillingAccountStatus, PlanInterval, SubscriptionStatus, BillingTransactionType, BillingTransactionStatus, BillingReferenceType, PaymentMethodType } from "@prisma/client";

const prisma = new PrismaClient();

async function seedBilling() {
  console.log("🏦 Seeding billing data...");

  // 1. Create Plans
  console.log("Creating plans...");
  
  const basicPlan = await prisma.plan.upsert({
    where: { code: "business_basic" },
    update: {},
    create: {
      code: "business_basic",
      name: "Business Basic",
      description: "Базовый тариф для малого бизнеса",
      price: 29,
      currency: "BYN",
      interval: PlanInterval.MONTH,
      maxPlaces: 3,
      maxOffers: 10,
      maxEvents: 5,
      storiesPerMonth: 0,
      hasPriorityBoost: false,
      hasLeadAccess: true,
      hasAnalytics: false,
      isActive: true,
      isVisible: true,
    },
  });

  const proPlan = await prisma.plan.upsert({
    where: { code: "business_pro" },
    update: {},
    create: {
      code: "business_pro",
      name: "Business Pro",
      description: "Профессиональный тариф с расширенными возможностями",
      price: 59,
      currency: "BYN",
      interval: PlanInterval.MONTH,
      maxPlaces: 0, // unlimited
      maxOffers: 0,
      maxEvents: 0,
      storiesPerMonth: 10,
      hasPriorityBoost: true,
      hasLeadAccess: true,
      hasAnalytics: true,
      isActive: true,
      isVisible: true,
    },
  });

  const premiumPlan = await prisma.plan.upsert({
    where: { code: "business_premium" },
    update: {},
    create: {
      code: "business_premium",
      name: "Business Premium",
      description: "Премиум тариф для крупного бизнеса",
      price: 99,
      currency: "BYN",
      interval: PlanInterval.MONTH,
      maxPlaces: 0,
      maxOffers: 0,
      maxEvents: 0,
      storiesPerMonth: 30,
      hasPriorityBoost: true,
      hasLeadAccess: true,
      hasAnalytics: true,
      isActive: true,
      isVisible: true,
    },
  });

  await prisma.plan.upsert({
    where: { code: "business_pro_yearly" },
    update: {},
    create: {
      code: "business_pro_yearly",
      name: "Business Pro (Годовой)",
      description: "Годовая подписка со скидкой 20%",
      price: 566, // 59 * 12 * 0.8
      currency: "BYN",
      interval: PlanInterval.YEAR,
      maxPlaces: 0,
      maxOffers: 0,
      maxEvents: 0,
      storiesPerMonth: 10,
      hasPriorityBoost: true,
      hasLeadAccess: true,
      hasAnalytics: true,
      isActive: true,
      isVisible: true,
    },
  });

  console.log(`✅ Created ${4} plans`);

  // 2. Find test businesses (assuming they exist from main seed)
  const businesses = await prisma.business.findMany({
    take: 5,
    include: { owner: true },
  });

  if (businesses.length === 0) {
    console.log("⚠️  No businesses found. Skipping billing account creation.");
    return;
  }

  console.log(`Found ${businesses.length} businesses for billing setup`);

  // 3. Create Billing Accounts and Subscriptions
  for (let i = 0; i < businesses.length; i++) {
    const business = businesses[i];
    
    // Determine plan and status based on index for variety
    let selectedPlan;
    let accountStatus: BillingAccountStatus;
    let subscriptionStatus: SubscriptionStatus;
    let depositBalance: number;

    if (i === 0) {
      // Active Pro subscription, good balance
      selectedPlan = proPlan;
      accountStatus = BillingAccountStatus.ACTIVE;
      subscriptionStatus = SubscriptionStatus.ACTIVE;
      depositBalance = 150.50;
    } else if (i === 1) {
      // Active Basic, low balance
      selectedPlan = basicPlan;
      accountStatus = BillingAccountStatus.ACTIVE;
      subscriptionStatus = SubscriptionStatus.ACTIVE;
      depositBalance = 15.20;
    } else if (i === 2) {
      // Past due subscription, suspended account
      selectedPlan = proPlan;
      accountStatus = BillingAccountStatus.SUSPENDED;
      subscriptionStatus = SubscriptionStatus.PAST_DUE;
      depositBalance = 5.00;
    } else if (i === 3) {
      // Premium, high balance
      selectedPlan = premiumPlan;
      accountStatus = BillingAccountStatus.ACTIVE;
      subscriptionStatus = SubscriptionStatus.ACTIVE;
      depositBalance = 320.75;
    } else {
      // Canceled subscription
      selectedPlan = basicPlan;
      accountStatus = BillingAccountStatus.ACTIVE;
      subscriptionStatus = SubscriptionStatus.CANCELED;
      depositBalance = 45.00;
    }

    // Create Billing Account
    const billingAccount = await prisma.billingAccount.upsert({
      where: { businessId: business.id },
      update: {
        status: accountStatus,
        depositBalance,
      },
      create: {
        businessId: business.id,
        status: accountStatus,
        depositBalance,
        currency: "BYN",
        lowBalanceThreshold: 20,
        creditLimit: 0,
        suspendedAt: accountStatus === BillingAccountStatus.SUSPENDED ? new Date("2026-03-10") : null,
        suspendedReason: accountStatus === BillingAccountStatus.SUSPENDED ? "Payment failed" : null,
      },
    });

    // Create Payment Method
    const paymentMethod = await prisma.paymentMethod.create({
      data: {
        billingAccountId: billingAccount.id,
        type: PaymentMethodType.CARD,
        cardBrand: i % 2 === 0 ? "Visa" : "Mastercard",
        cardLast4: `${1000 + i * 111}`.slice(-4),
        cardExpiryMonth: 12,
        cardExpiryYear: 2027,
        isDefault: true,
        isActive: true,
      },
    });

    // Create Subscription
    const now = new Date();
    const periodStart = new Date(now);
    periodStart.setDate(15); // 15th of current month
    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const subscription = await prisma.subscription.create({
      data: {
        billingAccountId: billingAccount.id,
        planId: selectedPlan.id,
        status: subscriptionStatus,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        autoRenew: subscriptionStatus !== SubscriptionStatus.CANCELED,
        cancelAtPeriodEnd: subscriptionStatus === SubscriptionStatus.CANCELED,
        canceledAt: subscriptionStatus === SubscriptionStatus.CANCELED ? new Date("2026-03-01") : null,
        cancelReason: subscriptionStatus === SubscriptionStatus.CANCELED ? "Customer request" : null,
      },
    });

    // Create Transactions
    interface TransactionData {
      billingAccountId: string;
      type: BillingTransactionType;
      status: BillingTransactionStatus;
      amount: number;
      currency: string;
      description: string;
      occurredAt: Date;
      referenceType: BillingReferenceType;
      referenceId?: string;
      subscriptionId?: string;
      paymentMethodId?: string;
      failureReason?: string | undefined;
    }
    
    const transactions: TransactionData[] = [];

    // Initial subscription charge (2 months ago)
    const initialDate = new Date();
    initialDate.setMonth(initialDate.getMonth() - 2);
    transactions.push({
      billingAccountId: billingAccount.id,
      type: BillingTransactionType.SUBSCRIPTION_CHARGE,
      status: BillingTransactionStatus.SUCCEEDED,
      amount: -selectedPlan.price.toNumber(),
      currency: "BYN",
      description: `Активация тарифа ${selectedPlan.name}`,
      occurredAt: initialDate,
      referenceType: BillingReferenceType.SUBSCRIPTION,
      referenceId: subscription.id,
      subscriptionId: subscription.id,
      paymentMethodId: paymentMethod.id,
    });

    // Monthly renewal (1 month ago)
    const renewalDate = new Date();
    renewalDate.setMonth(renewalDate.getMonth() - 1);
    transactions.push({
      billingAccountId: billingAccount.id,
      type: BillingTransactionType.SUBSCRIPTION_RENEWAL,
      status: subscriptionStatus === SubscriptionStatus.PAST_DUE ? BillingTransactionStatus.FAILED : BillingTransactionStatus.SUCCEEDED,
      amount: -selectedPlan.price.toNumber(),
      currency: "BYN",
      description: `Продление тарифа ${selectedPlan.name}`,
      occurredAt: renewalDate,
      referenceType: BillingReferenceType.SUBSCRIPTION,
      referenceId: subscription.id,
      subscriptionId: subscription.id,
      paymentMethodId: paymentMethod.id,
      failureReason: subscriptionStatus === SubscriptionStatus.PAST_DUE ? "Insufficient funds" : undefined,
    });

    // Deposit topups
    if (i !== 2) { // Skip for suspended account
      const topupDate1 = new Date();
      topupDate1.setDate(topupDate1.getDate() - 45);
      transactions.push({
        billingAccountId: billingAccount.id,
        type: BillingTransactionType.DEPOSIT_TOPUP,
        status: BillingTransactionStatus.SUCCEEDED,
        amount: 100,
        currency: "BYN",
        description: "Пополнение депозита",
        occurredAt: topupDate1,
        referenceType: BillingReferenceType.NONE,
        paymentMethodId: paymentMethod.id,
      });

      if (i === 3) { // Extra topup for premium
        const topupDate2 = new Date();
        topupDate2.setDate(topupDate2.getDate() - 20);
        transactions.push({
          billingAccountId: billingAccount.id,
          type: BillingTransactionType.DEPOSIT_TOPUP,
          status: BillingTransactionStatus.SUCCEEDED,
          amount: 250,
          currency: "BYN",
          description: "Пополнение депозита",
          occurredAt: topupDate2,
          referenceType: BillingReferenceType.NONE,
          paymentMethodId: paymentMethod.id,
        });
      }
    }

    // Lead charges (various dates)
    const leadCharges = [
      { days: 5, amount: 4.50, desc: "Списание за лид: Детский центр" },
      { days: 12, amount: 3.80, desc: "Списание за лид: Спортивная секция" },
      { days: 18, amount: 4.20, desc: "Списание за лид: Творческая студия" },
      { days: 25, amount: 3.50, desc: "Списание за лид: Языковая школа" },
    ];

    for (const charge of leadCharges) {
      const chargeDate = new Date();
      chargeDate.setDate(chargeDate.getDate() - charge.days);
      transactions.push({
        billingAccountId: billingAccount.id,
        type: BillingTransactionType.LEAD_CHARGE,
        status: BillingTransactionStatus.SUCCEEDED,
        amount: -charge.amount,
        currency: "BYN",
        description: charge.desc,
        occurredAt: chargeDate,
        referenceType: BillingReferenceType.LEAD,
      });
    }

    // Promotion charges
    if (i !== 4) { // Skip for canceled subscription
      const promoCharges = [
        { days: 8, amount: 12, desc: "Продвижение предложения: Скидка 20%" },
        { days: 22, amount: 8, desc: "Продвижение события: День открытых дверей" },
      ];

      for (const charge of promoCharges) {
        const chargeDate = new Date();
        chargeDate.setDate(chargeDate.getDate() - charge.days);
        transactions.push({
          billingAccountId: billingAccount.id,
          type: BillingTransactionType.PROMOTION_CHARGE,
          status: BillingTransactionStatus.SUCCEEDED,
          amount: -charge.amount,
          currency: "BYN",
          description: charge.desc,
          occurredAt: chargeDate,
          referenceType: BillingReferenceType.PROMOTION,
        });
      }
    }

    // Refund example (for first business)
    if (i === 0) {
      const refundDate = new Date();
      refundDate.setDate(refundDate.getDate() - 15);
      transactions.push({
        billingAccountId: billingAccount.id,
        type: BillingTransactionType.REFUND,
        status: BillingTransactionStatus.SUCCEEDED,
        amount: 5,
        currency: "BYN",
        description: "Возврат за отмененное продвижение",
        occurredAt: refundDate,
        referenceType: BillingReferenceType.MANUAL,
      });
    }

    // Bonus credit (for premium)
    if (i === 3) {
      const bonusDate = new Date();
      bonusDate.setDate(bonusDate.getDate() - 30);
      transactions.push({
        billingAccountId: billingAccount.id,
        type: BillingTransactionType.BONUS_CREDIT,
        status: BillingTransactionStatus.SUCCEEDED,
        amount: 20,
        currency: "BYN",
        description: "Бонус за годовую подписку",
        occurredAt: bonusDate,
        referenceType: BillingReferenceType.MANUAL,
      });
    }

    // Create all transactions
    for (const txData of transactions) {
      await prisma.billingTransaction.create({ data: txData });
    }

    console.log(`✅ Created billing for business ${i + 1}: ${business.name} (${transactions.length} transactions)`);
  }

  console.log("🎉 Billing seed completed!");
}

async function main() {
  try {
    await seedBilling();
  } catch (error) {
    console.error("Error seeding billing:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
