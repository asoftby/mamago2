/**
 * LOCAL ONLY: synthetic Direct (user ↔ business) conversations for visual review
 * of «Мои сообщения», business «Сообщения» and admin «Коммуникации → Прямые
 * сообщения → Диалоги».
 *
 *   pnpm exec tsx scripts/dev/seed-direct-demo.ts            # seed / re-seed
 *   pnpm exec tsx scripts/dev/seed-direct-demo.ts --cleanup  # remove only demo data
 *
 * Safety:
 * - refuses to run unless DATABASE_URL points at localhost/127.0.0.1 and the
 *   database name contains "local" (never DEV/PROD);
 * - writes rows directly through Prisma: no notifications, emails, Telegram,
 *   bookings or payments are created;
 * - every row it owns is identifiable: users by the `@direct-demo.mamago.invalid`
 *   email domain, everything else by the `ddemo_` id prefix. Cleanup deletes
 *   only those rows (plus their cascades).
 *
 * Login password for all demo accounts: env DIRECT_DEMO_PASSWORD, or a random
 * one generated on first run and stored in the git-ignored `.env.direct-demo`
 * file in the repo root (never printed).
 */

import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import {
  ActivityType,
  BusinessMemberRole,
  DirectActorType,
  DirectThreadStatus,
  OfferKind,
  PrismaClient,
  PublicationType,
  ScheduleMode,
} from "@prisma/client";

const prisma = new PrismaClient();

const EMAIL_DOMAIN = "direct-demo.mamago.invalid";
const ID = (s: string) => `ddemo_${s}`;
const CREDENTIALS_FILE = path.resolve(process.cwd(), ".env.direct-demo");

// ─── Safety ──────────────────────────────────────────────────────────────────

function assertLocalDatabase() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set");
  const url = new URL(raw);
  const host = url.hostname;
  const db = url.pathname.replace(/^\//, "");
  if (!["localhost", "127.0.0.1", "::1"].includes(host) || !db.includes("local")) {
    throw new Error(`Refusing to run: DATABASE_URL must be a local test DB (got host=${host} db=${db})`);
  }
  if (process.env.NODE_ENV === "production" || process.env.APP_ENV === "production") {
    throw new Error("Refusing to run with production NODE_ENV/APP_ENV");
  }
  console.log(`[direct-demo] target DB: ${host}/${db}`);
}

function resolvePassword(): string {
  if (process.env.DIRECT_DEMO_PASSWORD) return process.env.DIRECT_DEMO_PASSWORD;
  if (existsSync(CREDENTIALS_FILE)) {
    const m = readFileSync(CREDENTIALS_FILE, "utf8").match(/^DIRECT_DEMO_PASSWORD=(.+)$/m);
    if (m) return m[1].trim();
  }
  const generated = `demo-${randomBytes(9).toString("base64url")}`;
  writeFileSync(
    CREDENTIALS_FILE,
    `# Local-only password for *@${EMAIL_DOMAIN} demo accounts (scripts/dev/seed-direct-demo.ts)\nDIRECT_DEMO_PASSWORD=${generated}\n`,
    { mode: 0o600 },
  );
  console.log(`[direct-demo] generated password stored in ${CREDENTIALS_FILE}`);
  return generated;
}

// ─── Fixture data (all fictional) ────────────────────────────────────────────

const PARENTS = [
  ["anna", "Анна Ковалёва"],
  ["olga", "Ольга Миронова"],
  ["maria", "Мария Савицкая"],
  ["katya", "Екатерина Воронцова"],
  ["dmitry", "Дмитрий Петрович"],
  ["irina", "Ирина Лапко"],
  ["natalia", "Наталья Гордеева"],
  ["alexey", "Алексей Буйницкий"],
  ["yulia", "Юлия Тарасевич"],
  ["svetlana", "Светлана Рудак"],
  // No conversations — used to check the empty state.
  ["tatiana", "Татьяна Новик"],
] as const;
type ParentKey = (typeof PARENTS)[number][0];

type PubSpec = { key: string; type: "PLACE" | "OFFER" | "EVENT"; title: string };
const BUSINESSES: { key: string; name: string; owner: string; place: string; pubs: PubSpec[] }[] = [
  {
    key: "krug", name: "Детский центр «Солнечный круг»", owner: "Виктория Солнцева", place: "Солнечный круг",
    pubs: [
      { key: "krug_eng", type: "OFFER", title: "Английский для малышей 4–6 лет" },
      { key: "krug_dev", type: "OFFER", title: "Развивающие занятия «Умняшки»" },
    ],
  },
  {
    key: "jump", name: "Батутный парк «Прыг-Скок»", owner: "Игорь Скоков", place: "Прыг-Скок",
    pubs: [
      { key: "jump_bday", type: "OFFER", title: "День рождения в батутном парке" },
      { key: "jump_free", type: "OFFER", title: "Свободные прыжки, 1 час" },
    ],
  },
  {
    key: "akva", name: "Студия рисования «Акварелька»", owner: "Елена Краснова", place: "Акварелька",
    pubs: [
      { key: "akva_mk", type: "EVENT", title: "Мастер-класс «Зимний лес» гуашью" },
      { key: "akva_course", type: "OFFER", title: "Курс рисования для детей 7–10 лет" },
    ],
  },
  {
    key: "teatr", name: "Театр кукол «Сказочный дом»", owner: "Павел Сказкин", place: "Сказочный дом",
    pubs: [
      { key: "teatr_show", type: "EVENT", title: "Спектакль «Три медведя»" },
      { key: "teatr_ny", type: "EVENT", title: "Новогоднее представление у ёлки" },
    ],
  },
  {
    key: "delf", name: "Бассейн «Дельфинёнок»", owner: "Марина Волнова", place: "Дельфинёнок",
    pubs: [{ key: "delf_swim", type: "OFFER", title: "Обучение плаванию 5–8 лет" }],
  },
  {
    key: "kluch", name: "Квест-студия «Ключ»", owner: "Артём Замков", place: "Квест-студия «Ключ»",
    pubs: [
      { key: "kluch_quest", type: "OFFER", title: "Детский квест «Пиратский клад»" },
      { key: "kluch_bday", type: "OFFER", title: "Квест на день рождения" },
    ],
  },
];

type Msg = ["C" | "B", number /* minutes after previous */, string];
type ThreadSpec = {
  key: string;
  parent: ParentKey;
  pub: string; // pub key or `${business}_place`
  daysAgo: number; // when the first message was sent
  status?: "OPEN" | "CLOSED" | "ARCHIVED";
  /** true → the trailing message(s) are still unread by the other side. */
  unread?: boolean;
  msgs: Msg[];
};

const H = 60;
const D = 24 * H;

const THREADS: ThreadSpec[] = [
  // ── Анна: 3 организации ───────────────────────────────────────────────────
  {
    key: "t01", parent: "anna", pub: "krug_eng", daysAgo: 12, msgs: [
      ["C", 0, "Здравствуйте! Сыну 5 лет, английский никогда не учил. Подойдёт ли ему ваша группа?"],
      ["B", 40, "Добрый день, Анна! Да, группа 4–6 лет как раз для начинающих. Занятия в игровой форме, 45 минут."],
      ["C", 15, "А сколько детей в группе и можно ли прийти на пробное?"],
      ["B", 25, "До 6 детей. Пробное занятие бесплатное — ближайшее в субботу в 11:00."],
      ["C", 10, "Отлично, тогда запишите нас на субботу, пожалуйста."],
      ["B", 30, "Записали! Возьмите сменную обувь. До встречи 🙂"],
    ],
  },
  {
    key: "t02", parent: "anna", pub: "jump_bday", daysAgo: 2, unread: true, msgs: [
      ["C", 0, "Добрый вечер! Хотим отметить день рождения дочки 14 декабря, будет 8 детей 6–7 лет. Есть свободное время?"],
      ["B", 3 * H, "Здравствуйте! На 14 декабря свободно 12:00 и 16:00. В пакет входят 1,5 часа прыжков, аниматор и комната для чаепития."],
      ["C", 20, "Давайте 12:00. Можно принести свой торт?"],
      ["B", 18 * H, "Да, свой торт можно, свечи и тарелки дадим. Подтвердите, пожалуйста, точное количество детей за 3 дня."],
    ],
  },
  {
    key: "t03", parent: "anna", pub: "teatr_show", daysAgo: 25, status: "CLOSED", msgs: [
      ["C", 0, "Подскажите, со скольки лет спектакль «Три медведя»? Младшему 2,5 года."],
      ["B", 2 * H, "Спектакль рассчитан на детей от 3 лет, но малыши с родителями тоже приходят — он идёт 40 минут без антракта."],
      ["C", 5, "Спасибо, придём!"],
    ],
  },
  // ── Ольга: 2 организации ──────────────────────────────────────────────────
  {
    key: "t04", parent: "olga", pub: "krug_dev", daysAgo: 6, msgs: [
      ["C", 0, "Здравствуйте, дочке 3 года. Есть ли у вас занятия для такого возраста?"],
      ["B", 50, "Здравствуйте, Ольга! «Умняшки» — с 3 лет, вторник и четверг в 10:00. Сейчас есть одно свободное место."],
      ["C", 12, "Какая стоимость абонемента?"],
      ["B", 35, "Абонемент на 8 занятий — 160 BYN, разовое — 25 BYN."],
    ],
  },
  {
    key: "t05", parent: "olga", pub: "delf_swim", daysAgo: 1, unread: true, msgs: [
      ["C", 0, "Добрый день! Сыну 6 лет, боится воды. Ваши тренеры работают с такими детьми?"],
    ],
  },
  // ── Мария ─────────────────────────────────────────────────────────────────
  {
    key: "t06", parent: "maria", pub: "akva_mk", daysAgo: 4, msgs: [
      ["C", 0, "Здравствуйте! На мастер-класс «Зимний лес» нужно что-то приносить?"],
      ["B", 15, "Добрый день! Всё необходимое даём: гуашь, кисти, бумагу. Рекомендуем одежду, которую не жалко испачкать 🙂"],
      ["C", 8, "Можно ли прийти вдвоём с подругой дочки?"],
      ["B", 20, "Конечно, только напишите имена обеих девочек, чтобы мы подготовили места."],
      ["C", 4, "Соня и Вероника, обеим по 8 лет."],
      ["B", 10, "Записали обеих, ждём в воскресенье в 12:00."],
      ["C", 2, "Спасибо!"],
    ],
  },
  {
    key: "t07", parent: "maria", pub: "kluch_bday", daysAgo: 0.2, unread: true, msgs: [
      ["C", 0, "Здравствуйте! Интересует квест на день рождения для 10 детей 9–10 лет. Какие сценарии есть и сколько это стоит?"],
      ["C", 25, "И ещё вопрос — можно ли после квеста остаться на пиццу в вашем помещении?"],
    ],
  },
  // ── Екатерина: 3 организации, длинная переписка ───────────────────────────
  {
    key: "t08", parent: "katya", pub: "jump_bday", daysAgo: 9, msgs: [
      ["C", 0, "Добрый день! Планируем праздник на 7 декабря, 12 детей 5–8 лет. Подскажите, пожалуйста, условия."],
      ["B", 45, "Здравствуйте, Екатерина! На 12 детей подойдёт пакет «Большой»: 2 часа, аниматор, отдельная комната. Стоимость 480 BYN."],
      ["C", 30, "А аниматор работает всё время или только часть?"],
      ["B", 20, "Первый час — игры на батутах с аниматором, затем 30 минут шоу мыльных пузырей и чаепитие."],
      ["C", 2 * H, "Есть ли ограничения для детей с аллергией? У одного мальчика аллергия на орехи."],
      ["B", 30, "Еду мы не готовим — угощение приносите сами, поэтому сможете всё проконтролировать. Аниматора предупредим."],
      ["C", 1 * D, "Хорошо. Нужна ли предоплата?"],
      ["B", 40, "Да, 30% для брони даты. Реквизиты отправим после подтверждения заявки."],
      ["C", 15, "Понятно, давайте бронировать на 7 декабря, 14:00."],
      ["B", 25, "Отлично! Дата за вами. Носки с нескользящей подошвой обязательны для всех детей."],
      ["C", 6, "Спасибо, учтём!"],
      ["B", 3 * D, "Екатерина, напоминаем о празднике 7 декабря в 14:00. Если количество гостей изменится — напишите нам."],
      ["C", 2 * H, "Будет на одного ребёнка больше, 13. Это не проблема?"],
      ["B", 20, "Не проблема, доплата 35 BYN за ребёнка. Ждём вас!"],
    ],
  },
  {
    key: "t09", parent: "katya", pub: "akva_course", daysAgo: 30, status: "ARCHIVED", msgs: [
      ["C", 0, "Здравствуйте, набор на курс ещё открыт?"],
      ["B", 3 * H, "Добрый день! Набор этого потока закрыт, следующий стартует в январе."],
      ["C", 10, "Хорошо, спасибо."],
    ],
  },
  {
    key: "t10", parent: "katya", pub: "teatr_ny", daysAgo: 3, unread: true, msgs: [
      ["C", 0, "Здравствуйте! На новогоднее представление 28 декабря ещё есть места?"],
      ["B", 1 * H, "Здравствуйте! На 28 декабря остались места на 11:00 и 15:00. Подарки для детей входят в стоимость."],
      ["C", 30, "А можно взять 3 детских и 2 взрослых?"],
      ["B", 20 * H, "Да, на 11:00 можем оставить 5 мест рядом. Подтвердите, пожалуйста, до пятницы."],
    ],
  },
  // ── Дмитрий ───────────────────────────────────────────────────────────────
  {
    key: "t11", parent: "dmitry", pub: "kluch_quest", daysAgo: 15, status: "CLOSED", msgs: [
      ["C", 0, "Добрый день! Квест «Пиратский клад» подойдёт для 7-летних?"],
      ["B", 25, "Здравствуйте! Да, сценарий рассчитан на 6–9 лет, длительность 60 минут."],
      ["C", 10, "А сколько человек максимум?"],
      ["B", 15, "До 8 участников в одной команде."],
      ["C", 5, "Записываемся на воскресенье 16:00 на 6 детей."],
      ["B", 10, "Готово, ждём вас!"],
      ["C", 3 * D, "Спасибо за квест, дети в восторге!"],
      ["B", 30, "Очень рады! Будем ждать снова 🙂"],
    ],
  },
  {
    key: "t12", parent: "dmitry", pub: "delf_swim", daysAgo: 5, msgs: [
      ["C", 0, "Здравствуйте! Есть ли групповые занятия по субботам?"],
      ["B", 2 * H, "Добрый день! По субботам группы в 9:00 и 10:00, дети 5–8 лет."],
      ["C", 15, "Нужна ли медицинская справка?"],
      ["B", 25, "Да, справка от педиатра и дерматолога, действительна 3 месяца."],
    ],
  },
  // ── Ирина ─────────────────────────────────────────────────────────────────
  {
    key: "t13", parent: "irina", pub: "krug_eng", daysAgo: 7, msgs: [
      ["C", 0, "Здравствуйте! Можно ли перенести пропущенное занятие на другой день?"],
      ["B", 1 * H, "Здравствуйте, Ирина! Да, отработка возможна в течение месяца в группе того же уровня."],
      ["C", 10, "Тогда хотим в среду в 17:00."],
      ["B", 20, "Записали на среду 17:00."],
    ],
  },
  {
    key: "t14", parent: "irina", pub: "akva_mk", daysAgo: 0.5, unread: true, msgs: [
      ["C", 0, "Добрый день, а мастер-класс будет повторяться в декабре? В это воскресенье мы не можем."],
      ["B", 30, "Здравствуйте! Да, повторим 21 декабря в 12:00. Записать вас?"],
    ],
  },
  // ── Наталья ───────────────────────────────────────────────────────────────
  {
    key: "t15", parent: "natalia", pub: "jump_free", daysAgo: 11, msgs: [
      ["C", 0, "Здравствуйте! Нужна ли предварительная запись на свободные прыжки в выходные?"],
      ["B", 35, "Добрый день! В выходные рекомендуем записаться заранее — бывает много посетителей."],
      ["C", 5, "А для детей до 3 лет есть отдельная зона?"],
      ["B", 20, "Да, есть малышовая зона с мягкими модулями, вход вместе с родителем."],
    ],
  },
  {
    key: "t16", parent: "natalia", pub: "teatr_show", daysAgo: 0.05, unread: true, msgs: [
      ["C", 0, "Здравствуйте! Есть ли места для коляски в зале? Пойдём с младшим."],
    ],
  },
  // ── Алексей ───────────────────────────────────────────────────────────────
  {
    key: "t17", parent: "alexey", pub: "kluch_bday", daysAgo: 8, msgs: [
      ["C", 0, "Добрый день! Хотим квест на день рождения сына 21 декабря, 8 детей 10–11 лет."],
      ["B", 40, "Здравствуйте, Алексей! На этот возраст подойдёт «Тайна старого маяка» — посложнее, 75 минут."],
      ["C", 25, "Звучит отлично. Есть ли комната для чаепития после?"],
      ["B", 15, "Да, комната на 45 минут входит в пакет."],
      ["C", 1 * D, "Бронируем 21 декабря на 13:00."],
      ["B", 50, "Забронировали. За день до праздника напомним в сообщениях."],
    ],
  },
  {
    key: "t18", parent: "alexey", pub: "krug_place", daysAgo: 20, status: "CLOSED", msgs: [
      ["C", 0, "Подскажите, у вас есть парковка возле центра?"],
      ["B", 2 * H, "Здравствуйте! Есть бесплатная парковка во дворе, въезд со стороны улицы."],
    ],
  },
  // ── Юлия ──────────────────────────────────────────────────────────────────
  {
    key: "t19", parent: "yulia", pub: "delf_swim", daysAgo: 3, unread: true, msgs: [
      ["C", 0, "Здравствуйте! Есть ли индивидуальные занятия для ребёнка 5 лет?"],
      ["B", 4 * H, "Добрый день! Да, индивидуальные — с понедельника по пятницу, 30 минут, 45 BYN."],
      ["C", 1 * H, "А можно присутствовать родителю на бортике?"],
      ["C", 2, "И нужна ли шапочка или выдаёте?"],
    ],
  },
  {
    key: "t20", parent: "yulia", pub: "akva_course", daysAgo: 14, msgs: [
      ["C", 0, "Здравствуйте! Сколько длится курс рисования?"],
      ["B", 1 * H, "Курс — 3 месяца, занятия 2 раза в неделю по 90 минут."],
      ["C", 10, "Спасибо, подумаем."],
    ],
  },
  // ── Светлана ──────────────────────────────────────────────────────────────
  {
    key: "t21", parent: "svetlana", pub: "teatr_ny", daysAgo: 1.5, msgs: [
      ["C", 0, "Добрый вечер! Будет ли на новогоднем представлении Дед Мороз для фото?"],
      ["B", 45, "Здравствуйте! Да, после представления 20 минут фотосессия с Дедом Морозом и Снегурочкой."],
      ["C", 5, "Замечательно, спасибо!"],
    ],
  },
  {
    key: "t22", parent: "svetlana", pub: "jump_bday", daysAgo: 18, msgs: [
      ["C", 0, "Здравствуйте! Можно ли провести день рождения в будний день вечером?"],
      ["B", 30, "Добрый день! Да, в будни работаем до 21:00, пакет «Будний» дешевле на 15%."],
      ["C", 1 * H, "Отлично, будем думать над датой."],
    ],
  },
  {
    key: "t23", parent: "svetlana", pub: "jump_free", daysAgo: 0.8, unread: true, msgs: [
      ["C", 0, "Добрый день! Принимаете ли вы оплату картой на месте?"],
      ["B", 15, "Здравствуйте! Да, картой и наличными."],
      ["C", 3, "А есть скидка для многодетных?"],
    ],
  },
];

// ─── Seed ────────────────────────────────────────────────────────────────────

async function seed() {
  const password = resolvePassword();
  const passwordHash = await bcrypt.hash(password, 10);
  const emailVerifiedAt = new Date();

  // Users
  const userId = (k: string) => ID(`user_${k}`);
  const upsertUser = (key: string, displayName: string, role: "USER" | "BUSINESS_OWNER" | "ADMIN") =>
    prisma.user.upsert({
      where: { id: userId(key) },
      create: { id: userId(key), email: `${key}@${EMAIL_DOMAIN}`, displayName, passwordHash, role, emailVerifiedAt },
      update: { email: `${key}@${EMAIL_DOMAIN}`, displayName, passwordHash, role, deletedAt: null, status: "ACTIVE" },
    });

  for (const [key, name] of PARENTS) await upsertUser(key, name, "USER");
  await upsertUser("admin", "Админ демо-диалогов", "ADMIN");

  // Businesses, owners, places, publications
  const pubIds = new Map<string, { type: PublicationType; id: string; businessId: string }>();
  for (const b of BUSINESSES) {
    const ownerKey = `biz-${b.key}`;
    const owner = await upsertUser(ownerKey, b.owner, "BUSINESS_OWNER");
    const businessId = ID(`biz_${b.key}`);
    const approved = { status: "APPROVED" as const, verificationStatus: "APPROVED" as const, operationalStatus: "ACTIVE" as const };
    await prisma.business.upsert({
      where: { id: businessId },
      create: { id: businessId, name: b.name, ownerUserId: owner.id, ...approved },
      update: { name: b.name, ownerUserId: owner.id, ...approved },
    });
    await prisma.businessMember.upsert({
      where: { id: ID(`member_${b.key}`) },
      create: { id: ID(`member_${b.key}`), businessId, userId: owner.id, role: BusinessMemberRole.OWNER, isActive: true },
      update: { businessId, userId: owner.id, role: BusinessMemberRole.OWNER, isActive: true },
    });

    // Place stays DRAFT — never visible on public surfaces.
    const placeId = ID(`place_${b.key}`);
    await prisma.place.upsert({
      where: { id: placeId },
      create: { id: placeId, title: b.place, shortDesc: "Демо-площадка для локальной проверки сообщений", createdByUserId: owner.id },
      update: { title: b.place },
    });
    pubIds.set(`${b.key}_place`, { type: PublicationType.PLACE, id: placeId, businessId });

    for (const p of b.pubs) {
      const id = ID(`pub_${p.key}`);
      if (p.type === "EVENT") {
        await prisma.activity.upsert({
          where: { id },
          create: {
            id, title: p.title, shortDesc: "Демо-событие", type: ActivityType.EVENT,
            scheduleMode: ScheduleMode.ON_DEMAND, ownerUserId: owner.id, businessId, placeId,
          },
          update: { title: p.title },
        });
        pubIds.set(p.key, { type: PublicationType.EVENT, id, businessId });
      } else {
        await prisma.offer.upsert({
          where: { id },
          create: { id, title: p.title, kind: OfferKind.SERVICE, placeId },
          update: { title: p.title },
        });
        pubIds.set(p.key, { type: PublicationType.OFFER, id, businessId });
      }
    }
  }

  // Threads + messages (messages fully recreated on each run)
  const now = Date.now();
  let messageCount = 0;
  for (const t of THREADS) {
    const pub = pubIds.get(t.pub);
    if (!pub) throw new Error(`Unknown publication ${t.pub}`);
    const threadId = ID(`thread_${t.key}`);
    const start = now - t.daysAgo * D * 60_000;

    // Timeline
    let cursor = start;
    const timeline = t.msgs.map(([who, after, body]) => {
      cursor += after * 60_000;
      return { who, at: new Date(Math.min(cursor, now - 60_000)), body };
    });
    const last = timeline[timeline.length - 1];
    const lastSide = last.who;

    const status = DirectThreadStatus[t.status ?? "OPEN"];
    const thread = {
      publicationType: pub.type,
      offerId: pub.type === PublicationType.OFFER ? pub.id : null,
      activityId: pub.type === PublicationType.EVENT ? pub.id : null,
      placeId: pub.type === PublicationType.PLACE ? pub.id : null,
      businessId: pub.businessId,
      customerUserId: userId(t.parent),
      status,
      lastMessageAt: last.at,
      lastMessageBy: lastSide === "C" ? DirectActorType.CUSTOMER : DirectActorType.BUSINESS,
      completedAt: status === DirectThreadStatus.CLOSED ? new Date(last.at.getTime() + D * 60_000) : null,
      createdAt: timeline[0].at,
    };
    await prisma.directThread.upsert({ where: { id: threadId }, create: { id: threadId, ...thread }, update: thread });
    await prisma.directMessage.deleteMany({ where: { threadId } });

    const businessOwnerId = userId(`biz-${BUSINESSES.find((b) => pub.businessId === ID(`biz_${b.key}`))!.key}`);
    await prisma.directMessage.createMany({
      data: timeline.map((m, i) => {
        // A message is read once the other side answered after it; trailing
        // messages of the last speaker stay unread only for `unread` threads.
        const replyByOther = timeline.slice(i + 1).find((n) => n.who !== m.who);
        const readAt = replyByOther
          ? new Date(replyByOther.at.getTime() - 60_000)
          : t.unread
            ? null
            : new Date(Math.min(m.at.getTime() + 30 * 60_000, now - 30_000));
        return {
          id: ID(`msg_${t.key}_${String(i + 1).padStart(2, "0")}`),
          threadId,
          senderType: m.who === "C" ? DirectActorType.CUSTOMER : DirectActorType.BUSINESS,
          senderUserId: m.who === "C" ? userId(t.parent) : businessOwnerId,
          body: m.body,
          createdAt: m.at,
          readAt,
        };
      }),
    });
    messageCount += timeline.length;
  }

  console.log(
    `[direct-demo] seeded: ${PARENTS.length} parents (1 without dialogs), ${BUSINESSES.length} businesses, ` +
      `${THREADS.length} threads, ${messageCount} messages, 1 admin`,
  );
  console.log(`[direct-demo] accounts: <key>@${EMAIL_DOMAIN} — e.g. katya@, biz-jump@, admin@ (password: see .env.direct-demo)`);
}

// ─── Cleanup (demo rows only) ────────────────────────────────────────────────

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { endsWith: `@${EMAIL_DOMAIN}` } }, select: { id: true } });
  const userIds = users.map((u) => u.id);
  const businessIds = (await prisma.business.findMany({ where: { id: { startsWith: "ddemo_" } }, select: { id: true } })).map((b) => b.id);

  // Threads: by demo business OR demo customer (covers threads created during manual E2E checks).
  const threadWhere = { OR: [{ businessId: { in: businessIds } }, { customerUserId: { in: userIds } }] };
  const threadIds = (await prisma.directThread.findMany({ where: threadWhere, select: { id: true } })).map((t) => t.id);
  const messageIds = (await prisma.directMessage.findMany({ where: { threadId: { in: threadIds } }, select: { id: true } })).map((m) => m.id);
  const [riskSignals, complaints, messages, threads] = await prisma.$transaction([
    prisma.directRiskSignal.deleteMany({ where: { threadId: { in: threadIds } } }),
    prisma.directComplaint.deleteMany({ where: { threadId: { in: threadIds } } }),
    prisma.directMessage.deleteMany({ where: { threadId: { in: threadIds } } }),
    prisma.directThread.deleteMany({ where: { id: { in: threadIds } } }),
  ]);
  const audit = await prisma.adminAuditLog.deleteMany({
    where: { entityType: { startsWith: "DIRECT_" }, entityId: { in: [...threadIds, ...messageIds] } },
  });
  await prisma.activity.deleteMany({ where: { id: { startsWith: "ddemo_" } } });
  await prisma.offer.deleteMany({ where: { id: { startsWith: "ddemo_" } } });
  await prisma.place.deleteMany({ where: { id: { startsWith: "ddemo_" } } });
  await prisma.businessMember.deleteMany({ where: { id: { startsWith: "ddemo_" } } });
  await prisma.business.deleteMany({ where: { id: { in: businessIds } } });
  const deletedUsers = await prisma.user.deleteMany({ where: { id: { in: userIds } } });

  console.log(
    `[direct-demo] removed: ${threads.count} threads, ${messages.count} messages, ${complaints.count} complaints, ` +
      `${riskSignals.count} risk signals, ${audit.count} audit rows, ${businessIds.length} businesses, ${deletedUsers.count} users`,
  );
}

async function main() {
  assertLocalDatabase();
  if (process.argv.includes("--cleanup")) await cleanup();
  else await seed();
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
