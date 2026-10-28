import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  if (process.env.NODE_ENV === "production" || process.env.SEED_DEMO_DATA !== "true") {
    console.log("Seed skipped. Set SEED_DEMO_DATA=true in a non-production environment to opt in.");
    return;
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required to seed the database.");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const tenant = await prisma.tenant.upsert({
      where: { slug: "local-demo-travel" }, update: {},
      create: { name: "Demo Travel Agency", slug: "local-demo-travel", status: "TRIAL", defaultLanguage: "ar", defaultCurrency: "EGP", timeZone: "Africa/Cairo" }
    });
    const existing = await prisma.customer.count({ where: { tenantId: tenant.id } });
    if (existing === 0) {
      await prisma.customer.createMany({ data: [
        { tenantId: tenant.id, name: "عميل تجريبي", phone: "+201000000001", type: "INDIVIDUAL", notes: "بيانات وهمية للاختبار فقط" },
        { tenantId: tenant.id, name: "Demo Corporate Client", companyName: "Example Company Ltd.", email: "demo@example.invalid", type: "CORPORATE", notes: "Fictional development record" }
      ] });
    }
    console.log("Fictional demo records prepared. Existing customer records are never overwritten.");
  } finally { await prisma.$disconnect(); }
}
main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
