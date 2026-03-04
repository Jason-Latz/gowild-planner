import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const chi = await prisma.originGroup.upsert({
    where: { code: "CHI" },
    update: { name: "Chicago" },
    create: {
      code: "CHI",
      name: "Chicago",
    },
  });

  const airports = ["ORD", "MDW"];

  for (const [index, airportCode] of airports.entries()) {
    await prisma.originGroupAirport.upsert({
      where: {
        originGroupId_airportCode: {
          originGroupId: chi.id,
          airportCode,
        },
      },
      update: {
        position: index,
      },
      create: {
        originGroupId: chi.id,
        airportCode,
        position: index,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
