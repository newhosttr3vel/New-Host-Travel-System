import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";
export async function GET() {
  const timestamp = new Date().toISOString();
  if (!process.env.DATABASE_URL) {
    return Response.json({ status: "degraded", database: "unconfigured", timestamp }, { status: 503 });
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", database: "connected", timestamp });
  } catch {
    return Response.json({ status: "degraded", database: "unavailable", timestamp }, { status: 503 });
  }
}
