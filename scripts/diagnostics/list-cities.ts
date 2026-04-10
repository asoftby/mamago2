import prisma from "../../src/lib/prisma";

async function listCities() {
  const cities = await prisma.city.findMany({
    select: { slug: true, name: true },
    orderBy: { name: "asc" },
  });

  console.log("Valid city slugs:");
  cities.forEach(city => {
    console.log(`  - ${city.slug} (${city.name})`);
  });

  await prisma.$disconnect();
}

listCities().catch(console.error);
