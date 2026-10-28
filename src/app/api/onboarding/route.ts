import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { insertRow, listRows, logAudit } from "@/lib/sheets-store";

const schema = z.object({
  companyName: z.string().trim().min(2).max(120),
  defaultCurrency: z.enum(["EGP", "SAR", "USD"]),
  defaultLanguage: z.enum(["ar", "en"]).default("ar"),
  timeZone: z.string().trim().min(3).max(80).default("Africa/Cairo")
});
function createSlug(name: string) {
  const base = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42) || "travel-agency";
  return base + "-" + randomUUID().slice(0, 8);
}
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.email) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "INVALID_JSON" }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 });
  if ((await listRows("Memberships")).some((row) => row.userId === session.user.id)) return Response.json({ error: "WORKSPACE_ALREADY_EXISTS" }, { status: 409 });
  const now = new Date().toISOString(), tenantId = randomUUID(), data = parsed.data;
  await insertRow("Tenants", {
    id: tenantId, name: data.companyName, slug: createSlug(data.companyName), status: "TRIAL",
    defaultLanguage: data.defaultLanguage, defaultCurrency: data.defaultCurrency, timeZone: data.timeZone, createdAt: now, updatedAt: now
  });
  await insertRow("Memberships", {
    id: randomUUID(), tenantId, userId: session.user.id, userEmail: session.user.email, userName: session.user.name ?? "",
    role: "OWNER", createdAt: now, updatedAt: now
  });
  await logAudit({ tenantId, userId: session.user.id, action: "TENANT_CREATED", entityType: "Tenant", entityId: tenantId });
  return Response.json({ ok: true, tenantId }, { status: 201 });
}
